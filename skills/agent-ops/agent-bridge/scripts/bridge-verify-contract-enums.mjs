/**
 * Enums y tipos del contrato — una sola fuente para validateContract y docs.
 */
export const VALID_STATUS = new Set([
  'draft',
  'assigned',
  'running',
  'submitted',
  'interrupted',
  'blocked',
  'failed',
  'cancelled',
  'verified',
  'accepted',
]);

export const VALID_ROLE = new Set(['coordinator', 'executor', 'verifier']);

export const VALID_INTERRUPT_CLASS = new Set([
  'timeout',
  'tool_error',
  'disconnect',
  'rate_limit',
  'context_exhausted',
  'auth',
  'safety_refusal',
  'potential_false_positive',
  'unknown',
]);

/** Tipos opcionales/nullable fuera del bloque de strings obligatorios. */
export function validateContractScalars(contract) {
  if (contract.parent_task_id !== null && typeof contract.parent_task_id !== 'string') {
    return { ok: false, reason: 'parent_task_id' };
  }
  if (typeof contract.result_path !== 'string') return { ok: false, reason: 'result_path' };
  if (contract.deadline !== null && typeof contract.deadline !== 'string') {
    return { ok: false, reason: 'deadline' };
  }
  if (!VALID_ROLE.has(contract.role)) return { ok: false, reason: 'role' };
  if (!VALID_STATUS.has(contract.status)) return { ok: false, reason: 'status' };
  const ic = contract.interrupt_class;
  if (contract.status === 'interrupted') {
    if (!VALID_INTERRUPT_CLASS.has(ic)) return { ok: false, reason: 'interrupt_class' };
  } else if (ic !== undefined && ic !== null) {
    return { ok: false, reason: 'interrupt_class' };
  }
  return { ok: true };
}
