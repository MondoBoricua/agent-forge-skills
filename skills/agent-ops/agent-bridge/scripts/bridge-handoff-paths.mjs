/**
 * Rutas seguras y resolución de raíz git para bridge-handoff.
 */
import { existsSync, lstatSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** TASK debe ser UUID v4. */
export function isTaskUuid(taskId) {
  return typeof taskId === 'string' && UUID_RE.test(taskId);
}

/** Rechaza rutas absolutas o con .. en alcance de archivos. */
export function isSafeRelativePath(p) {
  if (typeof p !== 'string' || !p.length) return false;
  if (isAbsolute(p)) return false;
  const norm = p.replace(/\\/g, '/');
  if (norm.includes('..')) return false;
  return true;
}

export function validateScopePaths(paths) {
  if (!Array.isArray(paths)) return false;
  return paths.every((p) => typeof p === 'string' && (p === '' || isSafeRelativePath(p)));
}

/** Raíz git del cwd o --root. */
export function resolveRepoRoot(rootOpt) {
  const start = rootOpt ? resolve(rootOpt) : process.cwd();
  const r = spawnSync('git', ['-C', start, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (r.status !== 0) return { error: 'not_git_root' };
  return { root: r.stdout.trim() };
}

/** git-common-dir resuelto (ownership.repo_key). */
export function resolveRepoKey(repoRoot) {
  const r = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--git-common-dir'], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (r.status !== 0) return { error: 'git_common_dir' };
  const raw = r.stdout.trim();
  const abs = isAbsolute(raw) ? raw : resolve(repoRoot, raw);
  return { repoKey: abs };
}

export function briefPath(root, taskId) {
  if (!isTaskUuid(taskId)) return null;
  return join(root, 'data', 'briefs', `${taskId}.md`);
}

export function briefLockPath(briefFile) {
  return `${briefFile}.lock`;
}

export function journalLockPath(root) {
  return join(root, 'data', 'bridge', 'journal.lock');
}

export function eventsPath(root) {
  return join(root, 'data', 'bridge', 'events.jsonl');
}

export function eventsIndexPath(root) {
  return join(root, 'data', 'bridge', 'events.index');
}

export function evidenceDir(root, executionId) {
  return join(root, 'data', 'bridge', 'evidence', executionId);
}

/** Destino de escritura: no symlink. */
export function assertRealFileTarget(targetPath) {
  if (existsSync(targetPath)) {
    try {
      if (lstatSync(targetPath).isSymbolicLink()) return { ok: false, reason: 'symlink_target' };
    } catch {
      return { ok: false, reason: 'stat_failed' };
    }
  }
  const parent = join(targetPath, '..');
  if (existsSync(parent)) {
    try {
      if (lstatSync(parent).isSymbolicLink()) return { ok: false, reason: 'symlink_parent' };
    } catch {
      return { ok: false, reason: 'stat_failed' };
    }
  }
  return { ok: true };
}

/** HEAD actual del worktree del contrato. */
export function gitHead(worktree) {
  const r = spawnSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (r.status !== 0) return null;
  return r.stdout.trim();
}
