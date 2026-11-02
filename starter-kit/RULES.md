# Agent operating rules

## Verify before asserting

Before asserting system state, tool behavior, versions, hardware or API behavior, measure it with a command and its output or cite a source URL. Label anything unmeasured as a hypothesis and give the command that would confirm it. Another agent's report, memory or earlier session is also a hypothesis until checked.

Measure local facts locally; use official documentation for external facts. Before configuration changes, audit read-only with file:line references, measure the baseline, rehearse in isolation when needed, make a verified backup, apply the smallest change, then repeat the same checks and exercise the real flow. Read `~/.agents/skills/verify-first/SKILL.md` before making claims. Never report success without the evidence beside the claim.

## Delegate implementation by default

Before implementation, read `~/.agents/skills/agent-bridge/SKILL.md`. Delegate scripts, patches, backends, hooks and code longer than one line to an available executor in an isolated worktree. Give a closed brief containing the objective, branch, allowed and forbidden files, stop conditions, required checks and this instruction:

> Apply `verify-first` (`~/.agents/skills/verify-first/SKILL.md`) before assuming anything. Attach commands and outputs to claims; label unmeasured claims as hypotheses.

The coordinator plans, collects the result, verifies live and synthesizes it. Risky server, authentication and deployment changes need two or more independent reviews before integration. Executors follow their brief and do not re-delegate without authorization. Exceptions: the user explicitly opts out, or the answer is one line without code.

Use a current economical model for routine work; use a stronger model for serious complexity or after two failed live verification rounds. Check the available model list and remaining budget before dispatch. Choose by capability, transport, authorization and budget, rather than a fixed provider preference. Do not switch agents to evade a safety refusal. Do not leave dispatched work uncollected when ending a turn.

The delegation reminder can be disabled with `touch ~/.claude/agent-skills-off` or `CLAUDE_NO_AGENT_SKILLS=1`; remove the file or unset the variable to re-enable it. This switch affects the delegation hook only.

## Search for a skill before entering an uncovered domain

Before implementation in a domain, stack, platform or workflow not covered by a loaded skill, run `skill-find "<domain and task keywords>"`. Repeat only when the domain changes. Skip discovery for trivial tasks, general questions and work already covered by an active skill.

Read up to three matching `~/.agents/skills-library/<skill>/SKILL.md` files, explain which guide fits and why, and use it for the task. Review scripts and their origin before executing them. Do not move or promote library skills without explicit authorization. If no result fits, report the concrete search and continue. The finder lives at `~/.agents/skills/skill-library/scripts/skill-find`, linked from `~/.local/bin/skill-find`.
