---
name: skill-authoring
description: >
  Create, review, sanitize, or improve Codex/agent skills with clean structure,
  strong trigger descriptions, progressive disclosure, and public-safe content.
  Use when writing a new skill, customizing an existing skill, preparing skills
  for a repo, or checking skills for sensitive information.
---

# Skill Authoring

Create skills that are small, reusable, easy to trigger, and safe to publish
unless the user explicitly says they are private-only.

Match the user's language. If the conversation is mostly Spanish, respond in
Spanish. If it is mostly English, respond in English. If the context is mixed,
prefer the language used in the user's most recent request.

## Default Workflow

1. Clarify the task the skill should help with.
2. Define precise trigger language for the `description`.
3. Draft the smallest useful `SKILL.md`.
4. Add references or scripts only when they reduce repeated work or keep the
   main skill concise.
5. Review for sensitive or environment-specific content before saving.
6. Validate that the skill can be understood without private context.

## Required Shape

```text
skill-name/
  SKILL.md
```

Use optional folders only when needed:

```text
skill-name/
  SKILL.md
  references/
  scripts/
  assets/
  agents/
```

## Frontmatter

Every `SKILL.md` needs:

```yaml
---
name: skill-name
description: >
  Clear capability summary. Use when the user asks for specific tasks,
  keywords, file types, workflows, or contexts.
---
```

The description is the trigger surface. Keep it specific, third-person, and
under 1024 characters.

## Content Rules

- Keep `SKILL.md` focused on instructions the agent actually needs.
- Prefer checklists and workflows over long essays.
- Split large or rarely used details into one-level `references/` files.
- Add scripts for deterministic, repeated, or fragile operations.
- Do not add README, changelog, install notes, or process docs inside a skill
  unless the user explicitly asks.
- Use examples only when they clarify behavior materially.

## Public-Safety Review

Before saving or publishing, scan for:

- secrets, tokens, passwords, keys, cookies, credentials,
- private absolute paths,
- client, lab, company, or project names that should not be public,
- hashes, potfiles, scan output, audit findings, reports, dumps, exports,
- datasets or derived private data,
- internal URLs, hostnames, usernames, email addresses,
- instructions that depend on one private machine or repo.

If a detail is useful but sensitive, replace it with a generic placeholder. If
it is ambiguous, ask the user before including it.

## Quality Checklist

- `name` is short, lowercase, and stable.
- `description` says when to use the skill.
- The body starts with the actual workflow.
- The skill is generic enough to reuse.
- Sensitive details are removed or generalized.
- Optional resources are referenced from `SKILL.md`.
- The skill does not duplicate another existing skill.
