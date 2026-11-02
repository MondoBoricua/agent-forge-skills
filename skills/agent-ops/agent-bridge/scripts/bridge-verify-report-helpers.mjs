/**
 * Ensamblado del informe de verificación — helpers <50 líneas para bridge-verify.
 */
const TAIL_LINES = 20;

export function computeNoop(changed, contract) {
  const requires = contract.requires_changes !== false;
  return requires && changed.length === 0;
}

export function computeChecksStatus(runChecks, requiredChecks) {
  if (!runChecks) return 'not_run';
  if (!requiredChecks?.length) return 'none_required';
  return 'ran';
}

export function computeVerificationVerdict(ctx) {
  const {
    inspectionOk,
    contract,
    runChecks,
    checkResults,
    scope_violations,
    limit_violations,
    artifacts,
    noop,
  } = ctx;
  if (!inspectionOk) {
    return { verification_verdict: 'unverified', unverified_reason: 'inspection_error' };
  }
  if (contract.status !== 'submitted') {
    return { verification_verdict: 'unverified', unverified_reason: 'not_submitted' };
  }
  const delivered = (a) => a.state === 'delivered';
  if (
    scope_violations.length > 0 ||
    limit_violations.length > 0 ||
    !artifacts.every(delivered) ||
    noop
  ) {
    return { verification_verdict: 'evidence_failed', unverified_reason: null };
  }
  if (!runChecks) {
    return { verification_verdict: 'unverified', unverified_reason: 'checks_not_run' };
  }
  if (!contract.required_checks?.length) {
    return { verification_verdict: 'unverified', unverified_reason: 'no_checks_defined' };
  }
  const checksFailed = checkResults.some((c) => c.exit !== 0);
  if (checksFailed) {
    return { verification_verdict: 'evidence_failed', unverified_reason: null };
  }
  return { verification_verdict: 'evidence_ok', unverified_reason: null };
}

/** Objeto JSON del informe (sin side effects). */
export function assembleVerificationReportBody({
  SCHEMA_VERSION,
  verdict,
  delivery,
  verifierObserved,
  verifierDeclared,
  self_report,
  independence,
  independence_note,
  checks_status,
  checkResults,
  insp,
  inspectionOk,
  baseline,
  changed,
  scope_violations,
  artifacts,
  limit_violations,
  noop,
}) {
  const report = {
    schema_version: SCHEMA_VERSION,
    verification_verdict: verdict.verification_verdict,
    unverified_reason: verdict.unverified_reason,
    delivery,
    acceptance: 'pending',
    acceptance_note: 'la decide el coordinador u otro agente, no el ejecutor',
    verifier_observed: verifierObserved,
    verifier_declared: verifierDeclared,
    independence,
    independence_note,
    self_report,
    self_report_note: self_report
      ? 'verifier_observed coincide con executor_agent; no sirve para aceptación'
      : null,
    checks_status,
    git: {
      head: inspectionOk ? insp.head : null,
      baseline,
      diff_stat: inspectionOk ? insp.diff_stat : null,
      status_porcelain: inspectionOk ? insp.status_porcelain : null,
      changed_files: changed,
    },
    scope_violations,
    artifacts,
    limit_violations,
    noop,
    checks: checks_status === 'ran' ? checkResults : checks_status,
  };
  if (!inspectionOk) report.inspection_error = insp.inspection_error;
  return report;
}

/** Inspección + artefactos; propaga fallo de lectura git por artefacto. */
export function inspectWorktreeAndArtifacts({
  worktree,
  baseline,
  expectedArtifacts,
  gitInspection,
  inspectGitWorktree,
  artifactStatus,
  artifactGitRun,
}) {
  let insp = gitInspection ?? inspectGitWorktree(worktree, baseline);
  let inspectionOk = insp.ok;
  const artifacts = inspectionOk
    ? (expectedArtifacts || []).map((p) => artifactStatus(worktree, baseline, p, artifactGitRun))
    : (expectedArtifacts || []).map((p) => ({ path: p, state: 'missing' }));
  const artifactReadError = artifacts.find((a) => a.state === 'inspection_error');
  if (artifactReadError) {
    inspectionOk = false;
    insp = { ok: false, inspection_error: artifactReadError.inspection_error };
  }
  const changed = inspectionOk ? insp.changed_files : [];
  return { insp, inspectionOk, changed, artifacts };
}

export function gitInspectFailure(cmd, result) {
  const stderr = (result.stderr || '').trim();
  const lines = String(stderr).split('\n');
  return {
    cmd: `git -C <worktree> ${cmd}`,
    exit: result.code,
    stderr_tail: lines.slice(-TAIL_LINES).join('\n'),
  };
}
