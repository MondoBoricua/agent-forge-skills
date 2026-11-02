/**
 * Trozos de resolveIdentity — cada helper cabe en <50 líneas y es puro para tests.
 */
import { basename } from 'node:path';

/** Mapa comm → familia (mismas reglas que bridge-whoami). */
export const COMM_RULES = [
  [/^claude$/i, 'claude'],
  [/^codex$/i, 'codex'],
  [/^cursor-agent$/i, 'cursor'],
  [/^Cursor$/i, 'cursor'],
  [/^agy$/i, 'agy'],
  [/^antigravity$/i, 'agy'],
  [/^zcode$/i, 'zcode'],
  [/^zcode-cli$/i, 'zcode'],
  [/^opencode$/i, 'opencode'],
  [/^gemini$/i, 'gemini'],
  [/^dsh$/i, 'deepseek'],
];

export const NODE_SCRIPT_RULES = [
  [/^zcode\.mjs$/i, 'zcode'],
  [/^zcode-cli\.mjs$/i, 'zcode'],
  [/^cursor-agent/i, 'cursor'],
  [/^codex/i, 'codex'],
  [/^claude/i, 'claude'],
  [/^agy/i, 'agy'],
  [/^opencode/i, 'opencode'],
  [/^gemini/i, 'gemini'],
];

export function classifyComm(comm) {
  const c = basename((comm || '').trim());
  for (const [re, family] of COMM_RULES) {
    if (re.test(c)) return family;
  }
  if (/^node(\d+)?$/i.test(c) || /^nodejs$/i.test(c)) return '__node__';
  return null;
}

/** Solo el primer script tras `node` (sin flags); el resto de args no cuenta. */
export function classifyNodeArgs(argsLine) {
  if (!argsLine) return null;
  const parts = argsLine.trim().split(/\s+/);
  let i = 0;
  const head = basename(parts[0] || '');
  if (/^node(\d+)?$/i.test(head) || /^nodejs$/i.test(head)) i = 1;
  while (i < parts.length && parts[i].startsWith('-')) i += 1;
  if (i >= parts.length) return null;
  const base = basename(parts[i]);
  for (const [re, family] of NODE_SCRIPT_RULES) {
    if (re.test(base)) return family;
  }
  return null;
}

/** Sube la cadena de padres y devuelve señales + familia más cercana. */
export function resolveClosestFromChain(chain, nodeArgsByPid, readNodeArgs) {
  const signals = [];
  let closestFamily = null;
  let closestDistance = Infinity;
  for (let i = 0; i < chain.length; i++) {
    const { pid, comm } = chain[i];
    let family = classifyComm(comm);
    if (family === '__node__') {
      const argsLine = nodeArgsByPid.get(pid) ?? readNodeArgs?.(pid);
      family = classifyNodeArgs(argsLine);
    }
    if (family && family !== '__node__') {
      signals.push({ kind: 'ancestor', value: family, distance: i });
      if (i < closestDistance) {
        closestDistance = i;
        closestFamily = family;
      }
    }
  }
  return { signals, closestFamily };
}

const ENV_NAME_ALLOWLIST = new Set([
  'CLAUDECODE',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CODEX_SESSION_ID',
  'CODEX_THREAD_ID',
]);

const ENV_PREFIX_ALLOW = ['CURSOR_', 'ZCODE_', 'GEMINI_CLI', 'OPENCODE'];

const SESSION_ID_KEYS = new Set([
  'CLAUDE_CODE_SESSION_ID',
  'CODEX_SESSION_ID',
  'CODEX_THREAD_ID',
]);

/** Pistas de entorno permitidas (nunca decide familia sola). */
export function scanEnvFamilies(env) {
  const hints = [];
  const envFamilies = new Set();
  for (const key of Object.keys(env)) {
    let allowed = ENV_NAME_ALLOWLIST.has(key);
    if (!allowed) {
      for (const prefix of ENV_PREFIX_ALLOW) {
        if (key.startsWith(prefix)) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) continue;
    if (key.includes('API_KEY') || key.includes('SECRET') || key.includes('TOKEN')) continue;
    let fam = null;
    if (key.startsWith('CLAUDE')) fam = 'claude';
    else if (key.startsWith('CODEX')) fam = 'codex';
    else if (key.startsWith('CURSOR')) fam = 'cursor';
    else if (key.startsWith('ZCODE')) fam = 'zcode';
    else if (key.startsWith('GEMINI_CLI')) fam = 'gemini';
    else if (key.startsWith('OPENCODE')) fam = 'opencode';
    if (fam) envFamilies.add(fam);
    if (SESSION_ID_KEYS.has(key) && env[key]) {
      hints.push({ kind: 'env_session', name: key, family: fam });
    }
  }
  return { hints, envFamilies, sessionIdKeys: SESSION_ID_KEYS };
}

/** Confianza y conflictos a partir de ascendencia + env. */
export function decideAgentFromAncestor(closestFamily, envFamilies) {
  const conflicts = [];
  let confidence = 'unknown';
  let agent_family = 'unknown';
  let reason = 'sin señal de ascendencia';
  if (!closestFamily) {
    return { agent_family, confidence, reason, conflicts };
  }
  agent_family = closestFamily;
  const envCorroborates = envFamilies.has(closestFamily);
  const envContradicts = [...envFamilies].some((f) => f !== closestFamily);
  if (envCorroborates && !envContradicts) {
    confidence = 'high';
    reason = 'ascendencia y entorno coinciden';
  } else if (envContradicts) {
    confidence = 'medium';
    reason = 'ascendencia con entorno contradictorio';
    for (const f of envFamilies) {
      if (f !== closestFamily) {
        conflicts.push({ kind: 'env_vs_ancestor', env_family: f, ancestor_family: closestFamily });
      }
    }
  } else {
    confidence = 'medium';
    reason = 'solo ascendencia';
  }
  return { agent_family, confidence, reason, conflicts };
}
