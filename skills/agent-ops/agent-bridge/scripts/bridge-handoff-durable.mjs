/**
 * Escritura durable para bridge-handoff (B): tmp → fsync archivo → rename → fsync directorio.
 * El temporal se relee y valida antes de publicar el archivo.
 */
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { basename, join } from 'node:path';

/** Escribe contenido de forma atómica y durable en el destino final. */
export function writeAtomicDurable(targetPath, content, validate = JSON.parse) {
  const dir = dirname(targetPath);
  const tmp = join(dir, `.${basename(targetPath)}.tmp.${process.pid}.${randomUUID()}`);
  try {
    const fd = openSync(tmp, 'wx');
    try {
      writeFileSync(fd, content, 'utf8');
      const written = readFileSync(tmp, 'utf8');
      if (written !== content) {
        throw Object.assign(new Error('serialized_content_mismatch'), { code: 'SERIALIZED_CONTENT_MISMATCH' });
      }
      validate(written);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
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
