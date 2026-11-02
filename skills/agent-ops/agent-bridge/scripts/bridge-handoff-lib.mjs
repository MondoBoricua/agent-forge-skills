/**
 * API de bridge-handoff (mutaciones con locks, journal, idempotencia).
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { buildVerificationReport, runRequiredChecks } from './bridge-verify';
import { loadBriefFile, writeBriefAtomic } from './bridge-handoff-brief.mjs';
import { acquireLock, releaseLock, forceUnlock } from './bridge-handoff-lock.mjs';
import {
  briefPath,
  briefLockPath,
  journalLockPath,
  resolveRepoRoot,
  resolveRepoKey,
  gitHead,
  isTaskUuid,
  validateScopePaths,
} from './bridge-handoff-paths.mjs';
import {
  computeObjectiveKey,
  visitedFamilies,
  validateHandoffContract,
} from './bridge-handoff-contract-b.mjs';
import { findOwnershipConflicts } from './bridge-handoff-ownership.mjs';
import {
  checkRequestReplay,
  storeRequestResult,
  hashPayload,
  findTaskIdByRequestRecord,
} from './bridge-handoff-requests.mjs';
import {
  allowedTransition,
  assertActor,
  validateInterruptClass,
  executorForbiddenMutation,
  needsTerminalLog,
} from './bridge-handoff-transitions.mjs';
import {
  computeEventId,
  buildLogLine,
  logDateForIso,
  readEventIds,
  appendEvent,
  appendLogLine,
  repairJournalTail,
  logHasExecutionMarker,
  findCreatedTaskByRequest,
} from './bridge-handoff-journal.mjs';
import { pickRetryRoundInput, assertAncestryNoCycle } from './bridge-handoff-input.mjs';
import {
  resolveHandoffIndependence,
  blocksVerifiedAccepted,
  buildSessionsFromIdentity,
} from './bridge-handoff-independence.mjs';
import {
  generateExecutionTokenPair,
  resolveExecutorAuthorization,
  envHasExecutionToken,
} from './bridge-handoff-execution-token.mjs';
import { eventsPath } from './bridge-handoff-paths.mjs';
import { deriveVerificationContract } from './bridge-handoff-verification.mjs';

function sha256File(path) {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function fail(code, message, extra = {}) {
  return { ok: false, exit: code, error: message, ...extra };
}

function okResult(data) {
  return { ok: true, exit: 0, ...data };
}

/** Crea data/{bridge,briefs,logs} antes de locks o journal (ROOT sin data/ es válido). */
export function ensureHandoffDataDirs(root) {
  for (const sub of ['bridge', 'briefs', 'logs']) {
    mkdirSync(join(root, 'data', sub), { recursive: true });
  }
}

/** The plaintext token must not persist in contract requests. */
function resultForRequests(result) {
  if (!result || typeof result !== 'object') return result;
  const { execution_token, ...rest } = result;
  return rest;
}

function identityBlocksMutation(identity) {
  return identity.agent_family === 'unknown';
}

/** Mapea fallo de acquireLock a exit CLI (4 busy, 2 E/S). */
function failFromLockAcquire(which, acquired) {
  if (acquired.reason === 'lock_busy') {
    return fail(4, 'lock_busy', { lock: which, owner: acquired.owner, path: acquired.path });
  }
  return fail(2, 'lock_io', {
    lock: which,
    errno: acquired.errno,
    path: acquired.path,
    message: acquired.message,
    hint: acquired.hint ?? null,
  });
}

/** Adquiere journal + brief lock en orden fijo. */
function withLocks(root, briefFile, fn) {
  ensureHandoffDataDirs(root);
  const jLock = journalLockPath(root);
  const bLock = briefLockPath(briefFile);
  const j = acquireLock(jLock);
  if (!j.ok) return failFromLockAcquire('journal', j);
  const b = acquireLock(bLock);
  if (!b.ok) {
    releaseLock(jLock, j.token);
    return failFromLockAcquire('brief', b);
  }
  try {
    return fn({ jLock, jToken: j.token, bLock, bToken: b.token });
  } finally {
    releaseLock(bLock, b.token);
    releaseLock(jLock, j.token);
  }
}

/** Completa last_effect pendiente (journal + log con dedup); solo bajo locks. */
function completePendingEffect(root, contract, markdown, briefFile, hooks) {
  const le = contract.last_effect;
  if (!le?.pending) return { contract, markdown, applied: false };
  const eventsFile = eventsPath(root);
  repairJournalTail(eventsFile);
  const known = readEventIds(eventsFile);
  let applied = false;
  if (le.event && !known.has(le.event_id)) {
    appendEvent(eventsFile, le.event);
    applied = true;
  }
  if (le.log_line && le.log_date) {
    const execId = le.event?.execution_id ?? contract.execution_id;
    if (!logHasExecutionMarker(root, execId, le.event?.ts)) {
      appendLogLine(root, le.log_date, le.log_line);
      applied = true;
    }
  }
  const updated = {
    ...contract,
    last_effect: { ...le, pending: false },
    updated_at: nowIso(),
  };
  const w = writeBriefAtomic(briefFile, markdown, updated);
  if (w.error) return { contract, markdown, applied: false, writeError: w.error };
  hooks?.afterSnapshot?.();
  const reloaded = loadBriefFile(briefFile);
  return {
    contract: reloaded.contract ?? updated,
    markdown: reloaded.markdown ?? markdown,
    applied,
  };
}

function buildEvent(contract, from, to, identity, requestId, revision, extra = {}) {
  const event_id = computeEventId({
    task_id: contract.task_id,
    execution_id: contract.execution_id,
    from,
    to,
    revision,
  });
  return {
    ts: nowIso(),
    event_id,
    task_id: contract.task_id,
    execution_id: contract.execution_id,
    from,
    to,
    by_agent: identity.agent_family,
    identity,
    revision,
    request_id: requestId,
    ...extra,
  };
}

function applyMutation({
  root,
  briefFile,
  expectRevision,
  requestId,
  payload,
  identity,
  identityPolicy = 'coordinator',
  executionToken = null,
  hooks,
  mutate,
}) {
  if (identityPolicy === 'coordinator' || identityPolicy === 'verifier') {
    if (identityBlocksMutation(identity)) {
      return fail(1, 'identity_unknown');
    }
  }
  const loaded = loadBriefFile(briefFile);
  if (loaded.error && loaded.error !== 'not_found') {
    return fail(2, loaded.error);
  }
  const inner = withLocks(root, briefFile, () => {
    const fresh = loadBriefFile(briefFile);
    if (fresh.error && fresh.error !== 'not_found') return fail(2, fresh.error);
    let c = fresh.contract;
    let md = fresh.markdown ?? markdown;
    let prepAppliedBeforeMutate = false;
    if (c) {
      const prep2 = completePendingEffect(root, c, md, briefFile, hooks);
      if (prep2.writeError) return fail(2, prep2.writeError);
      prepAppliedBeforeMutate = Boolean(prep2.applied);
      c = prep2.contract;
      md = prep2.markdown;
      const replay2 = checkRequestReplay(c, requestId, payload);
      if (replay2.action === 'replay') return okResult({ replay: true, result: replay2.result });
      if (replay2.action === 'conflict') return fail(1, 'request_id_payload_mismatch');
      if (c.revision !== expectRevision) {
        return fail(4, 'revision_mismatch', { expected: expectRevision, actual: c.revision });
      }
    }
    const mResult = mutate({ contract: c, markdown: md, prepAppliedBeforeMutate });
    if (!mResult.ok) return mResult;
    if (mResult.replay) return mResult;

    const {
      contract: newContract,
      markdown: newMd,
      from,
      to,
      result,
      independence,
      skipJournal,
    } = mResult;

    // reconcile / no-op: si no hay transición real, la revisión se queda igual
    const newRevision = skipJournal && from === to ? expectRevision : expectRevision + 1;
    let withReq = storeRequestResult(
      { ...newContract, revision: newRevision },
      requestId,
      hashPayload(payload),
      resultForRequests(result),
    );

    const event = skipJournal
      ? null
      : buildEvent(withReq, from, to, identity, requestId, newRevision, {
          ...(independence ? { independence } : {}),
          ...(mResult.eventExtra ?? {}),
        });

    let log_line = null;
    let log_date = null;
    if (event && needsTerminalLog(to)) {
      log_date = logDateForIso(event.ts);
      log_line = buildLogLine({
        contract: withReq,
        toStatus: to,
        note: payload.note || '',
        ts: event.ts,
      });
    }

    withReq = {
      ...withReq,
      last_effect: event
        ? {
            event_id: event.event_id,
            log_line,
            log_date,
            pending: true,
            event,
          }
        : withReq.last_effect ?? null,
    };

    const w1 = writeBriefAtomic(briefFile, newMd, withReq);
    if (w1.error) return fail(2, w1.error);
    hooks?.afterSnapshot?.();

    if (event) {
      const eventsFile = eventsPath(root);
      const known = readEventIds(eventsFile);
      if (!known.has(event.event_id)) appendEvent(eventsFile, event);
      if (log_line && log_date) appendLogLine(root, log_date, log_line);
    }

    withReq = {
      ...withReq,
      last_effect: withReq.last_effect ? { ...withReq.last_effect, pending: false } : null,
    };
    const w2 = writeBriefAtomic(briefFile, newMd, withReq);
    if (w2.error) {
      const persisted = loadBriefFile(briefFile);
      return fail(2, w2.error, {
        contract: persisted.contract ?? withReq,
        result: persisted.contract
          ? { revision: persisted.contract.revision, status: persisted.contract.status }
          : result,
      });
    }

    return okResult({ contract: withReq, result, from, to, event });
  });

  return inner;
}

function baseInputContract(input, root, repoKey, family) {
  const task_id = randomUUID();
  const execution_id = randomUUID();
  const ts = nowIso();
  const objective_key = computeObjectiveKey(input.objective);
  const paths = input.allowed_files ?? [];
  return {
    schema_version: 1,
    task_id,
    execution_id,
    parent_task_id: input.parent_task_id ?? null,
    caller_agent: family,
    coordinator_agent: family,
    executor_agent: input.executor_agent,
    delegation_depth: 0,
    recovery_count: 0,
    round_count: 0,
    limits: { max_depth: 2, max_recoveries: 2, max_rounds: 3 },
    role: 'executor',
    status: 'assigned',
    interrupt_class: null,
    outcome: null,
    objective: input.objective,
    objective_key,
    scope: input.scope,
    constraints: input.constraints ?? [],
    context_refs: input.context_refs ?? [],
    allowed_files: paths,
    forbidden_files: input.forbidden_files ?? [],
    requires_changes: input.requires_changes !== false,
    repo_root: root,
    worktree: input.worktree || root,
    branch: input.branch || 'main',
    baseline_head: input.baseline_head || '',
    expected_artifacts: input.expected_artifacts ?? [],
    required_checks: input.required_checks ?? [],
    completion_criteria: input.completion_criteria || '',
    stop_conditions: input.stop_conditions || '',
    evidence_required: input.evidence_required ?? [],
    result_path: input.result_path ?? '',
    created_at: ts,
    updated_at: ts,
    deadline: input.deadline ?? null,
    revision: 1,
    delegation_history: [],
    execution_history: [],
    ownership: { repo_key: repoKey, paths, execution_id },
    verifier_agent: input.verifier_agent ?? null,
    redelegation_allowed: input.redelegation_allowed ?? false,
    executor_context: null,
    verification: null,
    requests: {},
    last_effect: null,
    allow_overlap_recorded: false,
    execution_token_sha256: null,
  };
}

function attachExecutionToken(contract) {
  const { token, execution_token_sha256 } = generateExecutionTokenPair();
  return { contract: { ...contract, execution_token_sha256 }, execution_token: token };
}

/** Crea brief assigned bajo journal→brief lock con idempotencia por request_id. */
function createAssignedUnderLocks({
  root,
  briefFile,
  contract,
  markdown,
  identity,
  requestId,
  payload,
  result,
  hooks,
}) {
  return withLocks(root, briefFile, () => {
    const eventsFile = eventsPath(root);
    repairJournalTail(eventsFile);
    let existingId = findCreatedTaskByRequest(eventsFile, requestId);
    if (!existingId) {
      existingId = findTaskIdByRequestRecord(root, requestId);
    }
    const targetBriefFile = existingId ? briefPath(root, existingId) : briefFile;
    if (existingId) {
      const loaded = loadBriefFile(targetBriefFile);
      if (!loaded.error) {
        const prep = completePendingEffect(root, loaded.contract, loaded.markdown, targetBriefFile, hooks);
        if (prep.writeError) return fail(2, prep.writeError);
        let c = prep.contract;
        const replay = checkRequestReplay(c, requestId, payload);
        if (replay.action === 'replay') {
          return okResult({ contract: c, result: replay.result, replay: true });
        }
        if (replay.action === 'conflict') return fail(1, 'request_id_payload_mismatch');
      }
    }
    if (existsSync(targetBriefFile)) {
      const loaded = loadBriefFile(targetBriefFile);
      if (!loaded.error) {
        const replay = checkRequestReplay(loaded.contract, requestId, payload);
        if (replay.action === 'replay') return okResult({ contract: loaded.contract, result: replay.result, replay: true });
        if (replay.action === 'conflict') return fail(1, 'request_id_payload_mismatch');
      }
      return fail(2, 'brief_exists');
    }
    const { execution_token: _tok, ...storedResult } = result;
    let withReq = storeRequestResult({ ...contract, revision: 1 }, requestId, hashPayload(payload), storedResult);
    const event = buildEvent(withReq, 'none', 'assigned', identity, requestId, 1);
    const w1 = writeBriefAtomic(targetBriefFile, markdown, {
      ...withReq,
      last_effect: { event_id: event.event_id, pending: true, event, log_line: null, log_date: null },
    });
    if (w1.error) return fail(2, w1.error);
    hooks?.afterSnapshot?.();
    appendEvent(eventsFile, event);
    withReq = {
      ...withReq,
      last_effect: null,
    };
    const w2 = writeBriefAtomic(targetBriefFile, markdown, withReq);
    if (w2.error) {
      const persisted = loadBriefFile(targetBriefFile);
      return fail(2, w2.error, { contract: persisted.contract ?? withReq });
    }
    return okResult({ contract: withReq, result });
  });
}

function newHandoffPayload(input, meta) {
  return {
    op: 'new',
    input,
    parentTaskId: meta.parentTaskId ?? null,
    retryTaskId: meta.retryTaskId ?? null,
    roundTaskId: meta.roundTaskId ?? null,
    allowOverlap: meta.allowOverlap ?? false,
  };
}

export function handoffNew({
  root,
  inputPath,
  requestId,
  identity,
  parentTaskId,
  retryTaskId,
  roundTaskId,
  allowOverlap,
  confirmTerminated,
  expectRevision,
  hooks,
}) {
  if (identityBlocksMutation(identity)) return fail(1, 'identity_unknown');
  let input;
  try {
    input = JSON.parse(readFileSync(inputPath, 'utf8'));
  } catch {
    return fail(3, 'invalid_input');
  }
  if (!input.executor_agent || !input.objective) return fail(3, 'input_missing_fields');
  if (!validateScopePaths(input.allowed_files ?? [])) return fail(3, 'invalid_scope_paths');

  const repoKeyRes = resolveRepoKey(root);
  if (repoKeyRes.error) return fail(2, repoKeyRes.error);
  const family = identity.agent_family;
  if (!retryTaskId && !roundTaskId) {
    const conflicts = findOwnershipConflicts(root, repoKeyRes.repoKey, input.allowed_files ?? [], null);
    if (conflicts.length && !allowOverlap) {
      return fail(1, 'ownership_conflicts', { ownership_conflicts: conflicts });
    }
  }

  const payload = newHandoffPayload(input, { parentTaskId, retryTaskId, roundTaskId, allowOverlap });

  if (parentTaskId) {
    if (!isTaskUuid(parentTaskId)) return fail(3, 'invalid_task_id');
    const parentLoaded = loadBriefFile(briefPath(root, parentTaskId));
    if (parentLoaded.error) return fail(2, parentLoaded.error);
    const p = parentLoaded.contract;
    if (p.delegation_depth >= p.limits.max_depth) return fail(1, 'depth_budget');
    const objKey = computeObjectiveKey(input.objective);
    const delegation_history = [...(p.delegation_history || [])];
    const visited = visitedFamilies(delegation_history);
    const ancestryVisited = new Set([parentTaskId]);
    let walkId = parentTaskId;
    let ancestrySteps = 0;
    while (walkId) {
      if (ancestrySteps >= 32) return fail(1, 'ancestry_cycle');
      const w = loadBriefFile(briefPath(root, walkId));
      if (w.error) break;
      visited.add(w.contract.executor_agent);
      const nextParent = w.contract.parent_task_id;
      if (nextParent) {
        if (ancestryVisited.has(nextParent)) return fail(1, 'ancestry_cycle');
        ancestryVisited.add(nextParent);
      }
      walkId = nextParent;
      ancestrySteps += 1;
    }
    if (visited.has(input.executor_agent) && objKey === p.objective_key) {
      return fail(1, 'circular_delegation');
    }
    const ts = nowIso();
    delegation_history.push({
      task_id: p.task_id,
      execution_id: p.execution_id,
      from: p.coordinator_agent,
      to: input.executor_agent,
      objective_key: objKey,
      ts,
    });
    const child = baseInputContract(input, root, repoKeyRes.repoKey, family);
    child.parent_task_id = parentTaskId;
    child.coordinator_agent = p.coordinator_agent;
    child.delegation_depth = p.delegation_depth + 1;
    child.delegation_history = delegation_history;
    child.objective_key = objKey;
    child.allow_overlap_recorded = allowOverlap;
    const tok = attachExecutionToken(child);
    const childWithTok = tok.contract;
    const vP = validateHandoffContract(childWithTok);
    if (!vP.ok) return fail(3, 'invalid_contract', { detail: vP });
    const parentFile = briefPath(root, parentTaskId);
    const prepParent = withLocks(root, parentFile, () => {
      const pl = loadBriefFile(parentFile);
      if (pl.error) return fail(2, pl.error);
      completePendingEffect(root, pl.contract, pl.markdown, parentFile, hooks);
      return { ok: true };
    });
    if (!prepParent.ok) return prepParent;

    const briefFile = briefPath(root, childWithTok.task_id);
    const md = `# Brief ${childWithTok.task_id}\n\n## Objetivo\n\n${childWithTok.objective}\n`;
    const childPayload = payload;
    const childResult = {
      task_id: childWithTok.task_id,
      execution_id: childWithTok.execution_id,
      status: 'assigned',
      revision: 1,
      execution_token: tok.execution_token,
    };
    return createAssignedUnderLocks({
      root,
      briefFile,
      contract: childWithTok,
      markdown: md,
      identity,
      requestId,
      payload: childPayload,
      result: childResult,
      hooks,
    });
  }

  if (retryTaskId || roundTaskId) {
    const taskId = retryTaskId || roundTaskId;
    if (!isTaskUuid(taskId)) return fail(3, 'invalid_task_id');
    if (expectRevision === undefined || expectRevision === null) {
      return fail(3, 'expect_revision_required');
    }
    const briefFile = briefPath(root, taskId);
    const prev = loadBriefFile(briefFile);
    if (prev.error) return fail(2, prev.error);
    const p = prev.contract;
    if (identity.agent_family !== p.coordinator_agent) {
      return fail(1, 'not_coordinator');
    }

    const allowedInput = pickRetryRoundInput(input);
    const roundPaths = allowedInput.allowed_files ?? p.allowed_files;
    const roundConflicts = findOwnershipConflicts(root, repoKeyRes.repoKey, roundPaths, taskId);
    if (roundConflicts.length && !allowOverlap) {
      return fail(1, 'ownership_conflicts', { ownership_conflicts: roundConflicts });
    }

    return applyMutation({
      root,
      briefFile,
      expectRevision,
      requestId,
      payload,
      identity,
      identityPolicy: 'coordinator',
      hooks,
      mutate: ({ contract: c, markdown: md }) => {
        if (!c || c.task_id !== taskId) return fail(2, 'task_mismatch');
        if (retryTaskId) {
          if (!['interrupted', 'failed', 'cancelled'].includes(c.status)) {
            return fail(1, 'retry_invalid_status');
          }
          if (c.recovery_count >= c.limits.max_recoveries) return fail(1, 'recovery_budget');
          if (c.status === 'interrupted' && c.outcome === 'unknown' && !confirmTerminated) {
            return fail(1, 'confirm_terminated_required');
          }
        } else if (roundTaskId) {
          if (c.status !== 'submitted') return fail(1, 'round_invalid_status');
          if (c.round_count >= c.limits.max_rounds) return fail(1, 'round_budget');
        }

        const ancestry = assertAncestryNoCycle(root, c.task_id, c.parent_task_id);
        if (!ancestry.ok) return fail(1, ancestry.error);

        const hist = [...(c.execution_history || [])];
        hist.push({ ...snapshotExecution(c) });

        const execution_id = randomUUID();
        const ts = nowIso();
        const delegation_depth = c.delegation_depth;
        let recovery_count = c.recovery_count;
        let round_count = c.round_count;
        const delegation_history = [...(c.delegation_history || [])];
        const status = 'assigned';

        if (retryTaskId) recovery_count += 1;
        else round_count += 1;

        const tok = generateExecutionTokenPair();
        const next = {
          ...c,
          ...allowedInput,
          task_id: c.task_id,
          execution_id,
          parent_task_id: c.parent_task_id,
          role: c.role,
          requests: c.requests,
          caller_agent: family,
          coordinator_agent: c.coordinator_agent,
          executor_agent: allowedInput.executor_agent ?? c.executor_agent,
          objective: c.objective,
          delegation_depth,
          recovery_count,
          round_count,
          status,
          interrupt_class: null,
          outcome: null,
          execution_history: hist,
          delegation_history,
          objective_key: c.objective_key,
          ownership: {
            repo_key: repoKeyRes.repoKey,
            paths: roundPaths,
            execution_id,
          },
          executor_context: null,
          verification: null,
          last_effect: c.last_effect,
          execution_token_sha256: tok.execution_token_sha256,
          updated_at: ts,
          allow_overlap_recorded: allowOverlap || c.allow_overlap_recorded,
        };
        const v = validateHandoffContract({ ...next, revision: expectRevision + 1 });
        if (!v.ok) return fail(3, 'invalid_contract', { detail: v });
        return {
          ok: true,
          contract: next,
          markdown: md,
          from: c.status,
          to: status,
          result: {
            task_id: next.task_id,
            execution_id,
            status,
            revision: expectRevision + 1,
            execution_token: tok.token,
          },
        };
      },
    });
  }

  const base = baseInputContract(input, root, repoKeyRes.repoKey, family);
  base.allow_overlap_recorded = Boolean(allowOverlap);
  const tok = attachExecutionToken(base);
  const contract = tok.contract;
  const v = validateHandoffContract(contract);
  if (!v.ok) return fail(3, 'invalid_contract', { detail: v });

  const briefFile = briefPath(root, contract.task_id);
  const markdown = `# Brief ${contract.task_id}\n\n## Objetivo\n\n${contract.objective}\n`;
  const result = {
    task_id: contract.task_id,
    execution_id: contract.execution_id,
    status: 'assigned',
    revision: 1,
    execution_token: tok.execution_token,
  };
  return createAssignedUnderLocks({
    root,
    briefFile,
    contract,
    markdown,
    identity,
    requestId,
    payload,
    result,
    hooks,
  });
}

function snapshotExecution(c) {
  const { execution_history, requests, last_effect, ...rest } = c;
  return { ...rest, archived_at: nowIso() };
}

export function handoffStatusSet({
  root,
  taskId,
  state,
  expectRevision,
  requestId,
  note,
  identity,
  interruptClass,
  outcome,
  runChecks,
  executionToken = null,
  hooks,
}) {
  const briefFile = briefPath(root, taskId);
  if (!briefFile) return fail(3, 'invalid_task_id');
  if (state === 'verified' || state === 'accepted') {
    if (executionToken || envHasExecutionToken()) {
      return fail(1, 'token_not_allowed_for_verifier');
    }
  }

  const payload = { op: 'status_set', state, note, interruptClass, outcome, runChecks };
  const identityPolicy =
    state === 'verified' || state === 'accepted'
      ? 'verifier'
      : state === 'cancelled'
        ? 'coordinator'
        : 'executor';

  const pre = loadBriefFile(briefFile);
  if (pre.error) return fail(2, pre.error);
  const c0 = pre.contract;
  if (executorForbiddenMutation(c0, identity, state)) return fail(1, 'executor_cannot_verify_accept');

  let verificationReport = null;
  if (state === 'verified' && runChecks) {
    const derived = deriveVerificationContract(root, c0);
    const contractForVerify = derived?.contract ?? c0;
    verificationReport = buildVerificationReport({
      contract: contractForVerify,
      worktree: c0.worktree,
      runChecks: true,
      checkResults: runRequiredChecks(c0.required_checks),
      verifierObserved: identity.agent_family,
    });
    if (derived?.state_paths_ignored?.length) {
      verificationReport = {
        ...verificationReport,
        state_paths_ignored: derived.state_paths_ignored,
      };
    }
    if (verificationReport.verification_verdict !== 'evidence_ok') {
      return fail(1, 'verification_failed', { report: verificationReport });
    }
    verificationReport = {
      ...verificationReport,
      contrato_leido_al_inspeccionar: { revision: c0.revision },
    };
  }

  return applyMutation({
    root,
    briefFile,
    expectRevision,
    requestId,
    payload,
    identity,
    identityPolicy,
    executionToken,
    hooks,
    mutate: ({ contract: c, markdown: md }) => {
      if (!c) return fail(2, 'not_found');
      const from = c.status;
      if (!allowedTransition(from, state)) return fail(1, 'invalid_transition');

      let execAuth = null;
      const coordinatorOnly = state === 'cancelled' || state === 'verified' || state === 'accepted';
      if (!coordinatorOnly) {
        execAuth = resolveExecutorAuthorization({
          identity,
          contract: c,
          executionToken,
          from,
          to: state,
          op: 'status',
        });
        const needsTokenPath =
          identity.agent_family === 'unknown' ||
          (c.executor_agent && identity.agent_family !== c.executor_agent);
        if (needsTokenPath && !execAuth.ok) {
          return fail(execAuth.exit ?? 1, execAuth.error);
        }
      }

      const actor = assertActor({ contract: c, identity, from, to: state, op: 'status' });
      if (!actor.ok) {
        if (execAuth?.tokenAuthorized) {
          /* token cubre rol E cuando assertActor no coincide */
        } else {
          return fail(1, actor.reason);
        }
      }
      const ic = validateInterruptClass(state, interruptClass);
      if (!ic.ok) return fail(1, ic.reason);

      let independence = null;
      let verification = c.verification;

      if (state === 'verified') {
        const { independence: ind } = resolveHandoffIndependence({
          verifierFamily: identity.agent_family,
          executorFamily: c.executor_agent,
          verifierIdentity: identity,
          executorContext: c.executor_context,
        });
        independence = ind;
        if (blocksVerifiedAccepted(ind)) return fail(1, 'self_report_blocks_verified');
        if (!verificationReport || verificationReport.verification_verdict !== 'evidence_ok') {
          return fail(1, 'verification_required');
        }
        const readRev = c.revision;
        const inspectedRev = verificationReport.contrato_leido_al_inspeccionar?.revision;
        if (readRev !== expectRevision || inspectedRev !== expectRevision) {
          return fail(4, 'revision_mismatch', { expected: expectRevision, actual: readRev, inspectedRev });
        }
        const headAtInspect = verificationReport.git?.head;
        const headNow = gitHead(c.worktree);
        if (headAtInspect && headNow !== headAtInspect) {
          return fail(4, 'head_changed', { inspected: headAtInspect, current: headNow });
        }
        verification = {
          revision: expectRevision + 1,
          verdict: 'evidence_ok',
          report_sha256: createHash('sha256')
            .update(JSON.stringify(verificationReport), 'utf8')
            .digest('hex'),
          report_path: '',
          verifier_context: identity,
          worktree_head: headAtInspect ?? headNow,
          inspected_head: headAtInspect,
        };
      }

      if (state === 'accepted') {
        const { independence: ind } = resolveHandoffIndependence({
          verifierFamily: identity.agent_family,
          executorFamily: c.executor_agent,
          verifierIdentity: identity,
          executorContext: c.executor_context,
        });
        independence = ind;
        if (blocksVerifiedAccepted(ind)) return fail(1, 'self_report_blocks_accepted');
        if (!c.verification || c.verification.revision !== c.revision - 0) {
          /* accepted exige verification.revision == revision actual ANTES del bump */
        }
        if (!c.verification || c.verification.revision !== expectRevision) {
          return fail(1, 'verification_revision_mismatch');
        }
        if (c.verification.verdict !== 'evidence_ok') return fail(1, 'verification_not_ok');
      }

      let eventExtra = null;
      if (execAuth?.tokenAuthorized) {
        eventExtra = {
          authorized_by: 'execution_token',
          identity_observed: execAuth.identity_observed,
        };
      }

      if (state === 'running' && from === 'assigned') {
        // B8/B9: sesiones del ejecutor solo desde identity (whoami ya leyó env en la CLI).
        const ec = {
          family: execAuth?.tokenAuthorized ? 'unknown' : identity.agent_family,
          sessions: buildSessionsFromIdentity(identity),
          session_id: identity.session_id ?? null,
          pid: identity.pid,
          host: identity.host,
          cwd: identity.cwd,
          started_at: nowIso(),
          model: identity.model ?? null,
        };
        if (execAuth?.tokenAuthorized) {
          ec.authorized_by = 'execution_token';
          ec.identity_observed = execAuth.identity_observed;
        }
        c = { ...c, executor_context: ec };
      }

      const next = {
        ...c,
        status: state,
        caller_agent: identity.agent_family,
        updated_at: nowIso(),
        interrupt_class: state === 'interrupted' ? interruptClass : null,
        outcome: outcome ?? c.outcome,
        verification: state === 'verified' ? verification : c.verification,
      };
      if (state !== 'interrupted' && next.interrupt_class) next.interrupt_class = null;

      const v = validateHandoffContract({ ...next, revision: expectRevision + 1 });
      if (!v.ok) return fail(3, 'invalid_contract');

      return {
        ok: true,
        contract: next,
        markdown: md,
        from,
        to: state,
        independence,
        eventExtra,
        result: {
          task_id: c.task_id,
          status: state,
          revision: expectRevision + 1,
          independence,
        },
      };
    },
  });
}

export function handoffDone({
  root,
  taskId,
  resultPath,
  note,
  expectRevision,
  requestId,
  identity,
  executionToken = null,
  hooks,
}) {
  const briefFile = briefPath(root, taskId);
  if (!briefFile) return fail(3, 'invalid_task_id');
  if (!existsSync(resultPath)) return fail(2, 'result_missing');
  const hash = sha256File(resultPath);
  const payload = { op: 'done', resultPath, note, hash };

  return applyMutation({
    root,
    briefFile,
    expectRevision,
    requestId,
    payload,
    identity,
    identityPolicy: 'executor',
    executionToken,
    hooks,
    mutate: ({ contract: c, markdown: md }) => {
      if (!c) return fail(2, 'not_found');
      const from = c.status;
      if (!allowedTransition(from, 'submitted')) return fail(1, 'invalid_transition');

      const execAuth = resolveExecutorAuthorization({
        identity,
        contract: c,
        executionToken,
        from,
        to: 'submitted',
        op: 'done',
      });
      const needsTokenPath =
        identity.agent_family === 'unknown' ||
        (c.executor_agent && identity.agent_family !== c.executor_agent);
      if (needsTokenPath && !execAuth.ok) {
        return fail(execAuth.exit ?? 1, execAuth.error);
      }

      const actor = assertActor({ contract: c, identity, from, to: 'submitted', op: 'done' });
      if (!actor.ok && !execAuth?.tokenAuthorized) return fail(1, actor.reason);

      const eventExtra = execAuth?.tokenAuthorized
        ? { authorized_by: 'execution_token', identity_observed: execAuth.identity_observed }
        : null;

      const next = {
        ...c,
        status: 'submitted',
        result_path: resultPath,
        result_sha256: hash,
        caller_agent: identity.agent_family,
        updated_at: nowIso(),
      };
      return {
        ok: true,
        contract: next,
        markdown: md,
        from,
        to: 'submitted',
        eventExtra,
        result: { task_id: c.task_id, status: 'submitted', result_sha256: hash, revision: expectRevision + 1 },
      };
    },
  });
}

export function handoffShow({ root, taskId }) {
  const briefFile = briefPath(root, taskId);
  if (!briefFile) return fail(3, 'invalid_task_id');
  const loaded = loadBriefFile(briefFile);
  if (loaded.error) {
    if (loaded.error === 'not_found') return fail(2, 'brief_not_found');
    return fail(2, loaded.error);
  }
  return okResult({ contract: loaded.contract, markdown: loaded.markdown });
}

export function handoffReconcile({ root, taskId, expectRevision, requestId, identity, hooks }) {
  const briefFile = briefPath(root, taskId);
  if (!briefFile) return fail(3, 'invalid_task_id');
  if (identityBlocksMutation(identity)) return fail(1, 'identity_unknown');
  const payload = { op: 'reconcile' };
  return applyMutation({
    root,
    briefFile,
    expectRevision,
    requestId,
    payload,
    identity,
    hooks,
    mutate: ({ contract: c, markdown: md, prepAppliedBeforeMutate }) => {
      if (!c) return fail(2, 'not_found');
      const hadPending = Boolean(c.last_effect?.pending) || prepAppliedBeforeMutate;
      if (!hadPending) {
        return {
          ok: true,
          contract: c,
          markdown: md,
          from: c.status,
          to: c.status,
          skipJournal: true,
          result: { reconciled: false, revision: c.revision },
        };
      }
      const reconciled = Boolean(prepAppliedBeforeMutate);
      return {
        ok: true,
        contract: c,
        markdown: md,
        from: c.status,
        to: c.status,
        skipJournal: true,
        result: { reconciled, revision: c.revision },
      };
    },
  });
}

export function handoffUnlock({ root, taskId, force, identity, requestId, expectRevision }) {
  const briefFile = briefPath(root, taskId);
  if (!briefFile) return fail(3, 'invalid_task_id');
  if (!force) return fail(3, 'force_required');
  if (!requestId) return fail(3, 'request_id_required');
  if (identityBlocksMutation(identity)) return fail(1, 'identity_unknown');
  if (expectRevision === undefined || expectRevision === null) return fail(3, 'expect_revision_required');
  ensureHandoffDataDirs(root);
  const jLock = journalLockPath(root);
  const j = acquireLock(jLock);
  if (!j.ok) return failFromLockAcquire('journal', j);
  try {
    const loaded = loadBriefFile(briefFile);
    if (loaded.error) return fail(2, loaded.error);
    const c = loaded.contract;
    if (identity.agent_family !== c.coordinator_agent) return fail(1, 'not_coordinator');
    const payload = { op: 'unlock', force: true };
    const replay = checkRequestReplay(c, requestId, payload);
    if (replay.action === 'replay') return okResult({ replay: true, result: replay.result });
    if (replay.action === 'conflict') return fail(1, 'request_id_payload_mismatch');
    if (c.revision !== expectRevision) {
      return fail(4, 'revision_mismatch', { expected: expectRevision, actual: c.revision });
    }
    const lock = briefLockPath(briefFile);
    const r = forceUnlock(lock);
    if (!r.ok) return fail(1, r.reason, { owner: r.owner });
    const newRevision = expectRevision + 1;
    const result = { unlocked: true, revision: newRevision };
    let withReq = storeRequestResult({ ...c, revision: newRevision }, requestId, hashPayload(payload), result);
    const event = buildEvent(withReq, c.status, c.status, identity, requestId, newRevision, { unlock: true });
    repairJournalTail(eventsPath(root));
    appendEvent(eventsPath(root), event);
    const w = writeBriefAtomic(briefFile, loaded.markdown, withReq);
    if (w.error) return fail(2, w.error, { contract: c });
    return okResult({ contract: withReq, result });
  } finally {
    releaseLock(jLock, j.token);
  }
}

export function resolveRoot(rootOpt) {
  return resolveRepoRoot(rootOpt);
}
