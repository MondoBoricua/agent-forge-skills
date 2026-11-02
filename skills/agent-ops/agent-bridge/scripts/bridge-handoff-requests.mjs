/**
 * Idempotencia por request_id (últimos 50).
 */
import { createHash } from 'node:crypto';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBriefFile } from './bridge-handoff-brief.mjs';

const MAX_REQUESTS = 50;

/** JSON estable (claves ordenadas) para hashes de idempotencia. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export function hashPayload(obj) {
  return createHash('sha256').update(canonicalJson(obj), 'utf8').digest('hex');
}

export function getRequestEntry(contract, requestId) {
  const req = contract.requests || {};
  return req[requestId] ?? null;
}

/** Localiza un task por request_id persistido en requests (sin depender del journal). */
export function findTaskIdByRequestRecord(root, requestId) {
  const dir = join(root, 'data', 'briefs');
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const loaded = loadBriefFile(join(dir, name));
    if (loaded.error) continue;
    if (getRequestEntry(loaded.contract, requestId)) return loaded.contract.task_id;
  }
  return null;
}

export function checkRequestReplay(contract, requestId, payload) {
  const h = hashPayload(payload);
  const prev = getRequestEntry(contract, requestId);
  if (!prev) return { action: 'new', payload_hash: h };
  if (prev.payload_hash === h) return { action: 'replay', payload_hash: h, result: prev.result };
  return { action: 'conflict', payload_hash: h, prev_hash: prev.payload_hash };
}

export function storeRequestResult(contract, requestId, payloadHash, result) {
  const requests = { ...(contract.requests || {}) };
  requests[requestId] = {
    payload_hash: payloadHash,
    result,
    ts: new Date().toISOString(),
  };
  const keys = Object.keys(requests);
  if (keys.length > MAX_REQUESTS) {
    const sorted = keys
      .map((k) => ({ k, ts: requests[k].ts || '' }))
      .sort((a, b) => a.ts.localeCompare(b.ts));
    const drop = sorted.slice(0, keys.length - MAX_REQUESTS);
    for (const { k } of drop) delete requests[k];
  }
  return { ...contract, requests };
}
