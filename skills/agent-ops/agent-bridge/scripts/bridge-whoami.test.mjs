import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePsTable, resolveIdentity } from './bridge-whoami';

function tableFromRows(rows) {
  const lines = rows.map((r) => `  ${r.pid} ${r.ppid} ${r.comm}`);
  return parsePsTable(lines.join('\n'));
}

describe('bridge-whoami resolveIdentity', () => {
  it('claude → zsh → node: familia claude', () => {
    const ps = tableFromRows([
      { pid: 100, ppid: 99, comm: 'node' },
      { pid: 99, ppid: 50, comm: 'zsh' },
      { pid: 50, ppid: 1, comm: 'claude' },
    ]);
    const nodeArgs = new Map([[100, 'node /usr/bin/claude']]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 100,
      nodeArgsByPid: nodeArgs,
      env: {},
    });
    assert.equal(r.agent_family, 'claude');
    assert.equal(r.confidence, 'medium');
  });

  it('codex → zsh → node', () => {
    const ps = tableFromRows([
      { pid: 10, ppid: 9, comm: 'node' },
      { pid: 9, ppid: 8, comm: 'zsh' },
      { pid: 8, ppid: 1, comm: 'codex' },
    ]);
    const r = resolveIdentity({ psTable: ps, startPid: 10, env: {} });
    assert.equal(r.agent_family, 'codex');
  });

  it('anidado claude→codex→zsh→node gana codex (más cercano)', () => {
    const ps = tableFromRows([
      { pid: 1, ppid: 2, comm: 'node' },
      { pid: 2, ppid: 3, comm: 'zsh' },
      { pid: 3, ppid: 4, comm: 'codex' },
      { pid: 4, ppid: 5, comm: 'claude' },
    ]);
    const r = resolveIdentity({ psTable: ps, startPid: 1, env: {} });
    assert.equal(r.agent_family, 'codex');
    assert.ok(r.signals.some((s) => s.value === 'claude'));
  });

  it('cursor-agent en ascendencia', () => {
    const ps = tableFromRows([
      { pid: 7, ppid: 6, comm: 'node' },
      { pid: 6, ppid: 1, comm: 'cursor-agent' },
    ]);
    const r = resolveIdentity({ psTable: ps, startPid: 7, env: {} });
    assert.equal(r.agent_family, 'cursor');
  });

  it('zcode vía node .../zcode.mjs por basename', () => {
    const ps = tableFromRows([
      { pid: 20, ppid: 19, comm: 'node' },
      { pid: 19, ppid: 1, comm: 'zsh' },
    ]);
    const nodeArgs = new Map([[20, 'node /home/user/.zcode/runtime/current/bin/zcode.mjs -p hi']]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 20,
      nodeArgsByPid: nodeArgs,
      env: {},
    });
    assert.equal(r.agent_family, 'zcode');
  });

  it('sin agente en ascendencia → unknown con hints de env contaminado', () => {
    const ps = tableFromRows([
      { pid: 5, ppid: 4, comm: 'node' },
      { pid: 4, ppid: 1, comm: 'zsh' },
    ]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 5,
      env: {
        CLAUDECODE: '1',
        CODEX_SESSION_ID: 's1',
        GEMINI_API_KEY: 'secreto',
      },
    });
    assert.equal(r.agent_family, 'unknown');
    assert.equal(r.confidence, 'unknown');
    const json = JSON.stringify(r);
    assert.ok(!json.includes('secreto'));
  });

  it('entorno contradice ascendencia → medium + conflicts', () => {
    const ps = tableFromRows([
      { pid: 11, ppid: 10, comm: 'node' },
      { pid: 10, ppid: 1, comm: 'codex' },
    ]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 11,
      env: { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'abc' },
    });
    assert.equal(r.agent_family, 'codex');
    assert.equal(r.confidence, 'medium');
    assert.ok(r.conflicts.length > 0);
  });

  it('macOS: rutas completas en comm — cadena zsh→claude→tmux (medida)', () => {
    const ps = tableFromRows([
      { pid: 57028, ppid: 92160, comm: '/bin/zsh' },
      { pid: 92160, ppid: 28208, comm: '/home/user/.local/bin/claude' },
      { pid: 28208, ppid: 1, comm: 'tmux' },
    ]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 57028,
      env: { CLAUDE_CODE_SESSION_ID: 'sess-claude' },
      tmux: { pane_id: '%1', tmux_session: 'work' },
    });
    assert.equal(r.agent_family, 'claude');
    assert.equal(r.confidence, 'high');
    assert.ok(r.signals.some((s) => s.kind === 'ancestor' && s.value === 'claude'));
  });

  it('macOS: comm con ruta a cursor-agent', () => {
    const ps = tableFromRows([
      { pid: 100, ppid: 99, comm: '/home/user/.nvm/versions/node/v22.23.2/bin/node' },
      { pid: 99, ppid: 1, comm: '/home/user/.local/bin/cursor-agent' },
    ]);
    const r = resolveIdentity({ psTable: ps, startPid: 100, env: {} });
    assert.equal(r.agent_family, 'cursor');
  });

  it('macOS: node con ruta completa y args zcode.mjs', () => {
    const ps = tableFromRows([
      { pid: 20, ppid: 19, comm: '/home/user/.nvm/versions/node/v22.23.2/bin/node' },
      { pid: 19, ppid: 1, comm: '/bin/zsh' },
    ]);
    const nodeArgs = new Map([
      [
        20,
        'node /home/user/.zcode/runtime/current/bin/zcode.mjs --json',
      ],
    ]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 20,
      nodeArgsByPid: nodeArgs,
      env: {},
    });
    assert.equal(r.agent_family, 'zcode');
  });

  it('node /app/server.js --label codex-report → unknown (solo basename del script)', () => {
    const ps = tableFromRows([
      { pid: 2, ppid: 1, comm: 'node' },
      { pid: 1, ppid: 0, comm: 'kitty' },
    ]);
    const nodeArgs = new Map([[2, 'node /app/server.js --label codex-report']]);
    const r = resolveIdentity({
      psTable: ps,
      startPid: 2,
      nodeArgsByPid: nodeArgs,
      env: {},
    });
    assert.equal(r.agent_family, 'unknown');
  });

  it('macOS: anidado claude→codex con rutas completas; gana codex', () => {
    const ps = tableFromRows([
      { pid: 1, ppid: 2, comm: '/home/user/.nvm/versions/node/v22.23.2/bin/node' },
      { pid: 2, ppid: 3, comm: '/bin/zsh' },
      { pid: 3, ppid: 4, comm: '/home/user/.local/bin/codex' },
      { pid: 4, ppid: 5, comm: '/home/user/.local/bin/claude' },
    ]);
    const r = resolveIdentity({ psTable: ps, startPid: 1, env: {} });
    assert.equal(r.agent_family, 'codex');
    assert.ok(r.signals.some((s) => s.value === 'claude'));
  });

  it('copilot → bash → node (anidado bajo claude): gana copilot', () => {
    const ps = tableFromRows([
      { pid: 30, ppid: 29, comm: 'node' },
      { pid: 29, ppid: 28, comm: 'bash' },
      { pid: 28, ppid: 20, comm: 'copilot' },
      { pid: 20, ppid: 1, comm: 'claude' },
    ]);
    const r = resolveIdentity({ psTable: ps, startPid: 30, env: {} });
    assert.equal(r.agent_family, 'copilot');
    assert.equal(r.confidence, 'medium');
    assert.ok(r.signals.some((s) => s.value === 'claude'));
  });
});
