# Agent Forge Skills

Reusable Codex and agent skills for personal workflow automation, planning,
handoffs, and skill authoring.

This repository is designed to stay safe for public use. Skills should be
generic, reusable, and free of private project context.

## Skills

- `agent-handoff` - Create a concise continuation brief for another agent or a
  future session.
- `challenge-plan` - Stress-test a plan or design one decision at a time.
- `hands-on` - Discover and read local `AGENTS.md` or `CLAUDE.md` context before
  starting work.
- `skill-authoring` - Create, review, and sanitize agent skills.
- `ultra-precise` - Use compact, high-signal technical responses.

## Installation

Copy the skill folders you want into your Codex/agents skills directory:

```bash
mkdir -p ~/.agents/skills
cp -R skills/agent-handoff ~/.agents/skills/
cp -R skills/challenge-plan ~/.agents/skills/
cp -R skills/hands-on ~/.agents/skills/
cp -R skills/skill-authoring ~/.agents/skills/
cp -R skills/ultra-precise ~/.agents/skills/
```

For Claude, copy the same folders into `~/.claude/skills`:

```bash
mkdir -p ~/.claude/skills
cp -R skills/agent-handoff ~/.claude/skills/
cp -R skills/challenge-plan ~/.claude/skills/
cp -R skills/hands-on ~/.claude/skills/
cp -R skills/skill-authoring ~/.claude/skills/
cp -R skills/ultra-precise ~/.claude/skills/
```

Restart or reload your agent environment or Claude session if it does not
discover new skills automatically.

## Agent Install Prompt

Give this prompt to an AI coding agent when you want it to install these skills
without further human intervention:

```text
Install the reusable skills from https://github.com/MondoBoricua/agent-forge-skills
into the local skills directories for Codex/agents and Claude when available.

Steps:
1. Create these directories if they do not exist:
   - `~/.agents/skills`
   - `~/.claude/skills`
2. Clone or download the repository into a temporary directory.
3. Copy these folders into both `~/.agents/skills/` and `~/.claude/skills/`:
   - `skills/agent-handoff`
   - `skills/challenge-plan`
   - `skills/hands-on`
   - `skills/skill-authoring`
   - `skills/ultra-precise`
4. Do not overwrite an existing local skill unless its contents already match
   this repository or you have made a timestamped backup.
5. Do not copy `.git`, logs, dumps, datasets, reports, exports, environment
   files, secrets, tokens, credentials, hashes, or potfiles.
6. If one destination is not used on this machine, skip it and say why.
7. Verify each installed skill has a `SKILL.md` file.
8. Report the installed paths and any skipped existing skills.
```

## Usage

Invoke skills naturally in conversation:

```text
/agent-handoff
challenge this plan
/hands-on
use skill-authoring to draft a new skill
modo ultra preciso
```

Each skill includes trigger language in its `description` frontmatter.

## Public-Safety Rules

Before adding or updating a skill, remove or generalize:

- secrets, tokens, passwords, keys, cookies, and credentials,
- private absolute paths,
- client, lab, company, or project names that should not be public,
- hashes, potfiles, scan output, audit findings, reports, dumps, and exports,
- datasets or derived private data,
- internal URLs, hostnames, usernames, and email addresses,
- instructions that depend on one private machine or private repository.

If a detail is useful but sensitive, replace it with a generic placeholder. If a
detail is ambiguous, do not include it until it has been reviewed.

## Repository Layout

```text
skills/
  agent-handoff/
    SKILL.md
  challenge-plan/
    SKILL.md
  hands-on/
    SKILL.md
  skill-authoring/
    SKILL.md
  ultra-precise/
    SKILL.md
```

Keep each skill small. Add `references/`, `scripts/`, or `assets/` only when
they directly support the skill.
