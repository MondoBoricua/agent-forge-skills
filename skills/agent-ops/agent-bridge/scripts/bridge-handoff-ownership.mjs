/**
 * Ownership coordinado D4 — conflictos entre briefs activos del mismo repo_key.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadBriefFile } from './bridge-handoff-brief.mjs';
import { isActiveForOwnership } from './bridge-handoff-contract-b.mjs';
import { pathMatchesPattern } from './bridge-verify';

function pathsOverlap(a, b) {
  const setA = a?.length ? a : [];
  const setB = b?.length ? b : [];
  if (!setA.length || !setB.length) return false;
  for (const pa of setA) {
    for (const pb of setB) {
      if (pa === pb) return true;
      if (pathMatchesPattern(pa, pb) || pathMatchesPattern(pb, pa)) return true;
      if (pa === '**' || pb === '**') return true;
    }
  }
  return false;
}

/** Lista briefs activos con mismo repo_key y rutas solapadas. */
export function findOwnershipConflicts(root, repoKey, paths, excludeTaskId) {
  const dir = join(root, 'data', 'briefs');
  if (!existsSync(dir)) return [];
  const conflicts = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const taskId = name.replace(/\.md$/, '');
    if (taskId === excludeTaskId) continue;
    const loaded = loadBriefFile(join(dir, name));
    if (loaded.error) continue;
    const c = loaded.contract;
    if (!isActiveForOwnership(c.status)) continue;
    const own = c.ownership;
    if (!own || own.repo_key !== repoKey) continue;
    if (pathsOverlap(own.paths, paths)) {
      conflicts.push({ task_id: c.task_id, execution_id: c.execution_id, status: c.status, paths: own.paths });
    }
  }
  return conflicts;
}
