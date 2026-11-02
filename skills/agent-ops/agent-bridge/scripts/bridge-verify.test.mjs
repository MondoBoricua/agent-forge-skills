import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  extractContractJson,
  pathMatchesPattern,
  computeScopeViolations,
  buildVerificationReport,
  writeAtomic,
  checkLimitViolations,
  validateContract,
  inspectGitWorktree,
  parsePorcelainZ,
} from './bridge-verify';

const FULL_CONTRACT = {
  schema_version: 1,
  task_id: ['a'.repeat(8), ...Array(3).fill('a'.repeat(4)), 'a'.repeat(12)].join('-'),
  execution_id: ['b'.repeat(8), ...Array(3).fill('b'.repeat(4)), 'b'.repeat(12)].join('-'),
  parent_task_id: null,
  caller_agent: 'cursor',
  coordinator_agent: 'cursor',
  executor_agent: 'cursor',
  delegation_depth: 0,
  recovery_count: 0,
  round_count: 0,
  limits: { max_depth: 2, max_recoveries: 2, max_rounds: 3 },
  role: 'executor',
  status: 'submitted',
  objective: 'obj',
  scope: 'scope',
  constraints: [],
  context_refs: [],
  allowed_files: ['**'],
  forbidden_files: [],
  repo_root: '/tmp',
  worktree: '/tmp',
  branch: 'main',
  baseline_head: '',
  expected_artifacts: [],
  required_checks: [{ cmd: 'true', cwd: '.' }],
  completion_criteria: 'debe haber cambios',
  stop_conditions: 'none',
  evidence_required: [],
  result_path: 'data/briefs/example.md',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deadline: null,
  requires_changes: true,
};

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-verify-'));
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 't@test.local'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'base\n');
  spawnSync('git', ['add', 'README.md'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: dir });
  const base = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  return { dir, base };
}

function briefWithContract(dir, contract, extra = '') {
  const p = join(dir, 'brief.md');
  const body = `# brief\n\n\`\`\`json\n${JSON.stringify(contract, null, 2)}\n\`\`\`\n${extra}`;
  writeFileSync(p, body);
  return p;
}

describe('bridge-verify', () => {
  it('pathMatchesPattern: **/secret.txt y src/**/*.js', () => {
    assert.ok(pathMatchesPattern('**/secret.txt', 'a/b/secret.txt'));
    assert.ok(pathMatchesPattern('src/**/*.js', 'src/a/b/c.js'));
    assert.ok(pathMatchesPattern('src/**', 'src/foo/bar.js'));
    assert.ok(!pathMatchesPattern('src/**', 'lib/x.js'));
  });

  it('allowed vacío: cualquier cambio viola', () => {
    const v = computeScopeViolations(['secret.txt'], [], []);
    assert.equal(v.length, 1);
    assert.equal(v[0].reason, 'no_allowed_scope');
  });

  it('allowed/** + forbidden allowed/secret.txt', () => {
    const v = computeScopeViolations(['allowed/secret.txt'], ['allowed/**'], ['allowed/secret.txt']);
    assert.equal(v.length, 1);
    assert.equal(v[0].reason, 'forbidden');
  });

  it('nombre con espacio en ruta', () => {
    const v = computeScopeViolations(['secret file.txt'], ['**'], ['secret file.txt']);
    assert.equal(v.length, 1);
  });

  it('git baseline inválido → unverified inspection_error', () => {
    const { dir, base } = initRepo();
    const c = { ...FULL_CONTRACT, baseline_head: 'NONEXISTENT_SHA', allowed_files: ['**'] };
    const report = buildVerificationReport({
      contract: c,
      worktree: dir,
      runChecks: true,
      checkResults: [],
      verifierObserved: 'codex',
    });
    assert.equal(report.verification_verdict, 'unverified');
    assert.equal(report.unverified_reason, 'inspection_error');
    assert.ok(report.inspection_error);
    rmSync(dir, { recursive: true, force: true });
  });

  it('entrega correcta con artefacto y checks', () => {
    const { dir, base } = initRepo();
    writeFileSync(join(dir, 'out.txt'), 'ok');
    spawnSync('git', ['add', 'out.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'add'], { cwd: dir });
    const c = {
      ...FULL_CONTRACT,
      baseline_head: base,
      expected_artifacts: ['out.txt'],
      allowed_files: ['**'],
    };
    const report = buildVerificationReport({
      contract: c,
      worktree: dir,
      runChecks: true,
      checkResults: [{ cmd: 'true', cwd: dir, exit: 0, duration_ms: 1, stdout_tail: '', stderr_tail: '' }],
      verifierObserved: 'codex',
    });
    assert.equal(report.verification_verdict, 'evidence_ok');
    assert.equal(report.self_report, false);
    assert.equal(report.independence, 'observed_distinct');
    rmSync(dir, { recursive: true, force: true });
  });

  it('artefacto faltante', () => {
    const { dir, base } = initRepo();
    const c = { ...FULL_CONTRACT, baseline_head: base, expected_artifacts: ['missing.txt'], required_checks: [] };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.verification_verdict, 'evidence_failed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('artefacto preexistente sin cambio', () => {
    const { dir, base } = initRepo();
    const c = { ...FULL_CONTRACT, baseline_head: base, expected_artifacts: ['README.md'], required_checks: [] };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.artifacts[0].state, 'preexisting_unchanged');
    assert.equal(report.verification_verdict, 'evidence_failed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('artefacto binario en baseline sin cambio → preexisting_unchanged (bytes crudos)', () => {
    const { dir, base } = initRepo();
    const rel = 'artifact.bin';
    writeFileSync(join(dir, rel), Buffer.from([0x89, 0x50, 0xff, 0x00]));
    spawnSync('git', ['add', rel], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'bin'], { cwd: dir });
    const baseline = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    const c = {
      ...FULL_CONTRACT,
      baseline_head: baseline,
      expected_artifacts: [rel],
      required_checks: [],
    };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.artifacts[0].state, 'preexisting_unchanged');
    assert.equal(report.verification_verdict, 'evidence_failed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('archivo vacío en baseline sin cambio → preexisting_unchanged', () => {
    const { dir, base } = initRepo();
    const rel = 'empty.txt';
    writeFileSync(join(dir, rel), '');
    spawnSync('git', ['add', rel], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'empty'], { cwd: dir });
    const baseline = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    const c = {
      ...FULL_CONTRACT,
      baseline_head: baseline,
      expected_artifacts: [rel],
      required_checks: [],
    };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.artifacts[0].state, 'preexisting_unchanged');
    assert.equal(report.verification_verdict, 'evidence_failed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('binario modificado tras baseline → delivered', () => {
    const { dir, base } = initRepo();
    const rel = 'artifact.bin';
    writeFileSync(join(dir, rel), Buffer.from([0x89, 0x50, 0xff, 0x00]));
    spawnSync('git', ['add', rel], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'bin v1'], { cwd: dir });
    const baseline = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    writeFileSync(join(dir, rel), Buffer.from([0x89, 0x50, 0xff, 0x01]));
    spawnSync('git', ['add', rel], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'bin v2'], { cwd: dir });
    const c = {
      ...FULL_CONTRACT,
      baseline_head: baseline,
      expected_artifacts: [rel],
      required_checks: [],
      allowed_files: ['**'],
    };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.artifacts[0].state, 'delivered');
    rmSync(dir, { recursive: true, force: true });
  });

  it('violación de alcance', () => {
    const v = computeScopeViolations(['secret.txt'], ['README.md'], []);
    assert.ok(v.length > 0);
  });

  it('contador sobre el límite', () => {
    const v = checkLimitViolations({
      delegation_depth: 3,
      recovery_count: 0,
      round_count: 0,
      limits: { max_depth: 2, max_recoveries: 2, max_rounds: 3 },
    });
    assert.ok(v.length > 0);
  });

  it('self_report cuando verifier observado == executor', () => {
    const { dir, base } = initRepo();
    const c = { ...FULL_CONTRACT, baseline_head: base, executor_agent: 'cursor', required_checks: [] };
    const report = buildVerificationReport({
      contract: c,
      worktree: dir,
      verifierObserved: 'cursor',
    });
    assert.equal(report.self_report, true);
    assert.equal(report.independence, 'self_report');
    rmSync(dir, { recursive: true, force: true });
  });

  it('--verifier inventado no confiere independencia', () => {
    const { dir, base } = initRepo();
    const c = { ...FULL_CONTRACT, baseline_head: base, executor_agent: 'cursor' };
    const report = buildVerificationReport({
      contract: c,
      worktree: dir,
      runChecks: true,
      checkResults: [{ cmd: 'true', exit: 0, duration_ms: 0, stdout_tail: '', stderr_tail: '' }],
      verifierObserved: 'cursor',
      verifierDeclared: 'invented-independent',
    });
    assert.equal(report.independence, 'unknown');
    assert.ok(report.independence_note?.includes('difiere'));
    assert.equal(report.self_report, true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('validateContract rechaza contadores inválidos', () => {
    const bad = { ...FULL_CONTRACT, delegation_depth: -1 };
    assert.equal(validateContract(bad).ok, false);
    assert.equal(validateContract({ ...FULL_CONTRACT, task_id: FULL_CONTRACT.execution_id }).ok, false);
  });

  it('required_checks vacío con --run-checks → unverified no_checks_defined', () => {
    const { dir, base } = initRepo();
    const c = {
      ...FULL_CONTRACT,
      baseline_head: base,
      required_checks: [],
      status: 'submitted',
      requires_changes: false,
    };
    const report = buildVerificationReport({
      contract: c,
      worktree: dir,
      runChecks: true,
      checkResults: [],
      verifierObserved: 'codex',
    });
    assert.equal(report.verification_verdict, 'unverified');
    assert.equal(report.unverified_reason, 'no_checks_defined');
    rmSync(dir, { recursive: true, force: true });
  });

  it('status running sin checks → unverified not_submitted', () => {
    const { dir, base } = initRepo();
    const c = { ...FULL_CONTRACT, baseline_head: base, status: 'running', required_checks: [] };
    const report = buildVerificationReport({ contract: c, worktree: dir, runChecks: true, verifierObserved: 'codex' });
    assert.equal(report.unverified_reason, 'not_submitted');
    rmSync(dir, { recursive: true, force: true });
  });

  it('noop solo si requires_changes true', () => {
    const { dir, base } = initRepo();
    const c = {
      ...FULL_CONTRACT,
      baseline_head: base,
      requires_changes: false,
      completion_criteria: 'Investigación sin cambios de código',
      required_checks: [],
    };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.noop, false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('--out escribe contenido; fallo rename (ENOTEMPTY) no corrompe destino', () => {
    const { dir } = initRepo();
    const out = join(dir, 'report.json');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'keep.txt'), 'intact\n');
    let threw = false;
    try {
      writeAtomic(out, '{"ok":true}\n');
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
    assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'intact\n');
    const leftovers = spawnSync('ls', ['-a', dir], { encoding: 'utf8' }).stdout;
    assert.ok(!leftovers.includes('.report.json.tmp'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('artefacto directorio → is_directory y evidence_failed', () => {
    const { dir, base } = initRepo();
    mkdirSync(join(dir, 'bundle'), { recursive: true });
    writeFileSync(join(dir, 'bundle', 'inner.txt'), 'x');
    const c = {
      ...FULL_CONTRACT,
      baseline_head: base,
      expected_artifacts: ['bundle'],
      required_checks: [],
      requires_changes: false,
    };
    const report = buildVerificationReport({ contract: c, worktree: dir, verifierObserved: 'codex' });
    assert.equal(report.artifacts[0].state, 'is_directory');
    assert.equal(report.verification_verdict, 'evidence_failed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('cat-file -p falla con ruta en baseline → unverified inspection_error', () => {
    const { dir, base } = initRepo();
    writeFileSync(join(dir, 'README.md'), 'changed\n');
    const gitRun = (args) => {
      if (args[0] === 'cat-file' && args[1] === '-p') {
        return { code: 128, stdout: '', stderr: 'mock read fail' };
      }
      const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 30_000 });
      return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    };
    assert.equal(gitRun(['cat-file', '-e', `${base}:README.md`]).code, 0);
    const c = {
      ...FULL_CONTRACT,
      baseline_head: base,
      expected_artifacts: ['README.md'],
      required_checks: [],
      requires_changes: false,
    };
    const report = buildVerificationReport({
      contract: c,
      worktree: dir,
      verifierObserved: 'codex',
      artifactGitRun: gitRun,
    });
    assert.equal(report.verification_verdict, 'unverified');
    assert.equal(report.unverified_reason, 'inspection_error');
    assert.ok(report.inspection_error);
    rmSync(dir, { recursive: true, force: true });
  });

  it('validateContract enums y tipos estrictos', () => {
    assert.equal(validateContract({ ...FULL_CONTRACT, status: 'timeout' }).ok, false);
    assert.equal(validateContract({ ...FULL_CONTRACT, status: 'banana' }).ok, false);
    assert.equal(
      validateContract({ ...FULL_CONTRACT, status: 'interrupted', interrupt_class: 'bogus' }).ok,
      false,
    );
    assert.equal(validateContract({ ...FULL_CONTRACT, parent_task_id: { a: 1 } }).ok, false);
    assert.equal(validateContract({ ...FULL_CONTRACT, result_path: 42 }).ok, false);
  });

  it('CLI flags sin valor y flag desconocido → exit 3', () => {
    const scriptDir = import.meta.dirname;
    const { dir } = initRepo();
    const brief = join(dir, 'b.md');
    writeFileSync(brief, `# x\n\`\`\`json\n${JSON.stringify(FULL_CONTRACT)}\n\`\`\`\n`);
    const cases = [
      ['bridge-verify', '--worktree', dir, '--brief'],
      ['bridge-verify', '--worktree', dir, '--brief', brief, '--out'],
      ['bridge-verify', '--worktree', dir, '--brief', brief, '--verifier'],
      ['bridge-verify', '--worktree', dir, '--brief', brief, '--bogus'],
    ];
    for (const args of cases) {
      const r = spawnSync(process.execPath, args, { cwd: scriptDir, encoding: 'utf8' });
      assert.equal(r.status, 3);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('brief sin bloque JSON → exit 3', () => {
    const { dir } = initRepo();
    const brief = join(dir, 'bad.md');
    writeFileSync(brief, '# sin json\n');
    const r = spawnSync(
      process.execPath,
      ['bridge-verify', '--worktree', dir, '--brief', brief],
      { cwd: join(import.meta.dirname), encoding: 'utf8' },
    );
    assert.equal(r.status, 3);
    rmSync(dir, { recursive: true, force: true });
  });

  it('bloque JSON null → exit 3 sin stack', () => {
    const { dir } = initRepo();
    const brief = join(dir, 'null.md');
    writeFileSync(brief, '```json\nnull\n```\n');
    const r = spawnSync(
      process.execPath,
      ['bridge-verify', '--worktree', dir, '--brief', brief],
      { cwd: join(import.meta.dirname), encoding: 'utf8' },
    );
    assert.equal(r.status, 3);
    assert.ok(!r.stderr.includes('TypeError'));
    rmSync(dir, { recursive: true, force: true });
  });

  it('CLI --run-checks verde y rojo', () => {
    const { dir, base } = initRepo();
    writeFileSync(join(dir, 'deliver.txt'), 'd');
    spawnSync('git', ['add', 'deliver.txt'], { cwd: dir });
    spawnSync('git', ['commit', '-m', 'd'], { cwd: dir });
    const okContract = {
      ...FULL_CONTRACT,
      baseline_head: base,
      expected_artifacts: ['deliver.txt'],
      allowed_files: ['**'],
      required_checks: [{ cmd: 'true', cwd: dir }],
    };
    const briefOk = briefWithContract(dir, okContract);
    const scriptDir = import.meta.dirname;
    const okRun = spawnSync(
      process.execPath,
      ['bridge-verify', '--worktree', dir, '--brief', briefOk, '--run-checks', '--verifier', 'codex'],
      { cwd: scriptDir, encoding: 'utf8' },
    );
    assert.equal(okRun.status, 0);

    const failContract = { ...okContract, required_checks: [{ cmd: 'false', cwd: dir }] };
    const briefFail = briefWithContract(dir, failContract);
    const failRun = spawnSync(
      process.execPath,
      ['bridge-verify', '--worktree', dir, '--brief', briefFail, '--run-checks', '--verifier', 'codex'],
      { cwd: scriptDir, encoding: 'utf8' },
    );
    assert.equal(failRun.status, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('parsePorcelainZ enumera archivo en directorio untracked', () => {
    const z = '?? allowed/secret.txt\0';
    const files = parsePorcelainZ(z);
    assert.ok(files.has('allowed/secret.txt'));
  });
});

describe('extractContractJson', () => {
  it('parsea primer bloque', () => {
    const r = extractContractJson('text\n```json\n{"schema_version":1}\n```\n');
    assert.equal(r.contract.schema_version, 1);
  });
});
