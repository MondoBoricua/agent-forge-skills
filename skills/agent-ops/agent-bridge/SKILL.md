---
name: agent-bridge
description: >-
  Multi-agent delegation and communication for Claude, Cursor, Codex, and agy. Use for closed briefs,
  isolated worktrees, cross-review, status requests, or "mándale esto al otro agente". Covers live
  sessions, headless CLIs, tmux, SSH, and Bridge 2.0 identity, handoff, and verification.
---

# Agent bridge

Choose the channel that reaches the intended agent and preserves the context the task needs.
Read `verify-first` before reporting success or accepting another agent's findings. A delegated
result is a hypothesis until the receiving coordinator verifies it.

## Choose a channel

| Channel | Destination | Context | Collect the answer |
|---|---|---|---|
| Native peer listing and messaging, such as `ListAgents` / `SendMessage` | Peers supported by that runtime | Existing thread | Use its completion notification or wait tool |
| `cursor-agent -p`, `codex exec`, `agy -p=` | New local agent | Full context must be in the brief | Read stdout, report, and exit status |
| `tmux send-keys` / `capture-pane` | Existing TUI session | Existing thread | Capture the pane; no push notification |
| `/usr/bin/ssh` plus `claude -p` | Remote account or machine | New brief, or explicitly resumed context | Collect JSON output and exit status |

Peer tools only list agents in their supported runtime and account. An absent peer entry does
not prove that an unrelated CLI or remote session is absent.

## Coordinate with economical models

Use a current economical model family for implementation, tests, bulk searches, and first-pass
reviews. Reserve stronger models for consequential design, production, authentication,
deployment, and difficult debugging decisions. Check the live catalog before pinning an ID;
examples include `gpt-6.1-sol`, `grok-4.7-medium-fast`, and `gemini-3.8-flash-low`.
These examples are not a current availability or pricing guarantee.

When acting as the stronger coordinator, plan, divide ownership, write closed briefs, evaluate
evidence, and integrate. Delegate mechanical execution. Take over after two consecutive live
verification failures on the same brief, or when a decision requires the coordinator's judgment.
An executor follows its assigned scope and does not take over root coordination.

Select destinations in this order: authorized scope, required tools and permissions, working
transport, known authentication or explicit `unknown`, then known available quota. Unknown quota
is not free quota. Do not route by anecdotal model scores.

## Isolate and close the brief

- Assign one worktree per executor: `git worktree add ../app-worker -b task/worker`.
- Prohibit commits to the production branch. The coordinator reviews, tests, and integrates.
- Run tasks in parallel only when allowed-file lists are disjoint and neither needs the other's
  output. Worktrees prevent interference during execution, not merge conflicts.
- State objective, branch, baseline commit, allowed and forbidden files, expected artifacts,
  completion criteria, commands and working directories, time limit, stop conditions, open
  questions, and the coordinator's live validation expectation.
- Identify existing uncommitted changes so an executor does not overwrite them. Include concrete
  code findings that avoid repeating research. Put durable context in the repository.
- Explicitly require `bridge-whoami`, `bridge-verify`, and `verify-first`; do not assume an agent
  will infer the relevant skills from a catalog.

Append this instruction to each brief:

> Apply `verify-first` (`~/.agents/skills/verify-first/SKILL.md`) before asserting anything.
> Supply a claim / command / output table. Mark unmeasured statements as hypotheses. Before
> concluding absence, show a reliable search and explain why an empty result is meaningful.
> End with what you did not verify.

Use [brief-template.md](references/brief-template.md) for the persistent brief and
[handoff-contract.md](references/handoff-contract.md) for the JSON contract.

## Bridge 2.0: identity and bounded handoffs

At delegation start and on receiving a brief, run `bridge-whoami --json`. Use its `agent_family`
as `caller_agent` unless the contract independently corroborates another identity. Inherited
environment signals can conflict; use `unknown` rather than guessing.

| Field | Responsibility |
|---|---|
| `caller_agent` | Current invoker, observed or `unknown` |
| `coordinator_agent` | Root coordinator; receiving a brief does not assign this role |
| `executor_agent` | Assigned executor |

| Counter | Increment | Maximum |
|---|---|---|
| `delegation_depth` | Each coordinator-to-executor handoff; root is zero | 2 |
| `recovery_count` | New execution after interrupted, failed, or cancelled execution of the same task | 2 |
| `round_count` | Coordinator correction after submission | 3 |

Do not re-delegate unless explicitly authorized and depth remains. A timeout is
`status: interrupted` with `interrupt_class: timeout`, never a separate status value.
A recovery retains `task_id`, creates `execution_id`, and increments the recovery counter.
A correction round is not a recovery.

Delivery, verification, and acceptance have separate owners:

| Stage | Owner | Meaning |
|---|---|---|
| `submitted` | Executor | Artifacts and report delivered |
| Evidence report | `bridge-verify` | Baseline diff, scope, artifacts, required checks |
| `verified` / `accepted` | Coordinator or permitted independent verifier | Contract transition and acceptance decision |

`bridge-verify` reports `evidence_ok`, `evidence_failed`, or `unverified`; it does not accept its
own result. Executor self-report is not independent verification.

### Automatic handoff

Every mutation needs a fresh request identifier and the current `--expect-revision`. Generate
identifiers at runtime rather than copying identifiers from another session.

```bash
bridge-handoff new --input brief.json --request-id "$(uuidgen)"
bridge-handoff status "$TASK" --set running --expect-revision 1 --request-id "$(uuidgen)" --note "Started"
bridge-handoff done "$TASK" --result ./REPORT.md --expect-revision 2 --request-id "$(uuidgen)" --note "Submitted"
bridge-handoff status "$TASK" --set verified --run-checks --expect-revision 3 --request-id "$(uuidgen)" --note "Checks collected"
bridge-handoff status "$TASK" --set accepted --expect-revision 4 --request-id "$(uuidgen)" --note "Accepted"
```

The `new` line belongs to the coordinator. The `running` and `done` lines belong to the
executor; verification and acceptance belong to the appropriate coordinator or verifier. Read the actual revision rather than assuming the
example values after a retry or correction.

If a sandbox prevents reliable identity observation, the coordinator supplies the one-time
`execution_token` emitted by `new`, `--retry`, or `--round` to the executor through its prompt or
`BRIDGE_EXECUTION_TOKEN`. Only its hash belongs in the contract. Do not put the token in reports,
logs, or the persistent brief. It authorizes executor mutations, not identity or independence.
Coordinator and verifier operations must not use a token.

The contract records ownership and prevents overlapping active briefs for the same repository
unless overlap is explicitly authorized. Revisions prevent stale writes; request IDs support
idempotent replay. Respect lock errors and do not force-unlock a live process. Journal effects
are persisted in `data/bridge/events.jsonl`; terminal deliveries are logged in
`data/logs/<date>-log.md`. Use reconciliation for a pending journal effect.

`bridge-handoff` exits: 0 success/replay, 1 transition/permission/cycle/scope/budget,
2 I/O, 3 usage/contract, 4 revision/lock. Follow the reference contract for detailed transitions,
lock ordering, state-path exclusions, and independence classifications.

## Headless local agents

A fresh agent needs the complete closed brief in its prompt or an accessible brief file.
Inspect installed CLI documentation and permissions before invoking these examples.

```bash
codex exec --skip-git-repo-check -C "$TASK_DIR" -m gpt-6.1-sol \
  -c model_reasoning_effort=medium -o "$TASK_DIR/REPORT.md" - < "$TASK_DIR/brief.md"
cursor-agent -p --mode ask --output-format text "Read-only question"
cursor-agent -p --trust --force --output-format stream-json --stream-partial-output \
  --model grok-4.7-medium-fast "$(cat "$TASK_DIR/brief.md")"
agy --model gemini-3.8-flash-low -p="$(cat "$TASK_DIR/brief.md")"
```

`--force` and other permission-bypass flags grant broad capabilities. Use only within the
user's authorized scope and an isolated workspace; do not assume local aliases provide them.
Check effective aliases and executable paths. Headless permission prompts can stall a job.
Attach agy's prompt to `-p=` to avoid argument ambiguity.

Cursor rules can depend on the working directory and its ancestors. Supply the full contract
when running outside the usual workspace; do not assume a home-directory rule is loaded.
For supported rule locations consult [Cursor CLI documentation](https://cursor.com/docs/cli/using)
and verify installed behavior with a harmless marker probe.

Keep the shell session until the process exits, collect its exit code and report, and notify the
user proactively. Use bounded waits and progress updates. Streamed JSON exposes progress;
text output may remain buffered. A reconnect message does not prove a job is still progressing.
Before retrying, inspect processes and artifacts to avoid duplicate work.

Cursor resumes must use the directory where the chat was created:
`cursor-agent --resume <session-id>`. For a long task, record the directory and session ID in a
private handoff, rather than relying on `--continue` from another folder.

## Existing sessions through tmux

Inspect before sending: identify the pane, current command, directory, and whether it is busy.

```bash
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} | #{pane_current_command} | #{pane_current_path}'
tmux capture-pane -p -t "$PANE" | tail -20
tmux send-keys -l -t "$PANE" 'Coordinator update: read the brief and report status.'
sleep 1
tmux send-keys -t "$PANE" Enter
tmux capture-pane -p -t "$PANE" | tail -30
```

Send one line, with `Enter` in a separate call. Introduce the sender and state whether a reply is
needed. Do not interrupt a busy session or send secrets into scrollback. Read the answer from
the pane; no notification is implied. Do not treat a grey suggested next prompt as a human draft.
Do not assume `C-u` clears another TUI's input.

If a window stops adapting to attached clients, inspect
`tmux show -wv -t "$PANE" window-size`. A manual resize can leave `window-size manual`;
consider `tmux setw -t "$PANE" window-size latest` after checking the session's needs.
Do not install global hooks or alter another session's configuration without authorization.

To change a live session's model, use its documented model command, submit separately, inspect
any confirmation, and verify the session's acknowledgement. A statusline may lag. Model changes
may also alter global defaults: back up and compare settings before and after, and restore only
the authorized change. A refusal is not a reason to switch models to evade it.

For a separate resumed Claude turn:

```bash
claude -p --resume "$SESSION_ID" --fork-session --model "$MODEL_ID" \
  --output-format json "Read the brief and answer the scoped question."
```

Fork when the original transcript may be live. Verify the returned session and effective model;
do not rely on a display alias.

## Claude Code on remote Windows through SSH

Use a remote machine only within its explicitly authorized scope. Shared folders can make
remote edits immediately visible locally; assign file ownership and designate who commits,
builds, and deploys. Never share platform-specific dependency directories across architectures.

1. Use `/usr/bin/ssh` for noninteractive PowerShell 5.1, bypassing terminal-specific SSH wrappers.
   Disable configured remote commands and TTY allocation for a scripted call.
2. Find the project path Claude actually registered with
   `Get-ChildItem $env:USERPROFILE\.claude\projects -Directory`. Resumption depends on cwd;
   mapped drives and junctions from a GUI session may be unavailable over SSH. Confirm with
   `Test-Path` and `Set-Location`.
3. Inspect `Get-Process claude`. If an existing session must be resumed while live, use
   `--fork-session`. Prefer a new session with a closed brief; resume only when its memory is needed.
4. Encode the script as base64 and write it to `$env:TEMP`. Verify transfer rather than trusting
   a successful-looking copy command.
5. PowerShell 5.1 native argument handling can truncate nested double quotes. Use an ASCII brief
   without embedded double quotes, a single-quoted here-string, and explicit output files.

```bash
cat > bridge.ps1 <<'PSEOF'
Set-Location 'C:\projects\app'
$extra = @()
if (Get-Process claude -ErrorAction SilentlyContinue) { $extra += '--fork-session' }
$msg = @'
Read CLAUDE.md and HANDOFF.md. Follow the closed brief. Report evidence. Do not commit.
'@
$out = Join-Path $env:TEMP 'bridge-result.json'
# New brief by default. To resume context, add --continue and @extra to this call.
& claude -p $msg --output-format json 2>&1 | Out-File $out -Encoding utf8
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$j = Get-Content $out -Raw | ConvertFrom-Json
Write-Output $j.result
PSEOF
BRIDGE_B64=$(base64 < bridge.ps1 | tr -d '\n')
/usr/bin/ssh -o RemoteCommand=none -o RequestTTY=no -o ConnectTimeout=8 example-host \
  "\$p = Join-Path \$env:TEMP 'bridge.ps1'; [IO.File]::WriteAllText(\$p, [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$BRIDGE_B64'))); powershell -NoProfile -ExecutionPolicy Bypass -File \$p" </dev/null
```

Configure only permissions already authorized for the task. If a shared repository triggers
Git ownership checks, inspect ownership and authorize only that specific safe directory;
do not disable the check globally. Validate live file access: an agent can answer from stale
conversation memory while its file tools are denied. Agree on platform-appropriate build commands.

## Additional channels

### DeepSeek harness

A headless harness such as `dsh --profile headless` needs its own verified credentials and
provider configuration. Supply credentials through the environment without printing them.
Inspect conflicting endpoint variables before overriding them. A profile may not share another
profile's credentials. Keep the task bounded and stop if the agent starts modifying launchers,
services, or authentication outside its brief. Confirm the installed model catalog and CLI syntax.

### OpenCode

Use `opencode run -m <provider>/<model> "Scoped question"` or its JSON mode after checking the
installed provider catalog and authentication. Free-tier availability and subscription coverage
must be measured, not assumed. A coding-plan key may differ from a standard API key.

For programmatic launches, set `PWD` to the absolute working directory as well as the process cwd:
Node `env: { ...process.env, PWD: cwd }`; Python `env["PWD"] = str(cwd)`. Disconnect stdin for
unattended calls. Verify tool writes in an isolated directory before assigning a real brief.
A fast single-turn answer does not establish reliability on multi-step execution. On timeout,
inspect and stop only the service/process belonging to this job; avoid a broad process-name kill.

### ZCode

Examples to check against the installed version:

```bash
zcode --cwd "$TASK_DIR" -p "$(cat "$TASK_DIR/brief.md")"
zcode --json -p "Scoped question"
zcode --mode guarded -p "Scoped question"
zcode -c -p "Continue the current directory's task"
zcode --resume "$SESSION_ID" -p "Continue the scoped task"
zcode doctor --json
```

Inspect permissions rather than inferring them from mode names. Sessions can be directory-specific.
JSON output may have a non-JSON preamble; validate it before parsing. Model selection may reside in
TUI or shared provider configuration rather than a headless flag. Do not edit that configuration
or perform login/logout as part of a bridge brief.

A desktop app and CLI can share credentials while requiring incompatible OAuth formats. Audit
installed documentation before changing authentication; do not reuse credentials blindly or log
out the desktop. Keep credentials and provider configuration out of reports.
For `EPIPE`, inspect the effective error classifier and distinguish local pipe failures from
network failures. Follow [zcode-epipe.md](references/zcode-epipe.md) for isolated diagnosis,
backup, regression, rollback, and explicit approval before altering signed application resources.
Past authorization never authorizes a future signed-app edit.

## Independent cross-review and escalation

For destructive, server, authentication, or deployment code, obtain at least two independent
reviews before integration. Each reviewer gets an isolated folder containing the same neutral
brief and code, without the other reviewers' findings in the first round.

1. Collect findings with file:line, reproduction, impact, and proposed fix.
2. Reproduce findings locally; agreement between agents is not proof.
3. For the next round give each reviewer its own previous findings and the updated code. Request
   resolved / partial / unresolved per item, plus new blockers only.
4. When reviewers disagree or a service is at risk, use a bounded confrontation round: anonymize
   and reorder the findings, ask each reviewer to confirm / refute / unknown with evidence.
5. Escalate after two live executor failures; add an independent reviewer for a blocking finding.
   After three nonconverging rounds, stop and provide the human with the state and open decision.
6. End when remaining differences are nonblocking nuance, recording known limits and the decision.

Record one durable log line per closed brief: agent, model, elapsed time, accepted / correction /
escalated / discarded, and the concrete failure or limitation. Derive future routing from measured
results rather than private anecdotes or fixed model stereotypes.

## Quota inspection

Use `scripts/agent-usage --json`, optionally `--only claude,codex` or `--no-cursor`, to inspect
supported channels before splitting work. Verify the installed script and returned schema.
Never print access tokens, account email addresses, or credential files.

| Channel | Inspection mechanism used by the helper |
|---|---|
| Claude Code | OAuth usage endpoint `https://api.anthropic.com/api/oauth/usage`; macOS credential lookup supplies the access token internally |
| Codex | `codex app-server`, initialize protocol, then `account/rateLimits/read` |
| Cursor | Isolated tmux session and interactive `/usage`, then capture and clean up that session |
| agy | `agy --output-format text -p='/usage'` |

Distinguish percent used from percent remaining, and record reset timestamps and unknown values.
Subscription buckets, third-party billing, and data policies differ; check them before selecting
a route. Do not infer a user's quota or prices from another installation's examples.

## Interruptions and collection

| Class | Minimum response |
|---|---|
| Timeout | `interrupted` / `timeout`; checkpoint, inspect process and artifacts before retry |
| Tool error | Record command, exit, evidence; repair only within scope; bounded retry |
| Disconnect | `interrupted` / `disconnect`, `outcome: unknown`; inspect before resending |
| Rate limit | Record window/reset; wait or use an authorized destination with known budget |
| Context exhausted | Durable checkpoint and new execution of the same task |
| Authentication | Block the route; no automatic logout/login |
| Safety refusal | Stop and preserve reason; never change agents to evade it |
| Possible false positive | Provisional classification and evidence; clarify scope or seek review |
| Unknown | Diagnose and deliver partial evidence; no destructive automatic recovery |

Do not end the coordinating turn with an authorized job uncollected unless the user asks.
For external CLIs use a persistent shell session and bounded waits. Read the final report, exit
status, diff, and required check results; verify the actual flow before acceptance.

## Included helpers

| Helper | Interface | Result |
|---|---|---|
| `bridge-whoami` | `[--json\|--text] [--panel <url>]` | Identity; 0 including unknown, 2 usage |
| `bridge-verify` | `--worktree <dir> --brief <file> [--run-checks] [--out <json>] [--verifier <family>]` | Evidence; 0 OK, 1 failed, 2 unverified, 3 usage |
| `bridge-handoff` | Contract operations described above and in the reference | Persistent state and journal |
| `agent-usage` | `--json`, channel filters | Usage inspection |
| `claude-auto` | Wrapper with `CLAUDE_AUTO_DRY=1` inspection | Conditional continuation based on history and existing processes |

Inspect `claude-auto` before installation: it contains executable-path and permission defaults
that must suit the local setup. Its process inspection is platform-sensitive. A dry run does
not establish that a real agent can authenticate or complete a task.

Related skills: `verify-first`, `shell-quirks`, and `skill-library`.
