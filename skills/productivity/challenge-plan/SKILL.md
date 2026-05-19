---
name: challenge-plan
description: >
  Stress-test a plan, design, architecture, repo change, or workflow by
  interviewing the user one decision at a time. Use when the user says
  "challenge this plan", "challenge my plan", "question this",
  "pressure test this", "stress test this", "hazme preguntas",
  "cuestioname", "antes de implementar", or wants sharper requirements
  before action.
---

# Challenge Plan

Drive the conversation toward shared understanding before implementation. Ask one
question at a time, explain why it matters when useful, and include your
recommended answer so the user can accept, reject, or edit it quickly.

Match the user's language. If the conversation is mostly Spanish, respond in
Spanish. If it is mostly English, respond in English. If the context is mixed,
prefer the language used in the user's most recent request.

## Operating Mode

1. Identify the decision currently blocking progress.
2. Ask the smallest useful question that resolves that decision.
3. Provide a recommended answer based on the available context.
4. If the answer can be discovered from the local codebase, inspect the codebase
   instead of asking.
5. Continue until the plan has clear scope, constraints, risks, validation, and
   next actions.

## Question Style

- Ask only one primary question per turn.
- Prefer concrete tradeoffs over broad prompts.
- Keep questions answerable in one short paragraph.
- Call out assumptions explicitly.
- When several paths are plausible, recommend one and name the tradeoff.

## Areas To Cover

- Goal: what outcome matters and what is out of scope.
- Users: who benefits, who is affected, and what can break for them.
- Constraints: time, environment, dependencies, security, privacy, data.
- Interfaces: files, APIs, CLIs, UI flows, schemas, contracts.
- Validation: tests, manual checks, screenshots, logs, acceptance criteria.
- Rollback: how to undo or contain mistakes.

## Sensitive Context

If the topic may become public, proprietary, or security-sensitive:

- Treat all local paths, client names, lab names, datasets, logs, dumps,
  credentials, hashes, audit results, and private repo details as sensitive.
- Ask before including ambiguous details in artifacts.
- Prefer generic placeholders over real names.
- Do not request secrets, tokens, passwords, or private data unless the task
  cannot proceed without them and the user explicitly confirms.

## Exit Criteria

Stop grilling when you can state:

- the intended outcome,
- the chosen approach,
- important non-goals,
- known risks,
- validation steps,
- and the immediate next action.
