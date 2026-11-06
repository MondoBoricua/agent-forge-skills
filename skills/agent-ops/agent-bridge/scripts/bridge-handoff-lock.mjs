/**
 * Locks mínimos: journal.lock y <brief>.lock (wx, sin lease).
 */
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';

/** Mensaje legible para fallos de open/write que no son lock ocupado. */
function lockIoFailure(lockPath, err) {
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

/** Intenta crear lock con O_EXCL; devuelve token o error. */
export function acquireLock(lockPath) {
  const token = randomUUID();
  const body = JSON.stringify({
    host: hostname(),
    pid: process.pid,
    ts: new Date().toISOString(),
    token,
  });
  try {
    const fd = openSync(lockPath, 'wx');
    try {
      writeFileSync(fd, body, 'utf8');
      JSON.parse(readFileSync(lockPath, 'utf8'));
      closeSync(fd);
      return { ok: true, token, path: lockPath };
    } catch (writeErr) {
      try {
        closeSync(fd);
      } catch {
        /* fd ya cerrado */
      }
      try {
        unlinkSync(lockPath);
      } catch {
        /* lock huérfano evitado si unlink alcanza */
      }
      return lockIoFailure(lockPath, writeErr);
    }
  } catch (e) {
    if (e.code === 'EEXIST') {
      let owner = null;
      try {
        owner = JSON.parse(readFileSync(lockPath, 'utf8'));
      } catch {
        owner = { host: 'unknown', pid: -1 };
      }
      return { ok: false, reason: 'lock_busy', owner, path: lockPath };
    }
    return lockIoFailure(lockPath, e);
  }
}

/** Quita lock solo si el token coincide. */
export function releaseLock(lockPath, token) {
  try {
    const raw = readFileSync(lockPath, 'utf8');
    const data = JSON.parse(raw);
    if (data.token !== token) return { ok: false, reason: 'not_owner' };
    unlinkSync(lockPath);
    return { ok: true };
  } catch {
    try {
      unlinkSync(lockPath);
    } catch {
      /* ya no existe */
    }
    return { ok: true };
  }
}

/** unlock --force: pid muerto en este host. */
export function forceUnlock(lockPath) {
  let data;
  try {
    data = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    try {
      unlinkSync(lockPath);
    } catch {
      /* nada */
    }
    return { ok: true, removed: true };
  }
  const host = hostname();
  if (data.host !== host) {
    return { ok: false, reason: 'foreign_host', owner: data };
  }
  try {
    process.kill(data.pid, 0);
    return { ok: false, reason: 'owner_alive', owner: data };
  } catch {
    unlinkSync(lockPath);
    return { ok: true, removed: true };
  }
}

export function readLockOwner(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}
