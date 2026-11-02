/**
 * Escritura durable para bridge-handoff (B): tmp → fsync archivo → rename → fsync directorio.
 * bridge-verify (A) sigue con writeAtomic sin fsync; mejora futura documentada en REPORT B3.
 */
import { closeSync, fsyncSync, openSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { basename, join } from 'node:path';

/** Escribe contenido de forma atómica y durable en el destino final. */
export function writeAtomicDurable(targetPath, content) {
  const dir = dirname(targetPath);
  const tmp = join(dir, `.${basename(targetPath)}.tmp.${process.pid}`);
  writeFileSync(tmp, content, 'utf8');
  const fd = openSync(tmp, 'r+');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tmp, targetPath);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* limpieza best-effort */
    }
    throw e;
  }
  try {
    const dirFd = openSync(dir, 'r');
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch {
    /* algunos FS no soportan fsync de directorio */
  }
  return tmp;
}
