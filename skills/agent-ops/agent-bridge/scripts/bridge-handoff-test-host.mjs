/**
 * Helpers de host para bridge-handoff.test.mjs — skip CLI y env aislado (sin depender del host real).
 */
import { resolveIdentity } from './bridge-whoami';

const VERIFIER_SESSION_ENV_KEYS = [
  'CLAUDE_CODE_SESSION_ID',
  'CODEX_SESSION_ID',
  'CODEX_THREAD_ID',
  'CURSOR_SESSION_ID',
  'GEMINI_SESSION_ID',
  'OPENCODE_SESSION_ID',
  'ZCODE_SESSION_ID',
  'DEEPSEEK_SESSION_ID',
];

/** Si la identidad observada es unknown, la CLI real no puede mutar. */
export function skipCliIfIdentityUnknown(t) {
  const live = resolveIdentity();
  if (live.agent_family === 'unknown') {
    t.skip(
      'identidad observada unknown en este host: la CLI no puede mutar; lógica cubierta por tests de librería',
    );
  }
}

/** Env de sesión del verificador inyectado; no lee variables reales del host salvo restaurarlas al salir. */
export function withIsolatedVerifierSessionEnv(sessionId, fn) {
  const saved = {};
  for (const k of VERIFIER_SESSION_ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.CLAUDE_CODE_SESSION_ID = sessionId;
  try {
    return fn();
  } finally {
    for (const k of VERIFIER_SESSION_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
