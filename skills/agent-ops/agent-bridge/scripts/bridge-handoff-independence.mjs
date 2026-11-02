/**
 * Independencia D2 + B2: observed_distinct, same_family, self_report, unknown.
 */

const VALID_INDEPENDENCE = new Set(['observed_distinct', 'same_family', 'self_report', 'unknown']);

/** Ids de sesión por proveedor (solo se comparan dentro del mismo proveedor). */
const SESSION_ENV_BY_FAMILY = {
  claude: ['CLAUDE_CODE_SESSION_ID'],
  codex: ['CODEX_SESSION_ID', 'CODEX_THREAD_ID'],
  cursor: ['CURSOR_SESSION_ID'],
  agy: ['GEMINI_SESSION_ID'],
  gemini: ['GEMINI_SESSION_ID'],
  opencode: ['OPENCODE_SESSION_ID'],
  zcode: ['ZCODE_SESSION_ID'],
  deepseek: ['DEEPSEEK_SESSION_ID'],
};

export function sessionIdForFamily(family, env) {
  if (!family || !env) return null;
  const keys = SESSION_ENV_BY_FAMILY[family];
  if (!keys) return null;
  for (const k of keys) {
    if (env[k]) return env[k];
  }
  return null;
}

/** Ids de sesión por proveedor en un env (solo CLI/whoami; la librería no lee process.env). */
export function buildSessionsFromEnv(env) {
  if (!env || typeof env !== 'object') return {};
  const sessions = {};
  for (const family of Object.keys(SESSION_ENV_BY_FAMILY)) {
    const sid = sessionIdForFamily(family, env);
    if (sid) sessions[family] = sid;
  }
  return sessions;
}

/** Mapa sessions por proveedor solo desde identity observada/inyectada (B9: nunca process.env). */
export function buildSessionsFromIdentity(identity) {
  if (!identity || typeof identity !== 'object') return {};
  const sessions =
    identity.sessions && typeof identity.sessions === 'object' ? { ...identity.sessions } : {};
  const family = identity.agent_family;
  if (family && family !== 'unknown') {
    const sid = identity.session_id ?? null;
    if (sid && !(family in sessions)) {
      sessions[family] = sid;
    }
  }
  if (Array.isArray(identity.hints)) {
    for (const h of identity.hints) {
      if (h?.kind === 'env_session' && h.family && h.value && !(h.family in sessions)) {
        sessions[h.family] = h.value;
      }
    }
  }
  return sessions;
}

function verifierSessionIdForFamily(verifierIdentity, family) {
  if (!verifierIdentity || !family) return null;
  const sessions = verifierIdentity.sessions;
  if (sessions && typeof sessions === 'object' && family in sessions) {
    return sessions[family] ?? null;
  }
  const fam = verifierIdentity.agent_family;
  if (fam === family || fam === undefined || fam === null) {
    return verifierIdentity.session_id ?? null;
  }
  return null;
}

/** Sesión del ejecutor atribuible solo a la familia pedida (mapa `sessions` o legacy `session_id`). */
function executorSessionIdForFamily(executorContext, family) {
  if (!executorContext || !family) return null;
  const sessions = executorContext.sessions;
  if (sessions && typeof sessions === 'object' && family in sessions) {
    return sessions[family] ?? null;
  }
  if (executorContext.family === family) {
    return executorContext.session_id ?? null;
  }
  return null;
}

/**
 * (a) host+pid siempre; (b)(c) sesión solo si `attributableExecutorSessions` y misma familia observada.
 * B8: ejecutor unknown/token no atribuye sesiones del entorno (pueden ser heredadas del coordinador).
 */
function selfReportSignals({
  verifierFamily,
  execFam,
  verifierIdentity,
  executorContext,
  allowNullSessionRule,
  attributableExecutorSessions,
}) {
  const vPid = verifierIdentity?.pid ?? null;
  const ePid = executorContext?.pid ?? null;
  const vHost = verifierIdentity?.host ?? null;
  const eHost = executorContext?.host ?? null;

  if (vHost && eHost && vHost === eHost && vPid !== null && ePid !== null && vPid === ePid) {
    return true;
  }
  if (!attributableExecutorSessions || verifierFamily !== execFam) {
    return false;
  }
  const vSid = verifierSessionIdForFamily(verifierIdentity, verifierFamily);
  const eSid = executorSessionIdForFamily(executorContext, execFam);

  if (vSid !== null && eSid !== null && vSid === eSid) {
    return true;
  }
  if (allowNullSessionRule && (vSid === null || eSid === null)) {
    return true;
  }
  return false;
}

export function resolveHandoffIndependence({
  verifierFamily,
  executorFamily,
  executorContext,
  verifierIdentity,
}) {
  if (!verifierFamily || verifierFamily === 'unknown') {
    return { independence: 'unknown', self_report: false };
  }
  const execFam = executorFamily || executorContext?.family || 'unknown';

  const attributableSessions =
    execFam !== 'unknown' && executorContext?.authorized_by !== 'execution_token';

  if (executorContext?.authorized_by === 'execution_token') {
    if (
      selfReportSignals({
        verifierFamily,
        execFam,
        verifierIdentity,
        executorContext,
        allowNullSessionRule: false,
        attributableExecutorSessions: false,
      })
    ) {
      return { independence: 'self_report', self_report: true };
    }
    return { independence: 'unknown', self_report: false };
  }

  if (execFam === 'unknown') {
    return { independence: 'unknown', self_report: false };
  }
  const sameFamily = verifierFamily === execFam;
  if (!sameFamily) {
    return { independence: 'observed_distinct', self_report: false };
  }
  if (
    selfReportSignals({
      verifierFamily,
      execFam,
      verifierIdentity,
      executorContext,
      allowNullSessionRule: true,
      attributableExecutorSessions: attributableSessions,
    })
  ) {
    return { independence: 'self_report', self_report: true };
  }
  return { independence: 'same_family', self_report: false };
}

export function blocksVerifiedAccepted(independence) {
  return independence === 'self_report';
}

export function isValidIndependence(v) {
  return VALID_INDEPENDENCE.has(v);
}
