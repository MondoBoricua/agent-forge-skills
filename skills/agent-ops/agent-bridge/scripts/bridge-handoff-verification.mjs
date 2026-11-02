/**
 * Contrato derivado para bridge-verify: el estado que escribe bridge-handoff
 * bajo ROOT no debe contar como violación de alcance cuando ROOT ⊆ worktree.
 */
import { isAbsolute, relative, resolve } from 'node:path';

/** Subcarpetas de estado relativas a la raíz de datos del handoff (ROOT). */
const HANDOFF_STATE_SEGMENTS = ['data/briefs', 'data/bridge', 'data/logs'];

/**
 * True si root está dentro del worktree del contrato (o es el mismo directorio).
 */
export function rootWithinWorktree(root, worktree) {
  const wt = resolve(worktree);
  const rt = resolve(root);
  const rel = relative(wt, rt);
  if (rel === '') return true;
  if (rel.startsWith('..')) return false;
  return !isAbsolute(rel);
}

/**
 * Globs de estado propio del handoff, relativos al worktree (prefijo si ROOT es subdir).
 */
export function handoffStatePathGlobs(root, worktree) {
  const wt = resolve(worktree);
  const rt = resolve(root);
  const rootRel = relative(wt, rt);
  const prefix = rootRel ? `${rootRel.replace(/\\/g, '/')}/` : '';
  return HANDOFF_STATE_SEGMENTS.map((seg) => `${prefix}${seg}/**`);
}

/**
 * Contrato en memoria para buildVerificationReport; null si ROOT queda fuera del worktree.
 */
export function deriveVerificationContract(root, contract) {
  if (!contract?.worktree) return null;
  if (!rootWithinWorktree(root, contract.worktree)) return null;

  const state_paths_ignored = handoffStatePathGlobs(root, contract.worktree);
  const allowed = [...(contract.allowed_files ?? [])];
  for (const g of state_paths_ignored) {
    if (!allowed.includes(g)) allowed.push(g);
  }
  const ignored = new Set(state_paths_ignored);
  const forbidden = (contract.forbidden_files ?? []).filter((p) => !ignored.has(p));

  return {
    state_paths_ignored,
    contract: {
      ...contract,
      allowed_files: allowed,
      forbidden_files: forbidden,
    },
  };
}
