# Brief template (Bridge 2.0)

Copy and fill in. Keep the JSON block at the end (or in a dedicated section) as the versioned contract.

---

## Objective

(What must be achieved, in one or two sentences.)

## Mandatory scripts

1. **At the start:** `bridge-whoami --json`: paste the full JSON output into the REPORT or into the executor's evidence section.
2. **At the close (coordinator):** `bridge-verify --worktree <path> --brief <this-file.md> [--run-checks] --json`: verification is not acceptance.

### With `bridge-handoff` (phase B)

Coordinator and executor use `--expect-revision` (read `revision` from the JSON) and a `--request-id` UUID per mutation:

```bash
# Coordinator
bridge-handoff new --input brief.json --request-id "<uuid>"
bridge-handoff status <TASK> --set verified --run-checks --expect-revision N --request-id "<uuid>" --note "..."
bridge-handoff status <TASK> --set accepted --expect-revision N --request-id "<uuid>" --note "..."

# Executor
bridge-handoff status <TASK> --set running --expect-revision N --request-id "<uuid>" --note "..."
bridge-handoff done <TASK> --result <FILE> --expect-revision N --request-id "<uuid>" --note "..."
```

The coordinator copies the `execution_token` from the output of `new` (or `--retry`/`--round`) into the prompt to the executor **or** exports `BRIDGE_EXECUTION_TOKEN` in its delegation environment. Do not paste the token into the brief or the REPORT; only the sha256 remains in the contract JSON.

## Acceptance criteria

- (Verifiable list; the coordinator or another agent decides acceptance, not the executor.)

## Required evidence

| Claim | Command | Expected output |
|---|---|---|
| | | |

## Allowed / forbidden files

- **Allowed:** …
- **Forbidden:** …

## Commands that must pass

```bash
# cwd: …
command
```

## Stop conditions

- Maximum time: …
- If you get blocked (permissions, ambiguous design, missing tool): **do not improvise outside the scope**; partial delivery + REPORT with what was done, what is pending and the concrete doubt; do not insist.

## verify-first

Apply `verify-first` (`~/.agents/skills/verify-first/SKILL.md`) before asserting anything: pair each claim with its command and output; label unmeasured claims as hypotheses.

## Contract (JSON)

```json
{
  "schema_version": 1,
  "task_id": "GENERATE-UUID",
  "execution_id": "GENERATE-UUID",
  "parent_task_id": null,
  "caller_agent": "unknown",
  "coordinator_agent": "unknown",
  "executor_agent": "unknown",
  "delegation_depth": 0,
  "recovery_count": 0,
  "round_count": 0,
  "limits": { "max_depth": 2, "max_recoveries": 2, "max_rounds": 3 },
  "role": "executor",
  "status": "assigned",
  "objective": "",
  "scope": "",
  "constraints": [],
  "context_refs": [],
  "allowed_files": [],
  "forbidden_files": [],
  "requires_changes": true,
  "interrupt_class": null,
  "outcome": null,
  "repo_root": "",
  "worktree": "",
  "branch": "",
  "baseline_head": "",
  "expected_artifacts": [],
  "required_checks": [],
  "completion_criteria": "",
  "stop_conditions": "",
  "evidence_required": [],
  "result_path": "",
  "created_at": "",
  "updated_at": "",
  "deadline": null,
  "revision": 1,
  "objective_key": "",
  "delegation_history": [],
  "execution_history": [],
  "ownership": { "repo_key": "", "paths": [], "execution_id": "" },
  "executor_context": null,
  "verification": null,
  "requests": {},
  "last_effect": null
}
```
