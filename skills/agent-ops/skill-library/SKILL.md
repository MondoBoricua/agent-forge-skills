---
name: skill-library
description: >-
  Local skill discovery for unfamiliar domains, stacks, frameworks, languages, and workflows.
  Use before implementation when no loaded skill covers the task, or when scope changes.
  Triggers include "busca una skill" and "no conozco este stack". Search the reserve library,
  read up to three candidates, and use the best fit without activating it permanently.
---

# Skill Library

Keep frequently used skills in `~/.agents/skills/` (ACTIVE) and optional skills in
`~/.agents/skills-library/` (LIBRARY). The reserve library remains available without
loading every description into every session. Its contents and size depend on the installation;
search the actual files rather than relying on a copied catalog.

## Search before implementing in an unfamiliar domain

When no loaded skill covers the task, identify the domain from the brief and repository files.
Announce the search, search once, read up to three candidates, and explain which fits and why.
Repeat only when another domain appears or the scope changes. Skip this for trivial tasks,
general questions, and work already covered by a loaded skill.

A matching name is only a candidate. Read its `SKILL.md` before recommending or using it.
Read referenced scripts and inspect their origin before running them. Consulting a skill does
not authorize installation, configuration changes, or external actions.

## Indexed search

The bundled Python searcher uses the standard library and caches its index under
`~/.cache/skill-find/`. Install it at `~/.agents/skills/skill-library/scripts/skill-find`
and link it into `~/.local/bin` as described in the starter kit.

```bash
skill-find "<domain and 3-6 task keywords>"
skill-find --auto "<full request>" --json
skill-find "<keywords>" --library-only -n 3
skill-find --rebuild
skill-find --roots ~/.agents/skills ~/.agents/skills-library -- "docker compose"
```

The default search returns up to five ranked results with score, bucket, name, description,
and path. Auto mode applies a relevance threshold and returns an empty JSON list with exit 0
for trivial or unrelated requests; inspect the result list rather than only the exit code. Rebuild refreshes the index explicitly; normal searches
also detect changed skill files. The index includes names, descriptions, trigger phrases,
headings, and folder names. An ACTIVE result means the skill is already in the active root;
it does not prove the current agent has loaded it.

If the command is unavailable, search the reserve directory directly:

```bash
rg -il -L -F -g SKILL.md -- "<keyword>" ~/.agents/skills-library
```

Then read `~/.agents/skills-library/<skill>/SKILL.md` and confirm the fit. Do not claim
that no skill exists until the search actually covers the relevant roots and symlinks.

## Use without permanent activation

For one task, read and follow the reserve skill in place. No installation is needed.
Recommend at most three candidates unless the user asks for more. Prefer one-off use.
If nothing fits, report the concrete search and continue normally.

Promotion to ACTIVE requires explicit authorization. After inspecting both source and
destination, move the selected directory from `~/.agents/skills-library/` to
`~/.agents/skills/`. If the installation uses a synchronization command, run its documented
sync procedure; do not assume a particular private sync utility exists. Demotion reverses
the move. Keep version control and backups consistent with the local installation.

## Report

```text
Relevant skills found:
- <skill-name> — why it fits the task

Recommended action:
- Read/use <skill-name> for this task
- Or propose permanent activation for repeated use
- Or continue without an additional skill, with the search evidence
```

The optional OpenCode plugin under `scripts/opencode-plugin/` suggests up to three skills.
Read its README for installation and behavior. Suggestions still require reading the actual
skill before applying it.
