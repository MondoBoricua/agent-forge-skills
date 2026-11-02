# Handoff contract (Bridge 2.0)

Persistent brief: Markdown with **one** delimited JSON block (`schema_version: 1`). The file is the source of truth for counters and state; it survives agent and session changes.

## Rules

- `task_id` and `execution_id` are distinct UUIDs. Retrying after `interrupted|failed|cancelled` (with a documented `interrupt_class`) keeps the `task_id` and creates a new `execution_id`; whoever creates the execution increments `recovery_count`. **Timeout and disconnection are not `status` values:** they go as `status: "interrupted"` + `interrupt_class` (`timeout`, `disconnect`, `tool_error`, `rate_limit`, `context_exhausted`, `auth`, `safety_refusal`, `potential_false_positive`, `unknown`). Disconnection without a clear result: `interrupt_class: "disconnect"` + `outcome: "unknown"`.
- Every coordinator→executor handoff increments `delegation_depth` (root = 0; maximum 2). The executor does not re-delegate unless the brief explicitly authorizes it and depth remains.
- Every correction request from the coordinator on a `submitted` result increments `round_count` (maximum 3); a round is not a recovery.
- **Atomic** write: write to `.<name>.tmp` in the same directory and `rename` to the final destination.
- Forbidden: credentials, full chat histories, unnecessary private paths.
- The result goes back to the **original coordinator** (`coordinator_agent`); the executor presents `submitted`, never `verified` or `accepted`.
- Default path: `data/briefs/<task_id>.md` in the repo being worked on (or the folder the coordinator indicates).

## Minimum schema (v1)

```json
{
  "schema_version": 1,
  "task_id": "uuid",
  "execution_id": "uuid",
  "parent_task_id": null,
  "caller_agent": "claude|codex|cursor|agy|zcode|opencode|gemini|deepseek|unknown",
  "coordinator_agent": "family coordinating the root task",
  "executor_agent": "assigned executor family",
  "delegation_depth": 0,
  "recovery_count": 0,
  "round_count": 0,
  "limits": {
    "max_depth": 2,
    "max_recoveries": 2,
    "max_rounds": 3
  },
  "role": "coordinator|executor|verifier",
  "status": "draft|assigned|running|submitted|interrupted|blocked|failed|cancelled|verified|accepted",
  "interrupt_class": null,
  "outcome": null,
  "objective": "short text",
  "scope": "task scope",
  "constraints": [],
  "context_refs": [],
  "allowed_files": ["paths or globs relative to the worktree; empty = no changes allowed"],
  "forbidden_files": [],
  "requires_changes": true,
  "repo_root": "/path/to/repo",
  "worktree": "/path/to/worktree",
  "branch": "branch-name",
  "baseline_head": "git sha",
  "expected_artifacts": ["relative paths"],
  "required_checks": [{ "cmd": "command", "cwd": "path" }],
  "completion_criteria": "required outcome",
  "stop_conditions": "time limit, blockers, partial delivery",
  "evidence_required": ["command + expected output in REPORT"],
  "result_path": "string; empty if there is no primary deliverable besides the brief",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "deadline": null
}
```

### `status` transitions

`draft → assigned → running → submitted` is the executor's normal flow. Additionally: `interrupted`, `blocked`, `failed`, `cancelled`. Only the coordinator or an independent verifier writes `verified` or `accepted`; the executor does not. When `status` is `interrupted`, fill in `interrupt_class` (see rules above); do not use `timeout` or `disconnect` as a `status` value.

### Identity fields

- `caller_agent`: whoever performs the current operation (output of `bridge-whoami --json` → `agent_family`, or `unknown`).
- `coordinator_agent`: whoever coordinates the root task (the executor does not assume it when receiving a brief).
- `executor_agent`: whoever must execute this brief.

## B extensions (`bridge-handoff`)

Additional fields in the same JSON block (they still pass phase A's `validateContract`):

| Field | Use |
|---|---|
| `revision` | Integer ≥1; every confirmed mutation adds 1; `--expect-revision` mandatory |
| `objective_key` | sha256 of the normalized objective (NFC, lowercase, collapsed whitespace) |
| `delegation_history` | `{task_id, execution_id, from, to, objective_key, ts}`: ancestral chain |
| `execution_history` | Snapshots archived at `--retry` / `--round` |
| `ownership` | `{repo_key, paths[], execution_id}`; `repo_key` = resolved `git rev-parse --git-common-dir` |
| `executor_context` | On moving to `running`: `{family, sessions?, session_id, pid, host, cwd, started_at, model?, authorized_by?, identity_observed?}`; `sessions` is a map per provider (`claude`, `codex`, …) from the executor's env |
| `verification` | After `verified`: `{revision, verdict, report_sha256, report_path, verifier_context, worktree_head?}` |
| `verifier_agent` | Family designated as V (optional) |
| `requests` | Last 50 `{request_id → {payload_hash, result, ts}}` for idempotent replay |
| `last_effect` | `{event_id, log_line?, log_date?, pending, event?}`: journal protocol |
| `allow_overlap_recorded` | `true` if `new --allow-overlap` authorized an ownership overlap |
| `execution_token_sha256` | sha256 hex of the execution token (never the plain token in brief/journal/log) |

### Execution token (B2, sandboxed executors)

`bridge-handoff new` emits `execution_token` (32 random bytes in base64url) **once** in the CLI output; only `execution_token_sha256` remains in the contract. `--retry` and `--round` generate a new token (the previous one stops being valid). `show` and non-mutating `status` do not show the token.

If `bridge-whoami` returns `unknown` or a family different from `executor_agent`, the **executor's** mutations (`assigned→running`, `running↔blocked`, `done`, `→interrupted|failed` as E) are accepted only with `--token TOKEN` or `BRIDGE_EXECUTION_TOKEN` (constant-time sha256 comparison). The event and `executor_context` record `authorized_by: "execution_token"` and `identity_observed` (family + names of env signals, allowed session ids; no other environment values). `executor_agent` in the contract remains the coordinator's assignment, not the observed identity.

**They do not accept a token:** `new`, `--reconcile`, `unlock`, `cancelled`, `verified`, `accepted` (observed identity as before). If `verified`/`accepted` are invoked with `--token` or `BRIDGE_EXECUTION_TOKEN` → exit **1** `token_not_allowed_for_verifier`.

**What the token does NOT prove:** it does not replace independent verification on its own. The token only authorizes state mutations of the assigned brief.

**Independence and self_report (B8):**

- If the executor was left with `family: unknown` (e.g. authorized by `execution_token`), the sessions in its environment **are not attributed** to the executor: `self_report` only by **same `host`+`pid`**; if they do not match, `independence` is `unknown` (even if verifier and environment share a `CLAUDE_CODE_SESSION_ID` inherited from the coordinator).
- If the executor's observed family is **known**, the session of **that** family's provider (`executor_context.sessions[family]` or legacy `session_id`) is compared with the verifier's when both are the same family (e.g. verifier `claude` → `CLAUDE_CODE_SESSION_ID`; `codex` → `CODEX_SESSION_ID`/`CODEX_THREAD_ID`).
- Same family and a null session on either side → `self_report` (B3 #1).

Malformed tokens → exit **3** `token_invalid`; wrong hash → exit **1** `token_invalid`.

### Transitions (actor = observed family)

| From → to | Actor | Operation |
|---|---|---|
| (new) → `assigned` | C | `new` |
| `draft` → `assigned` | C | `status --set assigned` |
| `assigned` → `running` | E | `status --set running` |
| `running` ↔ `blocked` | E | `status --set` + note |
| `assigned|running|blocked` → `interrupted|failed` | E or C | `interrupted` requires `--class` |
| `assigned|running|blocked` → `cancelled` | C | |
| `running|blocked` → `submitted` | E | `done` |
| `submitted` → `verified` | C or V | `--run-checks` + `bridge-verify` |
| `verified` → `accepted` | C | explicit note |
| `submitted` → `assigned` | C | `new --round` |
| `interrupted|failed|cancelled` → `assigned` | C | `new --retry` |

### CLI exits

**0** success or identical replay · **1** transition/permission/cycle/scope/budget · **2** I/O · **3** usage/contract · **4** revision or `lock_busy`.

### Locks (D3)

Fixed order: `data/bridge/journal.lock` → `<brief>.lock`. Created with `wx`, body `{host,pid,ts,token}`; no lease. `bridge-handoff unlock TASK --force` only if the lock's `pid` is not alive on this host (`process.kill(pid,0)`).

### Coordinated ownership (D4)

Before `new`, if another **active** brief (`assigned|running|blocked|submitted`) of the same `repo_key` overlaps `ownership.paths` → exit **1** with `ownership_conflicts`, unless `--allow-overlap` (recorded in `allow_overlap_recorded`). There are no locks between worktrees.

### Journal (D5)

`data/bridge/events.jsonl`: `{ts, event_id, task_id, execution_id, from, to, by_agent, identity, revision, request_id, interrupt_class?, independence?}` with `event_id = sha256(task|execution|from|to|revision)`. Dedup by `event_id`. Terminal line in `data/logs/<YYYY-MM-DD>-log.md` (`America/Puerto_Rico` zone) only on `submitted|failed|cancelled|interrupted`, once per `execution_id`. Protocol: snapshot with `last_effect.pending=true` → append journal/log → `pending=false`. `status --reconcile` completes pending effects.

### Verification tied to revision (D6)

`verified` only if `bridge-verify` returns `evidence_ok` on the brief still `submitted` and `verification.revision` matches the contract's revision after confirming (re-read under lock). `independence` ∈ `{observed_distinct, same_family, self_report, unknown}`: `self_report` (same `host`+`pid`, or same provider session when the executor's family is known and matches the verifier's, or the B3 null-session rule) blocks `verified` and `accepted`; `same_family` may be accepted but must appear in the event and the output.

When the CLI's data root (`--root` / `ROOT`) is **inside** the contract's `worktree` (or is the same directory), `bridge-handoff` passes `buildVerificationReport` a contract **derived in memory only** whose `allowed_files` includes the globs of the handoff's own state (`data/briefs/**`, `data/bridge/**`, `data/logs/**`, prefixed if `ROOT` is a subdirectory of the worktree). Those paths do not count as a scope violation; the JSON report carries `state_paths_ignored` with the list of applied globs. If `ROOT` is outside the worktree, the contract is not altered for verification.

Errors when **creating** a lock: only `EEXIST` → exit **4** `lock_busy` (owner of the file). Any other `errno` in `openSync`/`writeFileSync` of the lock → exit **2** `lock_io` with `errno`, `path` and message (e.g. «no write permission in &lt;dir&gt;»).
