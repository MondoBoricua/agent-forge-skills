# Agent Ops starter kit

Install from the repository root (the folder containing `skills/` and `starter-kit/`). These commands install files; review existing destinations and back them up before replacing anything.

## Requirements

- Python 3.9 or newer for `skill-find` and the hooks; Python standard library only.
- Node 20 or newer for Bridge 2.0; Git for worktree verification. The Bridge test suite passes on Node 22; on Node 24 and newer one filesystem mock in the tests fails, which does not affect the commands themselves.
- Bash for the hooks and shell entrypoints. tmux, SSH and each agent CLI are optional and only needed for their respective channels. `agent-usage` also calls provider tools and, for some providers, platform credential storage; inspect it before use.
- Ruby is optional, used only for the YAML validation command below.

## 1. Install skills and the search command

```bash
mkdir -p ~/.agents/skills ~/.agents/skills-library ~/.local/bin ~/.claude/hooks
cp -R skills/agent-ops/skill-library ~/.agents/skills/
cp -R skills/agent-ops/verify-first ~/.agents/skills/
cp -R skills/agent-ops/shell-quirks ~/.agents/skills/
cp -R skills/agent-ops/agent-bridge ~/.agents/skills/
chmod +x ~/.agents/skills/skill-library/scripts/skill-find
ln -s "$HOME/.agents/skills/skill-library/scripts/skill-find" "$HOME/.local/bin/skill-find"
```

If the link already exists, inspect it with `ls -l ~/.local/bin/skill-find`; keep it if correct. Do not overwrite a different executable blindly. Add `~/.local/bin` to your shell's PATH if necessary. For the current shell:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Active skills live under `~/.agents/skills/<name>/SKILL.md`; reserve skills live under `~/.agents/skills-library/<name>/SKILL.md`. Install any reserve guides you want separately: this kit does not ship a full library. Search examines direct child skill folders; do not copy the `agent-ops` grouping folder into the active root.

The finder writes only a derived index, by default `~/.cache/skill-find/index.json`. Override roots with `--roots active=/path/to/active library=/path/to/library`; override the index with `--index /path/to/index.json` or `SKILL_FIND_INDEX`. Its source comment mentioning a separate indexer is provenance, not an executable dependency.

For Claude Code, also install real copies into its skill directory:

```bash
mkdir -p ~/.claude/skills
cp -R ~/.agents/skills/skill-library ~/.claude/skills/
cp -R ~/.agents/skills/verify-first ~/.claude/skills/
cp -R ~/.agents/skills/shell-quirks ~/.claude/skills/
cp -R ~/.agents/skills/agent-bridge ~/.claude/skills/
```

Agent-specific discovery can vary; check your tool's skill list after installation.

Optionally expose the Bridge commands (keep their modules beside the originals):

```bash
ln -s "$HOME/.agents/skills/agent-bridge/scripts/bridge-whoami" "$HOME/.local/bin/bridge-whoami"
ln -s "$HOME/.agents/skills/agent-bridge/scripts/bridge-verify" "$HOME/.local/bin/bridge-verify"
ln -s "$HOME/.agents/skills/agent-bridge/scripts/bridge-handoff" "$HOME/.local/bin/bridge-handoff"
ln -s "$HOME/.agents/skills/agent-bridge/scripts/agent-usage" "$HOME/.local/bin/agent-usage"
ln -s "$HOME/.agents/skills/agent-bridge/scripts/claude-auto" "$HOME/.local/bin/claude-auto"
```

## 2. Add operating rules

Read [RULES.md](RULES.md), then paste the three rule sections into the global rules file of **every** agent you use (each agent reads only its own file, and skill syncs do not carry them):

| Agent | Global rules file |
|---|---|
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex CLI | `~/.codex/AGENTS.md` |
| Gemini CLI / Antigravity | `~/.gemini/GEMINI.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |
| ZCode | `~/.zcode/AGENTS.md` |
| Cursor | `~/.cursor/rules/<name>.mdc` with `alwaysApply: true` (Cursor reads `.cursor/rules` from the repo and every ancestor directory, so this applies to repos inside `$HOME` only) |

Create the file if it does not exist. Keep any existing project constraints and resolve conflicts deliberately. Rules are instructions; hooks are selective reminders and do not enforce compliance.

## 3. Install Claude Code prompt hooks

```bash
cp starter-kit/hooks/verify-first-nudge.sh ~/.claude/hooks/
cp starter-kit/hooks/agent-delegate-nudge.sh ~/.claude/hooks/
cp starter-kit/hooks/skill-find-nudge.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/*-nudge.sh
```

Merge the following `hooks` entry into `~/.claude/settings.json`. Preserve existing settings and hook arrays; do not replace the whole file. The commands use `$HOME`, so there is no machine-specific absolute path.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/verify-first-nudge.sh\"" },
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/agent-delegate-nudge.sh\"" },
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/skill-find-nudge.sh\"" }
        ]
      }
    ]
  }
}
```

See the [Claude Code hook documentation](https://code.claude.com/docs/en/hooks) for the host's configuration schema.

### Codex CLI

Codex runs the same three scripts unchanged: its `UserPromptSubmit` hook receives the same
`{"prompt": ...}` JSON and accepts the same `hookSpecificOutput.additionalContext` reply
(see the [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks.md)). Create or
merge `~/.codex/hooks.json` (keep the scripts in `~/.claude/hooks/` or copy them next to it):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/verify-first-nudge.sh\"" },
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/agent-delegate-nudge.sh\"" },
          { "type": "command", "command": "bash \"$HOME/.claude/hooks/skill-find-nudge.sh\"" }
        ]
      }
    ]
  }
}
```

Codex skips non-managed hooks until you review and trust them once: open the Codex TUI and run
`/hooks`. A changed script needs a new approval. Verified with Codex CLI 0.165.0: a
troubleshooting prompt produced three `hook: UserPromptSubmit Completed` lines and the
verify-first reminder appeared in the session transcript; without the file it did not.

## 4. Check installation

```bash
skill-find "docker compose"
printf '%s\n' '{"prompt":"Fix a broken configuration"}' | bash ~/.claude/hooks/verify-first-nudge.sh
printf '%s\n' '{"prompt":"Implement a backend feature"}' | bash ~/.claude/hooks/agent-delegate-nudge.sh
printf '%s\n' '{"prompt":"Build docker compose container deployment"}' | bash ~/.claude/hooks/skill-find-nudge.sh
```

The first command lists matching skills if installed. The next two should print JSON containing `hookSpecificOutput.additionalContext`. The last reminder is selective: it needs a matching reserve skill, at least two matched tokens and score 8; the highest scoring match must not already be active. With no suitable reserve guide it correctly prints nothing. For a deterministic probe, add a temporary reserve guide:

```bash
mkdir -p ~/.agents/skills-library/starter-smoke-guide
cat > ~/.agents/skills-library/starter-smoke-guide/SKILL.md <<'GUIDE'
---
name: starter-smoke-guide
description: Docker compose container deployment guide.
---
GUIDE
printf '%s\n' '{"prompt":"Build docker compose container deployment"}' | bash ~/.claude/hooks/skill-find-nudge.sh
```

Use that folder only if it does not already exist; remove the temporary guide afterward. An existing active guide can suppress this suggestion by design. In Claude Code, submit the same three prompts and check the hook output or debug log to confirm that host integration also runs them. Standalone script checks do not prove host integration.

Optional checks from the repository root:

```bash
cd skills/agent-ops/agent-bridge/scripts
node --test ./*.test.mjs
```

Optional YAML check, run once for each installed `SKILL.md`:

```bash
ruby -ryaml -e 'f=ARGV[0]; t=File.read(f).split(/^---\s*$/)[1]; h=YAML.safe_load(t); abort("bad #{f}") unless h["name"] && h["description"]; puts "ok #{f}"' ~/.agents/skills/verify-first/SKILL.md
```

To uninstall reminders, remove only these three hook entries from settings and their corresponding scripts. Keep skills or rules if you still use them. The delegation hook alone supports `CLAUDE_NO_AGENT_SKILLS=1` or `~/.claude/agent-skills-off`; the other two hooks remain active.
