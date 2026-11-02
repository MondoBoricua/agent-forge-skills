---
name: verify-first
description: >-
  Evidence-first troubleshooting, reviews, and system changes. Use before claiming success,
  absence, or impossibility; before changing configuration, PATH, services, permissions,
  or shells; and for "no funciona", "fix", or "broken". Measure locally, cite external
  facts, rehearse changes, verify backups, and repeat the same checks after applying them.
---

# Verify First

Analyze and verify before assuming. A confident assumption can mislead the user and
other agents. Every fact used to make a decision must be one of these:

1. **Measured:** the command and its output are available in this session.
2. **Cited:** an authoritative source is linked, with version or date where relevant.
3. **Hypothesis:** explicitly labeled, with the command or experiment that would confirm it.

Trace the actual code, load order, configuration, and process with `file:line` references.
Do not replace evidence with a description of how the system ought to work.

## Before concluding

Before claiming success, impossibility, or absence:

- Run the available, authorized, low-risk checks. Calling something a hypothesis does not
  replace investigating what can be measured.
- If a check is unavailable, explain the specific limitation and the check that would close it.
- Put each claim beside its evidence: command and output, number, HTTP status, or source quote.
  One citation at the start does not support unrelated claims later.
- Treat another agent's result, memory, or previous session as a hypothesis until independently
  verified. Distinguish reported results from checks performed here.

Optional audit hooks may record compliance or warn about shell failures. Their presence and
behavior must be inspected locally; never assume that a reminder enforces the rule.

## Identify the requested outcome

- A question or problem description asks for diagnosis: investigate, report findings, and stop
  before applying an unrequested fix.
- A requested change asks for working behavior with verification.
- Thinking aloud asks for judgment and a recommendation rather than action.

Use the session's actual authorization and scope; do not invent an approval requirement for
routine work already requested.

## Measure or research?

| Claim | Evidence |
|---|---|
| Local state, configuration, PATH, processes, versions, files | Measure on the relevant machine. Web results cannot establish local state. |
| Tool flags, defaults, limits, or load order | Read official documentation or implementation, then test a small example where practical. Inspect a tool's origin before executing its help command. |
| External hardware specifications, prices, published releases, or APIs | Consult current authoritative sources and cite the URL. |
| Another agent's or session's statement | Independently measure before relying on it. |

Use available documentation/search tools. State the limitation if none can check the claim.

## Audit → rehearse → back up → apply → verify

1. **Read-only audit:** locate each cause with `file:line`; inspect before editing.
2. **Baseline:** record the before state with the same check intended for the final state.
3. **Control:** demonstrate that the check detects the broken case. A fix requires the failure
   to disappear under the same check.
4. **Minimal proposal:** explain the specific change and scope. Obtain approval only when the
   action is outside existing authorization or the applicable boundary requires it.
5. **Isolated rehearsal:** test away from live state when a change could break it.
6. **Verified backup:** copy preserving metadata where appropriate, compare with `cmp`, and
   write the rollback procedure before editing.
7. **Apply:** preserve unrelated configuration, installer markers, and comments.
8. **Verify:** run the same before/after check and one real end-to-end flow. For a script,
   include syntax checking, ShellCheck when available, and execution. If a check itself is
   faulty, prove that separately. Restore the verified backup if the change fails.
9. **Review and record:** inspect the final diff for scope errors; record what changed,
   backup location, evidence, and remaining limitations. Keep learning notes append-only;
   correct old conclusions with a new entry rather than silently rewriting history.

Signals can mislead. Confirm that evidence supports the concrete restart, deletion, or edit.
Inspect an unfamiliar target before overwriting or deleting it.

## Rehearse without disturbing live state

| Target | Method |
|---|---|
| zsh configuration | Copy into an isolated directory and use `ZDOTDIR=<directory> zsh -l -i -c …`. |
| fish or another shell | Use a minimal environment such as `env -i HOME="$HOME" USER="$USER" TERM=dumb PATH=/usr/bin:/bin:/usr/sbin:/sbin fish -l -c …`. |
| Service or API | Start a second instance on another port with the relevant production environment. |
| tmux | Use an isolated server with a short `TMUX_TMPDIR`, such as a directory under `~/.cache/`; long Unix socket paths can fail. |
| Scripts, package cleanup, Git | Use supported dry-run or syntax modes and inspect `git diff --stat` before staging. |
| Restart | Restart only the affected service, then verify dependent behavior. |

## Measurement traps

- The agent's inherited PATH and shell snapshot can contaminate a test. Compare with a clean
  environment and invoke the intended executable by absolute path when necessary.
- tmux startup can inherit the invoking client's environment. Compare one-word shell commands
  with direct multi-argument execution before attributing behavior to its global environment.
- Process listings may omit some environments. Have the process write selected non-secret
  environment values itself; never dump credentials into a report.
- Shell-tool snapshots may retain old functions and aliases after configuration edits. A
  fresh shell and an absolute executable path help distinguish the old definition.
- In zsh, `path` is tied to PATH and unmatched globs can abort commands. See `shell-quirks`.
- `fish -c` can run configuration that prints greetings. Separate and validate machine-readable
  output instead of blindly parsing the whole stream.
- Interactive menus may read `/dev/tty`; redirecting stdin from `/dev/null` may not prevent a hang.
- Empty output does not prove absence. `grep -r` does not follow directory symlinks; inspect
  links and use `grep -R` or `find -L` when appropriate. Confirm that the search covers the
  target and that filtering has not hidden errors or binary output.

## Report

Lead with the result and its evidence. Use real values and useful paths. Label verified,
cited, and hypothetical conclusions separately. Explain checks not performed, their concrete
limitations, and how to close them. Correct contradicted agent reports explicitly. Never
present partial verification as complete success or a production-readiness verdict.

Related skills: `shell-quirks` for cross-shell and SSH command construction, and
`agent-bridge` for independent verification of delegated work.
