/**
 * Extensiones B del contrato y objective_key.
 */
import { createHash } from 'node:crypto';
import { validateContract } from './bridge-verify';

const ACTIVE_OWNERSHIP = new Set(['assigned', 'running', 'blocked', 'submitted']);

/** Normaliza objetivo → sha256 (NFC, minúsculas, espacios colapsados). */
export function computeObjectiveKey(objective) {
  const s = String(objective ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function isUuid(s) {
  return typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
}

function isNonNegInt(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Valida campos B además del contrato A. */
export function validateHandoffContract(contract) {
  const base = validateContract(contract);
  if (!base.ok) return base;
  if (!isNonNegInt(contract.revision) || contract.revision < 1) {
    return { ok: false, reason: 'revision' };
  }
  if (typeof contract.objective_key !== 'string' || contract.objective_key.length !== 64) {
    return { ok: false, reason: 'objective_key' };
  }
  if (!Array.isArray(contract.delegation_history)) return { ok: false, reason: 'delegation_history' };
  if (!Array.isArray(contract.execution_history)) return { ok: false, reason: 'execution_history' };
  const own = contract.ownership;
  if (!own || typeof own !== 'object') return { ok: false, reason: 'ownership' };
  if (typeof own.repo_key !== 'string' || !own.repo_key) return { ok: false, reason: 'ownership_repo' };
  if (!Array.isArray(own.paths)) return { ok: false, reason: 'ownership_paths' };
  if (!isUuid(own.execution_id)) return { ok: false, reason: 'ownership_execution' };
  const req = contract.requests;
  if (req !== undefined && (typeof req !== 'object' || Array.isArray(req))) {
    return { ok: false, reason: 'requests' };
  }
  const le = contract.last_effect;
  if (le !== undefined && le !== null) {
    if (typeof le !== 'object') return { ok: false, reason: 'last_effect' };
    if (typeof le.event_id !== 'string') return { ok: false, reason: 'last_effect_event' };
    if (typeof le.pending !== 'boolean') return { ok: false, reason: 'last_effect_pending' };
  }
  if (contract.verifier_agent !== undefined && contract.verifier_agent !== null) {
    if (typeof contract.verifier_agent !== 'string') return { ok: false, reason: 'verifier_agent' };
  }
  if (contract.verification !== undefined && contract.verification !== null) {
    const v = contract.verification;
    if (typeof v !== 'object') return { ok: false, reason: 'verification' };
    if (!isNonNegInt(v.revision)) return { ok: false, reason: 'verification_revision' };
    if (typeof v.verdict !== 'string') return { ok: false, reason: 'verification_verdict' };
  }
  if (contract.executor_context !== undefined && contract.executor_context !== null) {
    const ec = contract.executor_context;
    if (typeof ec !== 'object') return { ok: false, reason: 'executor_context' };
    if (typeof ec.family !== 'string') return { ok: false, reason: 'executor_context_family' };
  }
  if (
    contract.execution_token_sha256 !== undefined &&
    contract.execution_token_sha256 !== null &&
    (typeof contract.execution_token_sha256 !== 'string' ||
      contract.execution_token_sha256.length !== 64)
  ) {
    return { ok: false, reason: 'execution_token_sha256' };
  }
  return { ok: true };
}

export function isActiveForOwnership(status) {
  return ACTIVE_OWNERSHIP.has(status);
}

/** Familias visitadas en delegation_history (campo `to`). */
export function visitedFamilies(history) {
  const s = new Set();
  for (const h of history || []) {
    if (h && typeof h.to === 'string') s.add(h.to);
  }
  return s;
}
