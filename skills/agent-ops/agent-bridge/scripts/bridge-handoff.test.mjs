import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
  symlinkSync,
  renameSync,
  readdirSync,
  chmodSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolveIdentity } from './bridge-whoami';
import { extractContractJson, validateContract } from './bridge-verify';
import {
  handoffNew,
  handoffStatusSet,
  handoffDone,
  handoffShow,
  handoffReconcile,
  handoffUnlock,
} from './bridge-handoff-lib.mjs';
import { acquireLock, releaseLock } from './bridge-handoff-lock.mjs';
import { resolveHandoffIndependence } from './bridge-handoff-independence.mjs';
import { repairJournalTail } from './bridge-handoff-journal.mjs';
import { briefLockPath } from './bridge-handoff-paths.mjs';
import { eventsPath } from './bridge-handoff-paths.mjs';
import { writeBriefAtomic, loadBriefFile } from './bridge-handoff-brief.mjs';
import { logDateForIso } from './bridge-handoff-journal.mjs';
import { skipCliIfIdentityUnknown, withIsolatedVerifierSessionEnv } from './bridge-handoff-test-host.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const BRIDGE_HANDOFF_CLI = join(SCRIPTS_DIR, 'bridge-handoff');

const LIVE = resolveIdentity();
const COORD = LIVE.agent_family === 'unknown' ? 'cursor' : LIVE.agent_family;
const OTHER = COORD === 'codex' ? 'cursor' : 'codex';

function id(family, session = 'sess-a', pid = 1000) {
  return {
    schema_version: 1,
    agent_family: family,
    confidence: 'high',
    model: null,
    host: 'test-host',
    pid,
    ppid: 1,
    cwd: '/tmp',
    session_id: session,
    pane_id: null,
    tmux_session: null,
    signals: [],
    conflicts: [],
    hints: [],
    reason: 'test',
  };
}

function initRepoGitOnly() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-handoff-'));
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 't@test.local'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'base\n');
  spawnSync('git', ['add', 'README.md'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: dir });
  const base = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  return { dir, base };
}

function initRepo() {
  const { dir, base } = initRepoGitOnly();
  mkdirSync(join(dir, 'data', 'briefs'), { recursive: true });
  mkdirSync(join(dir, 'data', 'bridge'), { recursive: true });
  mkdirSync(join(dir, 'data', 'logs'), { recursive: true });
  return { dir, base };
}

function inputPayload(dir, base, executor, allowed = ['**'], objective = 'hacer la tarea de prueba') {
  return {
    executor_agent: executor,
    objective,
    scope: 'test',
    worktree: dir,
    branch: 'main',
    baseline_head: base,
    allowed_files: allowed,
    forbidden_files: [],
    expected_artifacts: [],
    required_checks: [{ cmd: 'true', cwd: dir }],
    completion_criteria: 'ok',
    stop_conditions: 'none',
    requires_changes: false,
  };
}

function writeInput(dir, data) {
  const p = join(dir, 'input.json');
  writeFileSync(p, JSON.stringify(data));
  return p;
}

describe('bridge-handoff', () => {
  it('01 contrato y ciclo normal new→running→done→verified→accepted con independence correcto', () => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD, 'c1', 10),
    });
    assert.equal(n.ok, true);
    const taskId = n.contract.task_id;
    let rev = 1;
    const run = handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: rev,
      requestId: randomUUID(),
      note: 'start',
      identity: id(OTHER, 'e1', 20),
    });
    assert.equal(run.ok, true);
    rev = run.contract.revision;
    const resultFile = join(dir, 'result.txt');
    writeFileSync(resultFile, 'done\n');
    const d = handoffDone({
      root: dir,
      taskId,
      resultPath: resultFile,
      note: 'entrega',
      expectRevision: rev,
      requestId: randomUUID(),
      identity: id(OTHER, 'e1', 20),
    });
    assert.equal(d.ok, true);
    rev = d.contract.revision;
    const v = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: rev,
      requestId: randomUUID(),
      note: 'verify',
      identity: id(COORD, 'c2', 30),
      runChecks: true,
    });
    assert.equal(v.ok, true);
    assert.equal(v.result.independence, 'observed_distinct');
    rev = v.contract.revision;
    const a = handoffStatusSet({
      root: dir,
      taskId,
      state: 'accepted',
      expectRevision: rev,
      requestId: randomUUID(),
      note: 'acepto',
      identity: id(COORD, 'c2', 30),
    });
    assert.equal(a.ok, true);
    assert.equal(a.contract.status, 'accepted');
    rmSync(dir, { recursive: true, force: true });
  });

  it('02 identidad: unknown no muta; ejecutor no puede verified/accepted; self_report bloqueado; same_family aceptado pero marcado', () => {
    // B9: con CLAUDE_CODE_SESSION_ID real en el host, la librería no debe leer process.env.
    const envSession = 'bridge-test-02-claude-env-session';
    const prevClaude = process.env.CLAUDE_CODE_SESSION_ID;
    process.env.CLAUDE_CODE_SESSION_ID = envSession;
    const F = 'claude';
    try {
      const { dir, base } = initRepo();
      const input = writeInput(dir, inputPayload(dir, base, F));
      const n = handoffNew({
        root: dir,
        inputPath: input,
        requestId: randomUUID(),
        identity: id(F),
      });
      const taskId = n.contract.task_id;
      const unk = handoffStatusSet({
        root: dir,
        taskId,
        state: 'running',
        expectRevision: 1,
        requestId: randomUUID(),
        note: 'x',
        identity: id('unknown'),
      });
      assert.equal(unk.ok, false);
      assert.equal(unk.exit, 1);
      handoffStatusSet({
        root: dir,
        taskId,
        state: 'running',
        expectRevision: 1,
        requestId: randomUUID(),
        note: 'go',
        identity: id(F, 'same', 99),
      });
      const show = handoffShow({ root: dir, taskId });
      const rev = show.contract.revision;
      writeFileSync(join(dir, 'r.txt'), 'x');
      handoffDone({
        root: dir,
        taskId,
        resultPath: join(dir, 'r.txt'),
        note: 'n',
        expectRevision: rev,
        requestId: randomUUID(),
        identity: id(F, 'same', 99),
      });
      const s2 = handoffShow({ root: dir, taskId });
      assert.equal(s2.contract.executor_context.sessions?.claude, 'same');
      const bad = handoffStatusSet({
        root: dir,
        taskId,
        state: 'verified',
        expectRevision: s2.contract.revision,
        requestId: randomUUID(),
        note: 'v',
        identity: id(F, 'same', 99),
        runChecks: true,
      });
      assert.equal(bad.ok, false);
      const v2 = handoffStatusSet({
        root: dir,
        taskId,
        state: 'verified',
        expectRevision: s2.contract.revision,
        requestId: randomUUID(),
        note: 'v',
        identity: id(F, 'v-other', 50),
        runChecks: true,
      });
      assert.equal(v2.ok, true);
      assert.equal(v2.result.independence, 'same_family');
      const acc = handoffStatusSet({
        root: dir,
        taskId,
        state: 'accepted',
        expectRevision: v2.contract.revision,
        requestId: randomUUID(),
        note: 'ok same family',
        identity: id(F, 'v-other', 50),
      });
      assert.equal(acc.ok, true);
      assert.equal(acc.result.independence, 'same_family');
      rmSync(dir, { recursive: true, force: true });
    } finally {
      if (prevClaude === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = prevClaude;
    }
  });

  it('03 revision y lock: dos escritores paralelos; lock presente exit 4; unlock --force', async () => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'r',
      identity: id(OTHER, 'e', 2),
    });
    const show = handoffShow({ root: dir, taskId });
    const rev = show.contract.revision;
    const req = randomUUID();
    const p1 = Promise.resolve(
      handoffStatusSet({
        root: dir,
        taskId,
        state: 'blocked',
        expectRevision: rev,
        requestId: req,
        note: 'b1',
        identity: id(OTHER, 'e', 2),
      }),
    );
    const p2 = Promise.resolve(
      handoffStatusSet({
        root: dir,
        taskId,
        state: 'blocked',
        expectRevision: rev,
        requestId: randomUUID(),
        note: 'b2',
        identity: id(OTHER, 'e', 2),
      }),
    );
    const [r1, r2] = await Promise.all([p1, p2]);
    const wins = [r1, r2].filter((r) => r.ok);
    const loses = [r1, r2].filter((r) => !r.ok && r.exit === 4);
    assert.equal(wins.length, 1);
    assert.equal(loses.length, 1);
    const briefFile = join(dir, 'data', 'briefs', `${taskId}.md`);
    const lock = acquireLock(briefLockPath(briefFile));
    assert.equal(lock.ok, true);
    const busy = handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: wins[0].contract.revision,
      requestId: randomUUID(),
      note: 'x',
      identity: id(OTHER, 'e', 2),
    });
    assert.equal(busy.exit, 4);
    releaseLock(lock.path, lock.token);
    const liveLock = acquireLock(briefLockPath(briefFile));
    assert.equal(liveLock.ok, true);
    const shUnlock = handoffShow({ root: dir, taskId });
    const deny = handoffUnlock({
      root: dir,
      taskId,
      force: true,
      identity: id(COORD),
      requestId: randomUUID(),
      expectRevision: shUnlock.contract.revision,
    });
    assert.equal(deny.ok, false);
    releaseLock(liveLock.path, liveLock.token);
    rmSync(dir, { recursive: true, force: true });
  });

  it('04 presupuestos: profundidad 3, recuperación 3 y ronda 4 rechazadas', () => {
    const { dir, base } = initRepo();
    const n1 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, ['depth0/**'], 'obj depth0')),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(n1.ok, true);
    const p1 = n1.contract.task_id;
    const n2 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'agy', ['depth1/**'], 'obj depth1')),
      requestId: randomUUID(),
      identity: id(COORD),
      parentTaskId: p1,
    });
    assert.equal(n2.ok, true, n2.error);
    const p2 = n2.contract.task_id;
    const n3 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'gemini', ['depth2/**'], 'obj depth2')),
      requestId: randomUUID(),
      identity: id(COORD),
      parentTaskId: p2,
    });
    assert.equal(n3.ok, true, n3.error);
    const deep = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
      parentTaskId: n3.contract.task_id,
    });
    assert.equal(deep.ok, false);
    assert.equal(deep.exit, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('05 verificación: checks verdes verified; rojos siguen submitted', () => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: '',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'out.txt'), 'x');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'out.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: id(OTHER),
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const brief = loadBriefQuick(dir, taskId);
    brief.required_checks = [{ cmd: 'false', cwd: dir }];
    writeFileSync(join(dir, 'data', 'briefs', `${taskId}.md`), patchBriefJson(brief));
    const failV = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: id(COORD),
      runChecks: true,
    });
    assert.equal(failV.ok, false);
    assert.equal(handoffShow({ root: dir, taskId }).contract.status, 'submitted');
    brief.required_checks = [{ cmd: 'true', cwd: dir }];
    writeFileSync(join(dir, 'data', 'briefs', `${taskId}.md`), patchBriefJson(brief));
    const good = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: id(COORD),
      runChecks: true,
    });
    assert.equal(good.ok, true);
    rmSync(dir, { recursive: true, force: true });
  });

  // Simula caída entre snapshot del brief y append al journal (hook afterSnapshot de la lib).
  it('06 journal y replay tras caída (hook afterSnapshot): reconcile CLI y idempotencia', (t) => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'go',
      identity: id(OTHER, 'e-crash', 21),
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'result-crash.txt'), 'entrega\n');
    const eventsBefore = readFileSync(eventsPath(dir), 'utf8');
    const doneReq = randomUUID();
    const doneNote = 'nota-terminal';
    let crashed = false;
    try {
      handoffDone({
        root: dir,
        taskId,
        resultPath: join(dir, 'result-crash.txt'),
        note: doneNote,
        expectRevision: sh.contract.revision,
        requestId: doneReq,
        identity: id(OTHER, 'e-crash', 21),
        hooks: {
          afterSnapshot() {
            crashed = true;
            throw new Error('simulated_crash_after_snapshot');
          },
        },
      });
    } catch (e) {
      assert.match(String(e.message), /simulated_crash/);
    }
    assert.equal(crashed, true);
    const briefAfter = handoffShow({ root: dir, taskId });
    assert.equal(briefAfter.contract.status, 'submitted');
    assert.equal(briefAfter.contract.last_effect?.pending, true);
    const eventsAfterCrash = readFileSync(eventsPath(dir), 'utf8');
    const newLines = eventsAfterCrash.slice(eventsBefore.length).trim();
    assert.equal(newLines, '');
    const rev = briefAfter.contract.revision;
    const reconcileReq = randomUUID();
    const liveId = resolveIdentity();
    if (liveId.agent_family === 'unknown') {
      const rec1 = handoffReconcile({
        root: dir,
        taskId,
        expectRevision: rev,
        requestId: reconcileReq,
        identity: id(COORD, 'coord-reconcile', 40),
      });
      assert.equal(rec1.ok, true, rec1.error);
    } else {
      skipCliIfIdentityUnknown(t);
      const cli1 = spawnSync(
        'node',
        [
          BRIDGE_HANDOFF_CLI,
          'status',
          taskId,
          '--reconcile',
          '--expect-revision',
          String(rev),
          '--request-id',
          reconcileReq,
          '--root',
          dir,
          '--json',
        ],
        { encoding: 'utf8' },
      );
      assert.equal(cli1.status, 0, cli1.stderr);
    }
    const eventsText = readFileSync(eventsPath(dir), 'utf8');
    const submittedEvents = eventsText
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((e) => e.to === 'submitted' && e.task_id === taskId);
    assert.equal(submittedEvents.length, 1);
    const logDate = logDateForIso(submittedEvents[0].ts);
    const logPath = join(dir, 'data', 'logs', `${logDate}-log.md`);
    assert.ok(existsSync(logPath));
    const logBody = readFileSync(logPath, 'utf8');
    const logLines = logBody.split('\n').filter((l) => l.startsWith('- '));
    assert.equal(logLines.length, 1);
    if (liveId.agent_family === 'unknown') {
      const rec2 = handoffReconcile({
        root: dir,
        taskId,
        expectRevision: rev,
        requestId: randomUUID(),
        identity: id(COORD, 'coord-reconcile', 41),
      });
      assert.equal(rec2.ok, true);
    } else {
      const cli2 = spawnSync(
        'node',
        [
          BRIDGE_HANDOFF_CLI,
          'status',
          taskId,
          '--reconcile',
          '--expect-revision',
          String(rev),
          '--request-id',
          randomUUID(),
          '--root',
          dir,
          '--json',
        ],
        { encoding: 'utf8' },
      );
      assert.equal(cli2.status, 0, cli2.stderr);
    }
    const eventsText2 = readFileSync(eventsPath(dir), 'utf8');
    const submitted2 = eventsText2
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((e) => e.to === 'submitted' && e.task_id === taskId);
    assert.equal(submitted2.length, 1);
    const logLines2 = readFileSync(logPath, 'utf8').split('\n').filter((l) => l.startsWith('- '));
    assert.equal(logLines2.length, 1);
    const replay = handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'result-crash.txt'),
      note: doneNote,
      expectRevision: rev,
      requestId: doneReq,
      identity: id(OTHER, 'e-crash', 21),
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.replay, true);
    assert.equal(replay.result.status, 'submitted');
    const conflict = handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'result-crash.txt'),
      note: 'otra-nota',
      expectRevision: rev,
      requestId: doneReq,
      identity: id(OTHER, 'e-crash', 21),
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.exit, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  // Atomicidad de escritura, rechazo de symlink en el path del brief y alcance inválido en new.
  it('07 atomicidad: rename fallido, symlink en brief y allowed_files inválidos en new', () => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    const briefFile = join(dir, 'data', 'briefs', `${taskId}.md`);
    const briefOrig = `${briefFile}.orig`;
    const originalMd = readFileSync(briefFile, 'utf8');
    renameSync(briefFile, briefOrig);
    mkdirSync(briefFile);
    writeFileSync(join(briefFile, 'keep.txt'), 'intact\n');
    const loaded = loadBriefFile(briefOrig);
    assert.equal(loaded.error, undefined);
    const badWrite = writeBriefAtomic(briefFile, loaded.markdown, loaded.contract);
    assert.equal(badWrite.error, 'write_failed');
    assert.equal(readFileSync(join(briefFile, 'keep.txt'), 'utf8'), 'intact\n');
    assert.equal(readFileSync(briefOrig, 'utf8'), originalMd);
    const briefDir = dirname(briefFile);
    const tmpLeft = readdirSync(briefDir).filter((f) => f.includes('.tmp.'));
    assert.equal(tmpLeft.length, 0);
    rmSync(briefFile, { recursive: true, force: true });
    renameSync(briefOrig, briefFile);

    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'r',
      identity: id(OTHER),
    });
    const realBrief = join(briefDir, `${taskId}-real.md`);
    renameSync(briefFile, realBrief);
    symlinkSync(realBrief, briefFile);
    const shLink = handoffShow({ root: dir, taskId });
    const viaSymlink = handoffStatusSet({
      root: dir,
      taskId,
      state: 'blocked',
      expectRevision: shLink.contract.revision,
      requestId: randomUUID(),
      note: 'symlink',
      identity: id(OTHER),
    });
    assert.equal(viaSymlink.ok, false);
    assert.equal(viaSymlink.exit, 2);
    assert.equal(viaSymlink.error, 'symlink_target');

    const absPaths = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, ['/etc/passwd'])),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(absPaths.ok, false);
    assert.equal(absPaths.exit, 3);
    const dotDot = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, ['../secret'])),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(dotDot.ok, false);
    assert.equal(dotDot.exit, 3);
    rmSync(dir, { recursive: true, force: true });
  });

  it('08 circular: A→B→A mismo objetivo rechazado', () => {
    const { dir, base } = initRepo();
    const obj = 'mismo objetivo circular';
    const n1 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, ['a/**'], obj)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const n2 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'agy', ['b/**'], obj)),
      requestId: randomUUID(),
      identity: id(COORD),
      parentTaskId: n1.contract.task_id,
    });
    assert.equal(n2.ok, true, n2.error);
    const circ = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, ['c/**'], obj)),
      requestId: randomUUID(),
      identity: id(COORD),
      parentTaskId: n2.contract.task_id,
    });
    assert.equal(circ.ok, false);
    assert.equal(circ.error, 'circular_delegation');
    rmSync(dir, { recursive: true, force: true });
  });

  it('09 mismo archivo: ownership_conflicts y --allow-overlap', () => {
    const { dir, base } = initRepo();
    const n1 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, ['src/shared.js'])),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const n2 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, COORD, ['src/shared.js'])),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(n2.ok, false);
    assert.ok(n2.ownership_conflicts?.length);
    const n3 = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, COORD, ['src/shared.js'])),
      requestId: randomUUID(),
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n3.ok, true);
    assert.equal(n3.contract.allow_overlap_recorded, true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('10 desconexión/resume: retry exige confirm-terminated', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: '',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'interrupted',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      note: 'disconnect',
      identity: id(OTHER),
      interruptClass: 'disconnect',
      outcome: 'unknown',
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const nope = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
      retryTaskId: taskId,
      expectRevision: sh2.contract.revision,
    });
    assert.equal(nope.ok, false);
    const ok = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
      retryTaskId: taskId,
      expectRevision: sh2.contract.revision,
      confirmTerminated: 'yes-terminated',
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.contract.recovery_count, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('11 regresión A: validateContract lee brief B y journal JSONL', () => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const brief = join(dir, 'data', 'briefs', `${n.contract.task_id}.md`);
    const md = readFileSync(brief, 'utf8');
    const ex = extractContractJson(md);
    assert.equal(ex.error, undefined);
    const v = validateContract(ex.contract);
    assert.equal(v.ok, true);
    const journal = readFileSync(eventsPath(dir), 'utf8');
    for (const line of journal.split('\n').filter(Boolean)) {
      JSON.parse(line);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('13 B2: ejecutor unknown + token correcto → running/done con authorized_by execution_token', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'codex')),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(n.ok, true);
    const taskId = n.contract.task_id;
    const token = n.result.execution_token;
    assert.ok(token);
    assert.ok(n.contract.execution_token_sha256);
    const run = handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'sandbox',
      identity: id('unknown', 'ambig', 77),
      executionToken: token,
    });
    assert.equal(run.ok, true);
    assert.equal(run.contract.executor_context.authorized_by, 'execution_token');
    const rev = run.contract.revision;
    writeFileSync(join(dir, 'tok-out.txt'), 'ok\n');
    const d = handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'tok-out.txt'),
      note: 'n',
      expectRevision: rev,
      requestId: randomUUID(),
      identity: id('unknown', 'ambig', 77),
      executionToken: token,
    });
    assert.equal(d.ok, true);
    const journal = readFileSync(eventsPath(dir), 'utf8');
    assert.ok(journal.includes('"authorized_by":"execution_token"'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('14 B2: token incorrecto → token_invalid; sin token → identity_unknown', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    const bad = handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'x',
      identity: id('unknown'),
      executionToken: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.exit, 1);
    assert.equal(bad.error, 'token_invalid');
    const noTok = handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'x',
      identity: id('unknown'),
    });
    assert.equal(noTok.ok, false);
    assert.equal(noTok.error, 'identity_unknown');
    rmSync(dir, { recursive: true, force: true });
  });

  it('15 B2: verified con BRIDGE_EXECUTION_TOKEN en env → token_not_allowed_for_verifier', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: '',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'v.txt'), 'x');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'v.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: id(OTHER),
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const prev = process.env.BRIDGE_EXECUTION_TOKEN;
    process.env.BRIDGE_EXECUTION_TOKEN = 'dummy';
    const v = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: id(COORD),
      runChecks: true,
    });
    if (prev === undefined) delete process.env.BRIDGE_EXECUTION_TOKEN;
    else process.env.BRIDGE_EXECUTION_TOKEN = prev;
    assert.equal(v.ok, false);
    assert.equal(v.error, 'token_not_allowed_for_verifier');
    rmSync(dir, { recursive: true, force: true });
  });

  it('16 B2: --retry invalida token anterior', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    const oldTok = n.result.execution_token;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: '',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'failed',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      note: 'fail',
      identity: id(OTHER),
    });
    const shFail = handoffShow({ root: dir, taskId });
    const retry = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
      retryTaskId: taskId,
      expectRevision: shFail.contract.revision,
      confirmTerminated: 'yes-terminated',
    });
    assert.equal(retry.ok, true);
    const newTok = retry.result.execution_token;
    assert.notEqual(oldTok, newTok);
    const stale = handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: retry.contract.revision,
      requestId: randomUUID(),
      note: 'x',
      identity: id('unknown'),
      executionToken: oldTok,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.error, 'token_invalid');
    rmSync(dir, { recursive: true, force: true });
  });

  it('17 B2: plaintext token no aparece en brief ni journal', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const token = n.result.execution_token;
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 't',
      identity: id('unknown'),
      executionToken: token,
    });
    const brief = readFileSync(join(dir, 'data', 'briefs', `${taskId}.md`), 'utf8');
    const journal = readFileSync(eventsPath(dir), 'utf8');
    assert.equal(brief.includes(token), false);
    assert.equal(journal.includes(token), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('18 B2: verificador claude sin self_report falso cuando ejecutor fue token+unknown', () => {
    const verifierSession = 'bridge-test-18-verifier-session';
    const sharedClaude = 'claude-session-inherited';
    const tokenExecutorCtx = {
      family: 'unknown',
      session_id: sharedClaude,
      pid: 88,
      host: 'test-host',
      authorized_by: 'execution_token',
    };
    const indLib = resolveHandoffIndependence({
      verifierFamily: 'claude',
      executorFamily: 'codex',
      verifierIdentity: id('claude', sharedClaude, 99),
      executorContext: tokenExecutorCtx,
      verifierEnv: { CLAUDE_CODE_SESSION_ID: verifierSession },
    });
    assert.equal(indLib.independence, 'unknown');
    assert.equal(indLib.self_report, false);

    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'codex')),
      requestId: randomUUID(),
      identity: id('claude', 'coord', 1),
    });
    const taskId = n.contract.task_id;
    const token = n.result.execution_token;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'sandbox',
      identity: {
        ...id('unknown', sharedClaude, 88),
        hints: [{ kind: 'env_only', families: ['codex', 'claude'] }],
      },
      executionToken: token,
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'sr.txt'), 'x');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'sr.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: id('unknown', sharedClaude, 88),
      executionToken: token,
    });
    const sh2 = handoffShow({ root: dir, taskId });
    withIsolatedVerifierSessionEnv(verifierSession, () => {
      const v = handoffStatusSet({
        root: dir,
        taskId,
        state: 'verified',
        expectRevision: sh2.contract.revision,
        requestId: randomUUID(),
        note: 'v',
        identity: id('claude', sharedClaude, 99),
        runChecks: true,
      });
      assert.equal(v.ok, true);
      assert.equal(v.result.independence, 'unknown');
      const acc = handoffStatusSet({
        root: dir,
        taskId,
        state: 'accepted',
        expectRevision: v.contract.revision,
        requestId: randomUUID(),
        note: 'ok',
        identity: id('claude', sharedClaude, 99),
      });
      assert.equal(acc.ok, true);
      assert.equal(acc.result.independence, 'unknown');
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('19 B3: session_id null → self_report (no same_family) en verify', () => {
    const ind = resolveHandoffIndependence({
      verifierFamily: 'codex',
      executorFamily: 'codex',
      verifierIdentity: id('codex', null, 10),
      executorContext: { family: 'codex', session_id: null, pid: 10, host: 'test-host' },
    });
    assert.equal(ind.independence, 'self_report');
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, COORD)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'r',
      identity: { ...id(COORD, null, 10), session_id: null },
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'z.txt'), 'x');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'z.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: { ...id(COORD, null, 10), session_id: null },
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const v = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: { ...id(COORD, null, 10), session_id: null },
      runChecks: true,
    });
    assert.equal(v.ok, false);
    assert.ok(['self_report_blocks_verified', 'executor_cannot_verify_accept'].includes(v.error));
    rmSync(dir, { recursive: true, force: true });
  });

  it('20 B3: retry no inyecta role/coordinator ni requests del input', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id('codex'),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: '',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'failed',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      note: 'fail',
      identity: id(OTHER),
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const poison = writeInput(dir, {
      ...inputPayload(dir, base, OTHER),
      role: 'coordinator',
      verifier_agent: 'claude',
      requests: { evil: { payload_hash: 'x', result: {}, ts: 't' } },
    });
    const badActor = handoffNew({
      root: dir,
      inputPath: poison,
      requestId: randomUUID(),
      identity: id('claude'),
      retryTaskId: taskId,
      expectRevision: sh2.contract.revision,
      confirmTerminated: 'yes-terminated',
    });
    assert.equal(badActor.ok, false);
    assert.equal(badActor.error, 'not_coordinator');
    const retry = handoffNew({
      root: dir,
      inputPath: poison,
      requestId: randomUUID(),
      identity: id('codex'),
      retryTaskId: taskId,
      expectRevision: sh2.contract.revision,
      confirmTerminated: 'yes-terminated',
    });
    assert.equal(retry.ok, true);
    assert.equal(retry.contract.role, 'executor');
    assert.equal(retry.contract.coordinator_agent, 'codex');
    assert.equal(retry.contract.requests.evil, undefined);
    rmSync(dir, { recursive: true, force: true });
  });

  it('21 B3: new idempotente mismo request_id; payload distinto → exit 1', () => {
    const { dir, base } = initRepo();
    const req = randomUUID();
    const p1 = join(dir, 'input-a.json');
    writeFileSync(p1, JSON.stringify(inputPayload(dir, base, OTHER, ['a/**'], 'obj A')));
    const n1 = handoffNew({
      root: dir,
      inputPath: p1,
      requestId: req,
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n1.ok, true);
    const p2 = join(dir, 'input-b.json');
    writeFileSync(p2, JSON.stringify(inputPayload(dir, base, OTHER, ['b/**'], 'obj B')));
    const n2 = handoffNew({
      root: dir,
      inputPath: p2,
      requestId: req,
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n2.ok, false);
    assert.equal(n2.exit, 1);
    const n3 = handoffNew({
      root: dir,
      inputPath: p1,
      requestId: req,
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n3.ok, true);
    assert.equal(n3.replay, true);
    assert.equal(n3.result.task_id, n1.contract.task_id);
    rmSync(dir, { recursive: true, force: true });
  });

  it('22 B3: journal parcial + repairJournalTail deja 1 línea válida', () => {
    const { dir, base } = initRepo();
    const ev = eventsPath(dir);
    const full = JSON.stringify({ event_id: 'a', task_id: 't', from: 'none', to: 'assigned' });
    writeFileSync(ev, `${full}\n${full.slice(0, 12)}`, 'utf8');
    const r = repairJournalTail(ev);
    assert.equal(r.repaired, true);
    const lines = readFileSync(ev, 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
    JSON.parse(lines[0]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('23 B3: unlock sin identidad de coordinador → identity_unknown', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    const u = handoffUnlock({
      root: dir,
      taskId,
      force: true,
      identity: id('unknown'),
      requestId: randomUUID(),
      expectRevision: 1,
    });
    assert.equal(u.ok, false);
    assert.equal(u.exit, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('24 B4: verified con alcance estrecho ignora estado handoff; otro.txt sigue violando', () => {
    const { dir, base } = initRepo();
    const allowed = ['entrega.txt'];
    const inputPath = join(tmpdir(), `handoff-input-${randomUUID()}.json`);
    writeFileSync(
      inputPath,
      JSON.stringify({
        ...inputPayload(dir, base, OTHER, allowed),
        expected_artifacts: ['entrega.txt'],
        requires_changes: true,
      }),
    );
    const n = handoffNew({
      root: dir,
      inputPath,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(n.ok, true);
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'go',
      identity: id(OTHER, 'e1', 20),
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'entrega.txt'), 'ok\n');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'entrega.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: id(OTHER, 'e1', 20),
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const v = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: id(COORD, 'c2', 30),
      runChecks: true,
    });
    assert.equal(v.ok, true, v.error);
    assert.equal(v.contract.status, 'verified');
    assert.ok(existsSync(eventsPath(dir)));

    const { dir: dir2, base: base2 } = initRepo();
    const inputPath2 = join(tmpdir(), `handoff-input-${randomUUID()}.json`);
    writeFileSync(
      inputPath2,
      JSON.stringify({
        ...inputPayload(dir2, base2, OTHER, allowed),
        expected_artifacts: ['entrega.txt'],
        requires_changes: true,
      }),
    );
    const n2 = handoffNew({
      root: dir2,
      inputPath: inputPath2,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId2 = n2.contract.task_id;
    handoffStatusSet({
      root: dir2,
      taskId: taskId2,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'go',
      identity: id(OTHER, 'example-host', 21),
    });
    const shB = handoffShow({ root: dir2, taskId: taskId2 });
    writeFileSync(join(dir2, 'entrega.txt'), 'ok\n');
    writeFileSync(join(dir2, 'otro.txt'), 'fuera\n');
    handoffDone({
      root: dir2,
      taskId: taskId2,
      resultPath: join(dir2, 'entrega.txt'),
      note: 'd',
      expectRevision: shB.contract.revision,
      requestId: randomUUID(),
      identity: id(OTHER, 'example-host', 21),
    });
    const shB2 = handoffShow({ root: dir2, taskId: taskId2 });
    const vBad = handoffStatusSet({
      root: dir2,
      taskId: taskId2,
      state: 'verified',
      expectRevision: shB2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: id(COORD, 'c4', 32),
      runChecks: true,
    });
    assert.equal(vBad.ok, false);
    assert.equal(vBad.error, 'verification_failed');
    assert.ok(vBad.report?.state_paths_ignored?.includes('data/briefs/**'));
    assert.ok(vBad.report?.scope_violations?.some((x) => x.path === 'otro.txt'));
    const stateOnly = (vBad.report?.scope_violations ?? []).filter((x) =>
      /^(data\/(briefs|bridge|logs)\/)/.test(x.path),
    );
    assert.equal(stateOnly.length, 0);
    rmSync(dir, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  });

  it('25 lock: EEXIST → lock_busy; ENOENT y EPERM → lock_io', () => {
    const { dir } = initRepo();
    const briefDir = join(dir, 'data', 'briefs');
    const lockPath = join(briefDir, 'probe.lock');
    const first = acquireLock(lockPath);
    assert.equal(first.ok, true);
    const busy = acquireLock(lockPath);
    assert.equal(busy.ok, false);
    assert.equal(busy.reason, 'lock_busy');
    assert.ok(busy.owner);
    releaseLock(lockPath, first.token);

    const missing = acquireLock(join(dir, 'no/existe/journal.lock'));
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'lock_io');
    assert.equal(missing.errno, 'ENOENT');
    assert.equal(missing.hint, 'el directorio no existe');
    assert.ok(missing.path);

    if (process.getuid?.() !== 0) {
      const bridgeDir = join(dir, 'data', 'bridge');
      chmodSync(bridgeDir, 0o555);
      const denied = acquireLock(join(bridgeDir, 'journal.lock'));
      assert.equal(denied.ok, false);
      assert.equal(denied.reason, 'lock_io');
      assert.match(denied.message, /sin permiso de escritura/);
      assert.equal(denied.hint, 'sin permiso de escritura');
      chmodSync(bridgeDir, 0o755);
    }
    const epermHarness = join(SCRIPTS_DIR, 'bridge-handoff-test-lock-eperm.mjs');
    const epermRun = spawnSync(process.execPath, [epermHarness], {
      encoding: 'utf8',
      cwd: SCRIPTS_DIR,
    });
    assert.equal(epermRun.status, 0, epermRun.stderr || epermRun.stdout);
    rmSync(dir, { recursive: true, force: true });
  });

  it('27 B5: new en ROOT sin data/ crea dirs; status lectura → brief_not_found sin locks', () => {
    const { dir, base } = initRepoGitOnly();
    assert.equal(existsSync(join(dir, 'data')), false);
    const inputPath = writeInput(dir, inputPayload(dir, base, COORD));
    const req = randomUUID();
    const libNew = handoffNew({
      root: dir,
      inputPath,
      requestId: req,
      identity: id(COORD, 'coord-b5', 50),
    });
    assert.equal(libNew.ok, true);
    assert.equal(libNew.result.status, 'assigned');
    assert.ok(existsSync(join(dir, 'data', 'bridge')));
    assert.ok(existsSync(join(dir, 'data', 'briefs')));
    assert.ok(existsSync(join(dir, 'data', 'logs')));

    if (resolveIdentity().agent_family !== 'unknown') {
      const { dir: dirCli, base: baseCli } = initRepoGitOnly();
      const inputCli = writeInput(dirCli, inputPayload(dirCli, baseCli, COORD));
      const reqCli = randomUUID();
      const created = spawnSync(
        process.execPath,
        [BRIDGE_HANDOFF_CLI, 'new', '--input', inputCli, '--request-id', reqCli, '--root', dirCli, '--json'],
        { encoding: 'utf8' },
      );
      assert.equal(created.status, 0, created.stderr || created.stdout);
      const out = JSON.parse(created.stdout);
      assert.equal(out.status, 'assigned');
      assert.ok(existsSync(join(dirCli, 'data', 'bridge')));
      rmSync(dirCli, { recursive: true, force: true });
    }

    const bare = initRepoGitOnly();
    const missingTask = randomUUID();
    const st = spawnSync(
      process.execPath,
      [BRIDGE_HANDOFF_CLI, 'status', missingTask, '--root', bare.dir, '--json'],
      { encoding: 'utf8' },
    );
    assert.equal(st.status, 2, st.stderr || st.stdout);
    assert.match(st.stderr, /brief_not_found/);
    assert.equal(existsSync(join(bare.dir, 'data', 'bridge', 'journal.lock')), false);
    rmSync(dir, { recursive: true, force: true });
    rmSync(bare.dir, { recursive: true, force: true });
  });

  it('26 B3: writeFileSync ENOSPC tras open wx limpia fd y archivo', () => {
    const scriptsDir = dirname(fileURLToPath(import.meta.url));
    const lockPath = join(tmpdir(), `bridge-lock-enospc-${randomUUID()}.lock`);
    const harness = `
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mock } from 'node:test';
const realFs = await import('node:fs');
mock.module('node:fs', {
  defaultExport: realFs.default,
  namedExports: {
    ...realFs,
    writeFileSync(fd, data, enc) {
      if (typeof fd === 'number') {
        const err = new Error('no space left');
        err.code = 'ENOSPC';
        throw err;
      }
      return realFs.writeFileSync(fd, data, enc);
    },
  },
});
const { acquireLock } = await import(${JSON.stringify(`file://${join(scriptsDir, 'bridge-handoff-lock.mjs')}`)} + '?enospc=' + Date.now());
const lockPath = ${JSON.stringify(lockPath)};
const r = acquireLock(lockPath);
assert.equal(r.ok, false);
assert.equal(r.reason, 'lock_io');
assert.equal(r.errno, 'ENOSPC');
assert.equal(existsSync(lockPath), false);
`;
    const run = spawnSync(
      process.execPath,
      ['--experimental-test-module-mocks', '--input-type=module', '-e', harness],
      { encoding: 'utf8', cwd: scriptsDir },
    );
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });

  it('12 rollback de datos: validateContract A lee brief B', () => {
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const md = readFileSync(join(dir, 'data', 'briefs', `${n.contract.task_id}.md`), 'utf8');
    const c = extractContractJson(md).contract;
    assert.equal(validateContract(c).ok, true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('28 B6 case-one: ejecutor con token mismo host/pid no puede verified/accepted', () => {
    const sharedPid = 4242;
    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'codex')),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    const token = n.result.execution_token;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'sandbox',
      identity: id('unknown', 'exec-sess', sharedPid),
      executionToken: token,
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'ent.txt'), 'ok\n');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'ent.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: id('unknown', 'exec-sess', sharedPid),
      executionToken: token,
    });
    const sh2 = handoffShow({ root: dir, taskId });
    const verifier = id('codex', 'ver-sess', sharedPid);
    const v = handoffStatusSet({
      root: dir,
      taskId,
      state: 'verified',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'v',
      identity: verifier,
      runChecks: true,
    });
    assert.equal(v.ok, false);
    assert.equal(v.exit, 1);
    assert.ok(['executor_cannot_verify_accept', 'self_report_blocks_verified'].includes(v.error));
    const acc = handoffStatusSet({
      root: dir,
      taskId,
      state: 'accepted',
      expectRevision: sh2.contract.revision,
      requestId: randomUUID(),
      note: 'a',
      identity: verifier,
    });
    assert.equal(acc.ok, false);
    assert.equal(acc.exit, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('29 B6 A2: replay new tras caída en afterSnapshot no duplica brief', () => {
    const { dir, base } = initRepo();
    const req = randomUUID();
    const inputPath = writeInput(dir, inputPayload(dir, base, OTHER));
    let crashed = false;
    try {
      handoffNew({
        root: dir,
        inputPath,
        requestId: req,
        identity: id(COORD),
        allowOverlap: true,
        hooks: {
          afterSnapshot() {
            if (!crashed) {
              crashed = true;
              throw new Error('simulated_crash_after_snapshot');
            }
          },
        },
      });
    } catch (e) {
      assert.match(String(e.message), /simulated_crash/);
    }
    assert.equal(crashed, true);
    const briefsBefore = readdirSync(join(dir, 'data', 'briefs')).filter((f) => f.endsWith('.md'));
    assert.equal(briefsBefore.length, 1);
    const n2 = handoffNew({
      root: dir,
      inputPath,
      requestId: req,
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n2.ok, true);
    assert.equal(n2.replay, true);
    const briefsAfter = readdirSync(join(dir, 'data', 'briefs')).filter((f) => f.endsWith('.md'));
    assert.equal(briefsAfter.length, 1);
    const events = readFileSync(eventsPath(dir), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((e) => e.to === 'assigned');
    assert.equal(events.length, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('30 B6 A3: write_failed al reconciliar pending impide otra mutación', () => {
    const scriptsDir = dirname(fileURLToPath(import.meta.url));
    const harness = `
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { mock } from 'node:test';
const realBrief = await import('./bridge-handoff-brief.mjs');
let failWrite = false;
mock.module('./bridge-handoff-brief.mjs', {
  defaultExport: realBrief,
  namedExports: {
    ...realBrief,
    writeBriefAtomic(...args) {
      if (failWrite) {
        failWrite = false;
        return { error: 'write_failed' };
      }
      return realBrief.writeBriefAtomic(...args);
    },
  },
});
const { handoffNew, handoffStatusSet, handoffDone, handoffShow, handoffReconcile } = await import('./bridge-handoff-lib.mjs');
function id(f,pid){return{schema_version:1,agent_family:f,confidence:'high',model:null,host:'test-host',pid,ppid:1,cwd:'/tmp',session_id:'s',pane_id:null,tmux_session:null,signals:[],conflicts:[],hints:[],reason:'t'};}
const dir=mkdtempSync(join(tmpdir(),'a3-'));
mkdirSync(join(dir,'data/briefs'),{recursive:true});
mkdirSync(join(dir,'data/bridge'),{recursive:true});
mkdirSync(join(dir,'data/logs'),{recursive:true});
const {spawnSync}=await import('node:child_process');
spawnSync('git',['init'],{cwd:dir});
spawnSync('git',['config','user.email','t@t'],{cwd:dir});
spawnSync('git',['config','user.name','t'],{cwd:dir});
writeFileSync(join(dir,'README.md'),'b\\n');
spawnSync('git',['add','README.md'],{cwd:dir});
spawnSync('git',['commit','-m','i'],{cwd:dir});
const base=spawnSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).stdout.trim();
const input={executor_agent:'codex',objective:'o',scope:'t',worktree:dir,branch:'main',baseline_head:base,allowed_files:['**'],forbidden_files:[],expected_artifacts:[],required_checks:[{cmd:'true',cwd:dir}],completion_criteria:'ok',stop_conditions:'n',requires_changes:false};
const ip=join(dir,'in.json');
writeFileSync(ip,JSON.stringify(input));
const n=handoffNew({root:dir,inputPath:ip,requestId:randomUUID(),identity:id('cursor',1)});
const taskId=n.contract.task_id;
handoffStatusSet({root:dir,taskId,state:'running',expectRevision:1,requestId:randomUUID(),note:'',identity:id('codex',2)});
const sh=handoffShow({root:dir,taskId});
writeFileSync(join(dir,'z.txt'),'x');
let crashed=false;
try{handoffDone({root:dir,taskId,resultPath:join(dir,'z.txt'),note:'n',expectRevision:sh.contract.revision,requestId:randomUUID(),identity:id('codex',2),hooks:{afterSnapshot(){crashed=true;throw new Error('crash');}}});}catch{}
assert.equal(crashed,true);
const shP=handoffShow({root:dir,taskId});
failWrite=true;
const rec=handoffReconcile({root:dir,taskId,expectRevision:shP.contract.revision,requestId:randomUUID(),identity:id('cursor',1)});
assert.equal(rec.ok,false);
assert.equal(rec.exit,2);
assert.equal(rec.error,'write_failed');
assert.equal(handoffShow({root:dir,taskId}).contract.last_effect?.pending,true);
rmSync(dir,{recursive:true,force:true});
`;
    const run = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', harness], {
      encoding: 'utf8',
      cwd: scriptsDir,
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });

  it('31 B6 H5: mismo request_id y path con contenido distinto → mismatch', () => {
    const { dir, base } = initRepo();
    const req = randomUUID();
    const p = join(dir, 'same-input.json');
    writeFileSync(p, JSON.stringify(inputPayload(dir, base, OTHER, ['a/**'], 'primera')));
    const n1 = handoffNew({
      root: dir,
      inputPath: p,
      requestId: req,
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n1.ok, true);
    writeFileSync(p, JSON.stringify(inputPayload(dir, base, OTHER, ['a/**'], 'segunda')));
    const n2 = handoffNew({
      root: dir,
      inputPath: p,
      requestId: req,
      identity: id(COORD),
      allowOverlap: true,
    });
    assert.equal(n2.ok, false);
    assert.equal(n2.exit, 1);
    assert.equal(n2.error, 'request_id_payload_mismatch');
    rmSync(dir, { recursive: true, force: true });
  });

  it('32 B6 H6: reconcile con efecto repuesto devuelve reconciled:true', () => {
    const { dir, base } = initRepo();
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = handoffNew({
      root: dir,
      inputPath: input,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'go',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    writeFileSync(join(dir, 'r.txt'), 'x');
    let crashed = false;
    try {
      handoffDone({
        root: dir,
        taskId,
        resultPath: join(dir, 'r.txt'),
        note: 'n',
        expectRevision: sh.contract.revision,
        requestId: randomUUID(),
        identity: id(OTHER),
        hooks: {
          afterSnapshot() {
            crashed = true;
            throw new Error('crash');
          },
        },
      });
    } catch {
      /* esperado */
    }
    assert.equal(crashed, true);
    const shP = handoffShow({ root: dir, taskId });
    const rec = handoffReconcile({
      root: dir,
      taskId,
      expectRevision: shP.contract.revision,
      requestId: randomUUID(),
      identity: id(COORD),
    });
    assert.equal(rec.ok, true);
    assert.equal(rec.result.reconciled, true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('33 B6 H10: padre autorreferente en new hijo → ancestry_cycle', () => {
    const { dir, base } = initRepo();
    const parent = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const parentId = parent.contract.task_id;
    const mdParent = readFileSync(join(dir, 'data', 'briefs', `${parentId}.md`), 'utf8');
    const c = extractContractJson(mdParent).contract;
    c.parent_task_id = parentId;
    writeFileSync(
      join(dir, 'data', 'briefs', `${parentId}.md`),
      mdParent.replace(/```json[\s\S]*?```/, `\`\`\`json\n${JSON.stringify(c, null, 2)}\n\`\`\``),
    );
    const child = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, COORD)),
      requestId: randomUUID(),
      identity: id(COORD),
      parentTaskId: parentId,
      allowOverlap: true,
    });
    assert.equal(child.ok, false);
    assert.equal(child.exit, 1);
    assert.equal(child.error, 'ancestry_cycle');
    rmSync(dir, { recursive: true, force: true });
  });

  it('34 B6 H12: round mismo alcance sin allow-overlap → exit 0', () => {
    const { dir, base } = initRepo();
    const allowed = ['src/**'];
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, allowed)),
      requestId: randomUUID(),
      identity: id(COORD),
    });
    const taskId = n.contract.task_id;
    handoffStatusSet({
      root: dir,
      taskId,
      state: 'running',
      expectRevision: 1,
      requestId: randomUUID(),
      note: 'go',
      identity: id(OTHER),
    });
    const sh = handoffShow({ root: dir, taskId });
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'x.txt'), 'x');
    handoffDone({
      root: dir,
      taskId,
      resultPath: join(dir, 'src', 'x.txt'),
      note: 'd',
      expectRevision: sh.contract.revision,
      requestId: randomUUID(),
      identity: id(OTHER),
    });
    const shSub = handoffShow({ root: dir, taskId });
    assert.equal(shSub.contract.status, 'submitted');
    const round = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, OTHER, allowed)),
      requestId: randomUUID(),
      identity: id(COORD),
      roundTaskId: taskId,
      expectRevision: shSub.contract.revision,
    });
    assert.equal(round.ok, true);
    assert.equal(round.exit, 0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('35 B8 T6: verificador claude con sesión heredada del coordinador no bloquea verified', () => {
    const inheritedClaude = 'coord-claude-session-inherited';
    const tokenExecutorCtx = {
      family: 'unknown',
      session_id: inheritedClaude,
      sessions: { claude: inheritedClaude },
      pid: 88,
      host: 'test-host',
      authorized_by: 'execution_token',
    };
    const indLib = resolveHandoffIndependence({
      verifierFamily: 'claude',
      executorFamily: 'codex',
      verifierIdentity: id('claude', inheritedClaude, 99),
      executorContext: tokenExecutorCtx,
      verifierEnv: { CLAUDE_CODE_SESSION_ID: inheritedClaude },
    });
    assert.equal(indLib.independence, 'unknown');
    assert.equal(indLib.self_report, false);

    const { dir, base } = initRepo();
    const n = handoffNew({
      root: dir,
      inputPath: writeInput(dir, inputPayload(dir, base, 'codex')),
      requestId: randomUUID(),
      identity: id('claude', 'coord', 1),
    });
    const taskId = n.contract.task_id;
    const token = n.result.execution_token;
    const tokenExecutorIdentity = {
      ...id('unknown', inheritedClaude, 88),
      sessions: { claude: inheritedClaude },
    };
    withIsolatedVerifierSessionEnv(inheritedClaude, () => {
      handoffStatusSet({
        root: dir,
        taskId,
        state: 'running',
        expectRevision: 1,
        requestId: randomUUID(),
        note: 'sandbox',
        identity: tokenExecutorIdentity,
        executionToken: token,
      });
      const sh = handoffShow({ root: dir, taskId });
      assert.equal(sh.contract.executor_context.sessions?.claude, inheritedClaude);
      writeFileSync(join(dir, 'sr.txt'), 'x');
      handoffDone({
        root: dir,
        taskId,
        resultPath: join(dir, 'sr.txt'),
        note: 'd',
        expectRevision: sh.contract.revision,
        requestId: randomUUID(),
        identity: tokenExecutorIdentity,
        executionToken: token,
      });
      const sh2 = handoffShow({ root: dir, taskId });
      const v = handoffStatusSet({
        root: dir,
        taskId,
        state: 'verified',
        expectRevision: sh2.contract.revision,
        requestId: randomUUID(),
        note: 'v',
        identity: id('claude', inheritedClaude, 99),
        runChecks: true,
      });
      assert.equal(v.ok, true, v.error || JSON.stringify(v));
      assert.equal(v.exit, 0);
      assert.equal(v.result.independence, 'unknown');
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it('35 B8: codex misma CODEX_SESSION_ID → self_report', () => {
    const shared = 'codex-shared-session';
    const ind = resolveHandoffIndependence({
      verifierFamily: 'codex',
      executorFamily: 'codex',
      verifierIdentity: { host: 'test-host', pid: 50, session_id: shared },
      executorContext: {
        family: 'codex',
        sessions: { codex: shared },
        session_id: shared,
        pid: 51,
        host: 'test-host',
      },
      verifierEnv: { CODEX_SESSION_ID: shared },
    });
    assert.equal(ind.independence, 'self_report');
    assert.equal(ind.self_report, true);
  });

  it('35 B8: claude ejecutor y verificador sesiones distintas → same_family', () => {
    const ind = resolveHandoffIndependence({
      verifierFamily: 'claude',
      executorFamily: 'claude',
      verifierIdentity: {
        agent_family: 'claude',
        host: 'test-host',
        pid: 60,
        session_id: 'claude-verifier',
      },
      executorContext: {
        family: 'claude',
        sessions: { claude: 'claude-executor' },
        session_id: 'claude-executor',
        pid: 61,
        host: 'test-host',
      },
      verifierEnv: { CLAUDE_CODE_SESSION_ID: 'claude-verifier' },
    });
    assert.equal(ind.independence, 'same_family');
    assert.equal(ind.self_report, false);
  });
});

function loadBriefQuick(root, taskId) {
  const md = readFileSync(join(root, 'data', 'briefs', `${taskId}.md`), 'utf8');
  return extractContractJson(md).contract;
}

function patchBriefJson(contract) {
  const md = readFileSync(join(contract.repo_root, 'data', 'briefs', `${contract.task_id}.md`), 'utf8');
  return md.replace(/```json[\s\S]*?```/, `\`\`\`json\n${JSON.stringify(contract, null, 2)}\n\`\`\``);
}

// D4: real CLI regression; every invocation uses this copy and this Node.
describe('D4 CLI token regressions', () => {
  function setupCli() {
    assert.notEqual(LIVE.agent_family, 'unknown', 'new requires observed coordinator identity');
    const { dir, base } = initRepo();
    const env = { ...process.env };
    delete env.BRIDGE_EXECUTION_TOKEN;
    const cli = (args, extraEnv = {}) => spawnSync(
      process.execPath, [BRIDGE_HANDOFF_CLI, ...args, '--root', dir, '--json'],
      { cwd: dir, env: { ...env, ...extraEnv }, encoding: 'utf8' },
    );
    const input = writeInput(dir, inputPayload(dir, base, OTHER));
    const n = cli(['new', '--input', input, '--request-id', randomUUID()]);
    assert.equal(n.status, 0, n.stderr || n.stdout);
    const created = JSON.parse(n.stdout);
    assert.equal(created.status, 'assigned');
    assert.ok(created.execution_token);
    const result = join(dir, 'result.txt');
    writeFileSync(result, 'CLI integration result\n');
    return { dir, cli, created, result };
  }

  for (const mode of ['flag', 'env']) {
    it(`D4 real new→running→submitted using token ${mode}`, () => {
      const { dir, cli, created, result } = setupCli();
      try {
        const authArgs = mode === 'flag' ? ['--token', created.execution_token] : [];
        const authEnv = mode === 'env' ? { BRIDGE_EXECUTION_TOKEN: created.execution_token } : {};
        const running = cli(['status', created.task_id, '--set', 'running',
          '--expect-revision', String(created.revision), '--request-id', randomUUID(),
          '--note', 'start CLI test', ...authArgs], authEnv);
        assert.equal(running.status, 0, running.stderr || running.stdout);
        const run = JSON.parse(running.stdout);
        assert.equal(run.status, 'running');
        const observedRun = JSON.parse(cli(['status', created.task_id]).stdout);
        assert.equal(observedRun.status, 'running');
        assert.equal(observedRun.contract.executor_context.authorized_by, 'execution_token');
        const done = cli(['done', created.task_id, '--result', result,
          '--expect-revision', String(run.revision), '--request-id', randomUUID(),
          '--note', 'submit CLI test', ...authArgs], authEnv);
        assert.equal(done.status, 0, done.stderr || done.stdout);
        assert.equal(JSON.parse(done.stdout).status, 'submitted');
        assert.equal(JSON.parse(cli(['status', created.task_id]).stdout).status, 'submitted');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it('D4 status/done reject --token without value even with valid env token', () => {
    const { dir, cli, created, result } = setupCli();
    try {
      const commands = [
        ['status', created.task_id, '--set', 'running', '--expect-revision', '1',
          '--request-id', randomUUID()],
        ['done', created.task_id, '--result', result, '--expect-revision', '1',
          '--request-id', randomUUID()],
      ];
      for (const args of commands) {
        for (const tokenValue of [[], ['']]) {
          const p = cli([...args, '--token', ...tokenValue],
            { BRIDGE_EXECUTION_TOKEN: created.execution_token });
          assert.equal(p.status, 3, p.stderr || p.stdout);
          assert.match(p.stderr, /Uso:/);
        }
      }
      // Also test a truly trailing flag, with no later --root option.
      for (const args of commands) {
        const trailing = spawnSync(process.execPath,
          [BRIDGE_HANDOFF_CLI, ...args, '--root', dir, '--json', '--token'],
          { cwd: dir, env: { ...process.env, BRIDGE_EXECUTION_TOKEN: created.execution_token },
            encoding: 'utf8' });
        assert.equal(trailing.status, 3, trailing.stderr || trailing.stdout);
        assert.match(trailing.stderr, /Uso:/);
      }
      assert.equal(JSON.parse(cli(['status', created.task_id]).stdout).status, 'assigned');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
