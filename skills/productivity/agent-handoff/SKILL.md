---
name: agent-handoff
description: >
  Create a concise continuation brief so another agent or future session can
  pick up the work with context, constraints, next steps, and relevant files.
  Use when the user asks for a handoff, agent handoff, session summary,
  continuation brief, next-agent brief, or wants to resume work later.
argument-hint: "What will the next session be used for?"
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it to a path produced by `mktemp -t handoff-XXXXXX.md` (read the file before you write to it).

Suggest the skills to be used, if any, by the next session.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

Match the language of the handoff to the conversation context. If the conversation is mostly Spanish, write the handoff and final user-facing instructions in Spanish. If it is mostly English, write them in English. If the context is mixed, prefer the language used in the user's most recent request.

At the end of your response to the user, include:

- The absolute path to the generated handoff file.
- A short copy/paste prompt the user can give to the next agent, for example:

```text
Lee este handoff antes de continuar: /path/to/handoff.md
También lee los archivos de contexto referenciados dentro del handoff.
Primero resume el estado y planifica antes de editar o ejecutar comandos.
```

Keep that closing instruction concise and practical.
