---
name: hands-on
description: >
  Start a coding or agent session by discovering and reading local project
  context files before doing work. Use when the user says "/hands-on",
  "hands on", "/inicio", "inicio", "agent start", "start session",
  "read project context", "lee AGENTS.md", "lee CLAUDE.md",
  "ponte en contexto", or asks the agent to orient itself before planning,
  editing, or running commands.
---

# Hands On

Orient yourself before acting. Find and read project instruction files, then
summarize the relevant constraints and next step.

Match the user's language. If the conversation is mostly Spanish, respond in
Spanish. If it is mostly English, respond in English. If the context is mixed,
prefer the language used in the user's most recent request.

## Workflow

1. Identify the current workspace directory.
2. Search for context files named `AGENTS.md` or `CLAUDE.md`.
3. Prefer files closest to the current working directory over broader parent or
   sibling files.
4. Read only the relevant files before planning or editing.
5. Summarize the active instructions, constraints, and any conflicts.
6. Ask only if the context is missing, ambiguous, or unsafe to infer.

## Search Commands

Prefer `rg` when available:

```bash
rg --files -g 'AGENTS.md' -g 'CLAUDE.md'
```

If `rg` is unavailable:

```bash
find . -name AGENTS.md -o -name CLAUDE.md
```

If the current directory is inside a larger project, also check parent
directories when useful:

```bash
pwd
```

Then inspect likely parent directories without scanning private unrelated
folders.

## Reading Order

Use this priority:

1. `AGENTS.md` or `CLAUDE.md` in the current directory.
2. The nearest parent directory context file.
3. Context files in relevant subdirectories touched by the task.
4. Broader repo-level context files.

If multiple files conflict, follow the most specific applicable file and mention
the conflict briefly.

## Safety

- Do not read unrelated private directories just because they are nearby.
- Do not copy secrets, credentials, logs, dumps, datasets, reports, hashes, or
  private data into the conversation.
- If a context file contains sensitive details, summarize only the operational
  instruction needed for the task.
- Do not begin code edits until the active context has been read or you have
  confirmed no context file exists.

## Response Shape

After reading context, respond with:

```text
Context read: [files].
Active instructions: [brief summary].
Next: [planned first action].
```
