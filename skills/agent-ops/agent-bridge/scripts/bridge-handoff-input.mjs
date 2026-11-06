/**
 * Filtrado de --input en retry/round y recorrido ancestral con tope.
 */
import { loadBriefFile } from './bridge-handoff-brief.mjs';
import { briefPath } from './bridge-handoff-paths.mjs';

/** Campos permitidos del JSON de entrada en retry/round (objetivo se conserva del contrato). */
export const RETRY_ROUND_INPUT_KEYS = [
  'scope',
  'constraints',
  'context_refs',
  'allowed_files',
  'forbidden_files',
  'requires_changes',
  'expected_artifacts',
  'required_checks',
  'completion_criteria',
  'stop_conditions',
  'evidence_required',
  'result_path',
  'deadline',
  'verifier_agent',
  'executor_agent',
  'repo_scope',
];

export function pickRetryRoundInput(input) {
  const out = {};
  for (const k of RETRY_ROUND_INPUT_KEYS) {
    if (input[k] !== undefined) out[k] = input[k];
  }
  return out;
}

/** Evita ciclos al subir parent_task_id (máx 32 saltos). */
export function assertAncestryNoCycle(root, taskId, parentTaskId) {
  const visited = new Set([taskId]);
  let walk = parentTaskId;
  let steps = 0;
  while (walk) {
    if (steps >= 32) return { ok: false, error: 'ancestry_cycle' };
    if (visited.has(walk)) return { ok: false, error: 'ancestry_cycle' };
    visited.add(walk);
    const w = loadBriefFile(briefPath(root, walk));
    if (w.error) break;
    walk = w.contract.parent_task_id;
    steps += 1;
  }
  return { ok: true };
}
