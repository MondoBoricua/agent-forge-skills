/**
 * Journal events.jsonl, dedup, línea terminal del log diario.
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { eventsPath } from './bridge-handoff-paths.mjs';
import { writeAtomicDurable } from './bridge-handoff-durable.mjs';

const TZ = 'America/Puerto_Rico';

function validateJsonLines(text) {
  for (const line of text.split('\n')) if (line.trim()) JSON.parse(line);
}

export function computeEventId({ task_id, execution_id, from, to, revision }) {
  const raw = `${task_id}|${execution_id}|${from}|${to}|${revision}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function readEventIds(eventsFile) {
  const ids = new Set();
  if (!existsSync(eventsFile)) return ids;
  const text = readFileSync(eventsFile, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.event_id) ids.add(o.event_id);
    } catch {
      /* línea incompleta — reparar con repairJournalTail */
    }
  }
  return ids;
}

/** Repara cola JSONL corrupta (última línea incompleta); guarda copia .corrupt-<ts>. */
export function repairJournalTail(eventsFile) {
  if (!existsSync(eventsFile)) return { repaired: false };
  const original = readFileSync(eventsFile, 'utf8');
  const parts = original.split('\n');
  const valid = [];
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      JSON.parse(line);
      valid.push(line);
    } catch {
      break;
    }
  }
  const rebuilt = valid.length ? `${valid.join('\n')}\n` : '';
  if (rebuilt === original) return { repaired: false };
  const corruptPath = `${eventsFile}.corrupt-${Date.now()}`;
  writeFileSync(corruptPath, original);
  writeAtomicDurable(eventsFile, rebuilt, validateJsonLines);
  return { repaired: true, corruptPath };
}

/** Busca marcador de execution_id en log del día y dos días previos (TZ PR). */
export function logHasExecutionMarker(root, executionId, anchorIso = new Date().toISOString()) {
  const marker = `<!-- bridge:${executionId}:`;
  const anchor = logDateForIso(anchorIso);
  const dates = [anchor];
  const d = new Date(anchorIso);
  for (let i = 1; i <= 2; i++) {
    d.setDate(d.getDate() - 1);
    dates.push(logDateForIso(d.toISOString()));
  }
  for (const dateStr of dates) {
    const logPath = join(root, 'data', 'logs', `${dateStr}-log.md`);
    if (!existsSync(logPath)) continue;
    if (readFileSync(logPath, 'utf8').includes(marker)) return true;
  }
  return false;
}

export function findCreatedTaskByRequest(eventsFile, requestId) {
  if (!existsSync(eventsFile)) return null;
  const text = readFileSync(eventsFile, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.request_id === requestId && o.from === 'none' && o.to === 'assigned' && o.task_id) {
        return o.task_id;
      }
    } catch {
      /* ignorar línea rota */
    }
  }
  return null;
}

export function appendEvent(eventsFile, event) {
  mkdirSync(dirname(eventsFile), { recursive: true });
  repairJournalTail(eventsFile);
  const line = `${JSON.stringify(event)}\n`;
  const previous = existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8') : '';
  writeAtomicDurable(eventsFile, `${previous}${line}`, validateJsonLines);
}

/** Escapa nota para una sola línea de log. */
export function escapeLogNote(note) {
  return String(note ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function logDateForIso(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

export function minutesSince(startIso, endIso) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return Math.max(0, Math.round((b - a) / 60_000));
}

/** resultado legible para terminal states. */
export function terminalResultLabel(status) {
  if (status === 'submitted') return 'entregado';
  if (status === 'failed') return 'fallido';
  if (status === 'cancelled') return 'cancelado';
  if (status === 'interrupted') return 'interrumpido';
  return status;
}

export function buildLogLine({ contract, toStatus, note, ts }) {
  const agent = contract.executor_agent || 'unknown';
  const model = contract.executor_context?.model ?? 'unknown';
  const started = contract.executor_context?.started_at ?? contract.created_at;
  const mins = minutesSince(started, ts);
  const result = terminalResultLabel(toStatus);
  const safeNote = escapeLogNote(note);
  const checksum = createHash('sha256')
    .update(`${agent}|${model}|${mins}|${result}|${safeNote}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  const body = `- ${agent} · ${model} · ${mins} min · ${result} · ${safeNote}`;
  return `${body} <!-- bridge:${contract.execution_id}:${checksum} -->`;
}

export function appendLogLine(root, dateStr, line) {
  const logPath = join(root, 'data', 'logs', `${dateStr}-log.md`);
  mkdirSync(dirname(logPath), { recursive: true });
  const prefix = existsSync(logPath) ? '' : `# Log ${dateStr}\n\n`;
  appendFileSync(logPath, `${prefix}${line}\n`, 'utf8');
}

/** Completa efectos pendientes (journal + log). */
export function applyLastEffect(root, contract, { dedupOnly = false } = {}) {
  const le = contract.last_effect;
  if (!le || !le.pending) return { applied: false };
  const eventsFile = eventsPath(root);
  const known = readEventIds(eventsFile);
  let applied = 0;
  if (!known.has(le.event_id) && le.event && !dedupOnly) {
    appendEvent(eventsFile, le.event);
    applied += 1;
  }
  if (le.log_line && le.log_date && le.event?.execution_id) {
    if (!logHasExecutionMarker(root, le.event.execution_id, le.event.ts)) {
      appendLogLine(root, le.log_date, le.log_line);
      applied += 1;
    }
  } else if (le.log_line && le.log_date) {
    const logPath = join(root, 'data', 'logs', `${le.log_date}-log.md`);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf8');
      if (!content.includes(le.log_line)) {
        appendLogLine(root, le.log_date, le.log_line);
        applied += 1;
      }
    } else {
      appendLogLine(root, le.log_date, le.log_line);
      applied += 1;
    }
  }
  return { applied: applied > 0 };
}

export function fsyncFile(path) {
  try {
    const fd = openSync(path, 'r+');
    closeSync(fd);
  } catch {
    /* best effort */
  }
}
