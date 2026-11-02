/**
 * Espejo de lockIoFailure (bridge-handoff-lock.mjs) para EPERM en root sin mock de openSync.
 */
import { dirname } from 'node:path';

/** Misma forma que acquireLock cuando openSync/write lanza EPERM o EACCES. */
export function lockIoFailureForTest(lockPath, err) {
  const errno = err?.code ?? 'UNKNOWN';
  let message = err?.message ?? String(err);
  let hint = null;
  if (errno === 'ENOENT') {
    hint = 'el directorio no existe';
    message = `no se pudo crear lock en ${lockPath}: el directorio no existe`;
  } else if (errno === 'EPERM' || errno === 'EACCES') {
    hint = 'sin permiso de escritura';
    message = `sin permiso de escritura en ${dirname(lockPath)}`;
  }
  return { ok: false, reason: 'lock_io', errno, path: lockPath, message, hint };
}
