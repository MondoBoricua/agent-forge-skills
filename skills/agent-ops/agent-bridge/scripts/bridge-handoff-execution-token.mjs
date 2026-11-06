/**
 * Token de ejecución B2 — autoriza mutaciones del ejecutor cuando whoami es unknown
 * o no coincide con executor_agent (sandboxes sin ps).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTE_LEN = 32;
const ENV_TOKEN = 'BRIDGE_EXECUTION_TOKEN';

/** Genera par token en claro (una sola emisión) + sha256 hex para el contrato. */
export function generateExecutionTokenPair() {
  const raw = randomBytes(TOKEN_BYTE_LEN);
  const token = raw.toString('base64url');
  const execution_token_sha256 = createHash('sha256').update(token, 'utf8').digest('hex');
  return { token, execution_token_sha256 };
}

/** Lee token de --token o del entorno (no se persiste). */
export function readExecutionTokenFromInvocation(tokenArg) {
  if (tokenArg) return tokenArg;
  const fromEnv = process.env[ENV_TOKEN];
  if (fromEnv) return fromEnv;
  return null;
}

/** true si el entorno trae BRIDGE_EXECUTION_TOKEN (aunque no se use en la mutación). */
export function envHasExecutionToken() {
  return Boolean(process.env[ENV_TOKEN]);
}

/**
 * Formato esperado: base64url de exactamente 32 bytes decodificados.
 * @returns {{ ok: true } | { ok: false, reason: 'token_malformed' }}
 */
export function assertWellFormedExecutionToken(token) {
  if (typeof token !== 'string' || !token.length) {
    return { ok: false, reason: 'token_malformed' };
  }
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length !== TOKEN_BYTE_LEN) return { ok: false, reason: 'token_malformed' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'token_malformed' };
  }
}

export function verifyExecutionTokenSha256(token, storedSha256Hex) {
  if (!storedSha256Hex || typeof storedSha256Hex !== 'string') return false;
  const got = createHash('sha256').update(token, 'utf8').digest();
  let expected;
  try {
    expected = Buffer.from(storedSha256Hex, 'hex');
  } catch {
    return false;
  }
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

/**
 * Identidad observada para journal/contrato: familia + hints de nombres de env,
 * ids de sesión permitidos; sin otros valores de entorno.
 */
export function sanitizeIdentityObserved(identity) {
  if (!identity || typeof identity !== 'object') {
    return { agent_family: 'unknown', hints: [], session_id: null, pid: identity?.pid ?? null };
  }
  const hintNames = [];
  for (const h of identity.hints || []) {
    if (h?.kind === 'env_only' && Array.isArray(h.families)) {
      hintNames.push({ kind: 'env_families', names: h.families });
    } else if (h?.kind) {
      hintNames.push({ kind: h.kind, names: h.families ?? h.names ?? [] });
    }
  }
  if (Array.isArray(identity.conflicts)) {
    for (const c of identity.conflicts) {
      if (c?.env_keys) hintNames.push({ kind: 'env_keys', names: c.env_keys });
    }
  }
  return {
    agent_family: identity.agent_family ?? 'unknown',
    confidence: identity.confidence ?? null,
    session_id: identity.session_id ?? null,
    pid: identity.pid ?? null,
    host: identity.host ?? null,
    reason: identity.reason ?? null,
    hints: hintNames,
  };
}

/** Transiciones que solo el ejecutor (o token de ejecución) puede hacer. */
export function isExecutorOnlyTransition({ from, to, op }) {
  if (op === 'done') return true;
  if (to === 'running' && from === 'assigned') return true;
  if ((to === 'blocked' && from === 'running') || (to === 'running' && from === 'blocked')) return true;
  if (to === 'submitted') return true;
  if (to === 'interrupted' || to === 'failed') {
    return true;
  }
  return false;
}

/**
 * Autoriza mutación del ejecutor por identidad observada o por token.
 */
export function resolveExecutorAuthorization({ identity, contract, executionToken, from, to, op }) {
  const E = contract?.executor_agent;
  const fam = identity?.agent_family ?? 'unknown';
  const matchesExecutor = E && fam === E;

  if (matchesExecutor) {
    return { ok: true, via: 'identity', tokenAuthorized: false, identity_observed: null };
  }

  const needsToken = fam === 'unknown' || (E && fam !== E);
  if (!needsToken) {
    return { ok: true, via: 'identity', tokenAuthorized: false, identity_observed: null };
  }

  if (!executionToken) {
    if (fam === 'unknown') return { ok: false, exit: 1, error: 'identity_unknown' };
    return { ok: false, exit: 1, error: 'not_executor' };
  }

  const formed = assertWellFormedExecutionToken(executionToken);
  if (!formed.ok) return { ok: false, exit: 3, error: 'token_invalid' };

  if (!contract.execution_token_sha256) {
    return { ok: false, exit: 1, error: 'token_invalid' };
  }
  if (!verifyExecutionTokenSha256(executionToken, contract.execution_token_sha256)) {
    return { ok: false, exit: 1, error: 'token_invalid' };
  }

  if (!isExecutorOnlyTransition({ from, to, op })) {
    return { ok: false, exit: 1, error: 'not_executor' };
  }

  return {
    ok: true,
    via: 'execution_token',
    tokenAuthorized: true,
    identity_observed: sanitizeIdentityObserved(identity),
  };
}
