# Agent Forge Skills

Reusable Codex and agent skills for personal workflow automation, planning,
handoffs, and skill authoring.

This repository is designed to stay safe for public use. Skills should be
generic, reusable, and free of private project context.

## Skills

- `agent-handoff` - Create a concise continuation brief for another agent or a
  future session.
- `challenge-plan` - Stress-test a plan or design one decision at a time.
- `skill-authoring` - Create, review, and sanitize agent skills.
- `ultra-precise` - Use compact, high-signal technical responses.

## Installation

Copy the skill folders you want into your agent skills directory:

```bash
mkdir -p ~/.agents/skills
cp -R skills/agent-handoff ~/.agents/skills/
cp -R skills/challenge-plan ~/.agents/skills/
cp -R skills/skill-authoring ~/.agents/skills/
cp -R skills/ultra-precise ~/.agents/skills/
```

Restart or reload your agent environment if it does not discover new skills
automatically.

## Usage

Invoke skills naturally in conversation:

```text
/agent-handoff
challenge this plan
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
  skill-authoring/
    SKILL.md
  ultra-precise/
    SKILL.md
```

Keep each skill small. Add `references/`, `scripts/`, or `assets/` only when
they directly support the skill.
