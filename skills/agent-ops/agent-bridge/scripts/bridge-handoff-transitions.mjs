/**
 * Reglas de transición y actor (C/E/V).
 */
import { VALID_INTERRUPT_CLASS } from './bridge-verify-contract-enums.mjs';
import { resolveHandoffIndependence } from './bridge-handoff-independence.mjs';

const TERMINAL_LOG = new Set(['submitted', 'failed', 'cancelled', 'interrupted']);

export function needsTerminalLog(toStatus) {
  return TERMINAL_LOG.has(toStatus);
}

/** ¿La familia observada puede hacer esta transición? */
export function assertActor({ contract, identity, from, to, op }) {
  const fam = identity.agent_family;
  const C = contract.coordinator_agent;
  const E = contract.executor_agent;
  const isC = fam === C;
  const isE = fam === E;

  if (op === 'new') {
    return isC ? { ok: true, role: 'C' } : { ok: false, reason: 'not_coordinator' };
  }
  if (to === 'assigned' && from === 'draft') {
    return isC ? { ok: true, role: 'C' } : { ok: false, reason: 'not_coordinator' };
  }
  if (to === 'running' && from === 'assigned') {
    return isE ? { ok: true, role: 'E' } : { ok: false, reason: 'not_executor' };
  }
  if ((to === 'blocked' && from === 'running') || (to === 'running' && from === 'blocked')) {
    return isE ? { ok: true, role: 'E' } : { ok: false, reason: 'not_executor' };
  }
  if (to === 'cancelled') {
    return isC ? { ok: true, role: 'C' } : { ok: false, reason: 'not_coordinator' };
  }
  if (to === 'interrupted' || to === 'failed') {
    return isC || isE ? { ok: true, role: isC ? 'C' : 'E' } : { ok: false, reason: 'not_actor' };
  }
  if (to === 'submitted') {
    return isE ? { ok: true, role: 'E' } : { ok: false, reason: 'not_executor' };
  }
  if (to === 'verified') {
    const V = contract.verifier_agent;
    const isV = V && fam === V;
    return isC || isV ? { ok: true, role: isV ? 'V' : 'C' } : { ok: false, reason: 'not_verifier' };
  }
  if (to === 'accepted') {
    return isC ? { ok: true, role: 'C' } : { ok: false, reason: 'not_coordinator' };
  }
  return { ok: false, reason: 'invalid_transition' };
}

export function allowedTransition(from, to) {
  const edges = {
    draft: new Set(['assigned']),
    assigned: new Set(['running', 'interrupted', 'failed', 'cancelled', 'blocked']),
    running: new Set(['blocked', 'interrupted', 'failed', 'cancelled', 'submitted']),
    blocked: new Set(['running', 'interrupted', 'failed', 'cancelled', 'submitted']),
    submitted: new Set(['verified', 'assigned']),
    verified: new Set(['accepted']),
    interrupted: new Set(['assigned']),
    failed: new Set(['assigned']),
    cancelled: new Set(['assigned']),
  };
  return edges[from]?.has(to) ?? false;
}

export function validateInterruptClass(to, classOpt) {
  if (to !== 'interrupted') return { ok: true };
  if (!classOpt || !VALID_INTERRUPT_CLASS.has(classOpt)) {
    return { ok: false, reason: 'interrupt_class_required' };
  }
  return { ok: true };
}

/** Ejecutor no puede verified/accepted si la independencia sería self_report. */
export function executorForbiddenMutation(contract, identity, to) {
  if (to !== 'verified' && to !== 'accepted') return false;
  if (identity.agent_family !== contract.executor_agent) return false;
  const ec = contract.executor_context;
  if (!ec) return false;
  const { independence } = resolveHandoffIndependence({
    verifierFamily: identity.agent_family,
    executorFamily: contract.executor_agent,
    verifierIdentity: identity,
    executorContext: ec,
  });
  return independence === 'self_report';
}
