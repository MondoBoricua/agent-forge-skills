# Agent Forge Skills

Reusable Codex and agent skills for productivity, Apple platform development,
planning, handoffs, skill authoring, and defensive cybersecurity workflows.

This repository is designed to stay safe for public use. Skills should be
generic, reusable, and free of private project context.

## Skills

### Productivity

- `agent-handoff` - Create a concise continuation brief for another agent or a
  future session.
- `challenge-plan` - Stress-test a plan or design one decision at a time.
- `diagnose` - Debug hard bugs and performance regressions with a disciplined
  reproduce, hypothesize, instrument, fix, and regression-test loop.
- `Gemini_WaterMark_Removal` - Remove visible Gemini-style watermarks from
  authorized local image frames using the purpose-built remover first, then
  measured inpaint fallbacks when scaled video frames defeat catalog detection.
- `hands-on` - Discover and read local `AGENTS.md` or `CLAUDE.md` context before
  starting work.
- `skill-authoring` - Create, review, and sanitize agent skills.
- `ultra-precise` - Use compact, high-signal technical responses.

### Design Assets

- `logo-forge` - Find, fetch, validate, and adapt brand SVG logos and wordmarks
  from SVGL and similar public logo sources for authorized UI, docs, decks, and
  app projects.

### Cybersecurity

- `kali-mac` - Use Kali Linux tools from macOS for authorized defensive labs,
  Hack The Box-style practice, tool discovery, SSH-based lab access, and safe
  learning workflows.

### Apple Development

- `macos-dev-pro` - Pro-level macOS development guidance for Swift, SwiftUI,
  SwiftData, AppKit bridging, status menu apps, and system monitoring.
- `macos-ui-pro` - Practical macOS UI/HIG guidance for app windows, menu bars,
  popovers, toolbars, keyboard shortcuts, and monitoring utilities.
- `swiftui-pro` - Production SwiftUI guidance for iOS/macOS, including
  MenuBarExtra, WindowGroup, layout, performance, and trace analysis.

## Installation

Copy the skill folders you want into your Codex/agents skills directory:

```bash
mkdir -p ~/.agents/skills
cp -R skills/productivity/agent-handoff ~/.agents/skills/
cp -R skills/productivity/challenge-plan ~/.agents/skills/
cp -R skills/productivity/diagnose ~/.agents/skills/
cp -R skills/productivity/Gemini_WaterMark_Removal ~/.agents/skills/
cp -R skills/productivity/hands-on ~/.agents/skills/
cp -R skills/productivity/skill-authoring ~/.agents/skills/
cp -R skills/productivity/ultra-precise ~/.agents/skills/
cp -R skills/design-assets/logo-forge ~/.agents/skills/
cp -R skills/cybersecurity/kali-mac ~/.agents/skills/
cp -R skills/apple-development/macos-dev-pro ~/.agents/skills/
cp -R skills/apple-development/macos-ui-pro ~/.agents/skills/
cp -R skills/apple-development/swiftui-pro ~/.agents/skills/
```

That single `~/.agents/skills` install is read directly by **Codex, OpenCode,
Cursor, and Gemini CLI** — no extra per-tool copies are needed for them (see
[Where each agent reads skills](#where-each-agent-reads-skills)).

**Claude Code** does not read `~/.agents/skills`, so give it its own copy.
Prefer real copies over symlinks, since Claude's docs do not guarantee symlink
discovery:

```bash
mkdir -p ~/.claude/skills
cp -R ~/.agents/skills/agent-handoff ~/.claude/skills/
cp -R ~/.agents/skills/diagnose ~/.claude/skills/
cp -R ~/.agents/skills/logo-forge ~/.claude/skills/
# ...repeat for each skill you want available in Claude Code
```

Restart or reload your agent environment or Claude session if it does not
discover new skills automatically. Claude watches `~/.claude/skills` live, so
new skills usually appear without a restart; creating the top-level directory
for the first time does require a restart.

**Antigravity** reads different directories than the Gemini CLI:

- Antigravity IDE (global): `~/.gemini/config/skills` — often a deliberately
  curated subset, so add only the skills you want there.
- Antigravity CLI: `~/.gemini/antigravity-cli/skills`.

Gemini CLI itself already reads `~/.agents/skills` (its `.agents` alias takes
precedence over `~/.gemini/skills`), so it needs no separate copy.

## Agent Install Prompt

Give this prompt to an AI coding agent when you want it to install these skills
without further human intervention:

```text
Install the reusable skills from https://github.com/MondoBoricua/agent-forge-skills
into the local skills directories for Codex/agents, Claude, and Gemini when
available.

Steps:
1. Create `~/.agents/skills` if it does not exist. This is the cross-tool home
   read directly by Codex, OpenCode, Cursor, and Gemini CLI. Also create
   `~/.claude/skills` if you use Claude Code (it does not read `~/.agents`).
2. Clone or download the repository into a temporary directory.
3. Copy these folders into `~/.agents/skills/`:
   - `skills/productivity/agent-handoff`
   - `skills/productivity/challenge-plan`
   - `skills/productivity/diagnose`
   - `skills/productivity/Gemini_WaterMark_Removal`
   - `skills/productivity/hands-on`
   - `skills/productivity/skill-authoring`
   - `skills/productivity/ultra-precise`
   - `skills/design-assets/logo-forge`
   - `skills/cybersecurity/kali-mac`
   - `skills/apple-development/macos-dev-pro`
   - `skills/apple-development/macos-ui-pro`
   - `skills/apple-development/swiftui-pro`
4. For Claude Code, copy each folder into `~/.claude/skills/<skill-name>` (real
   copies, not symlinks — Claude's docs do not guarantee symlink discovery).
   Claude does not read `~/.agents/skills`.
5. Codex, OpenCode, Cursor, and Gemini CLI read `~/.agents/skills` directly, so
   no further action is needed for them. Only if the user specifically uses
   Antigravity, copy the wanted skills into `~/.gemini/config/skills` (IDE,
   usually a curated subset) and/or `~/.gemini/antigravity-cli/skills` (CLI).
6. Do not overwrite an existing local skill unless its contents already match
   this repository or you have made a timestamped backup.
7. Do not copy `.git`, logs, dumps, datasets, reports, exports, environment
   files, secrets, tokens, credentials, hashes, or potfiles.
8. If one destination is not used on this machine, skip it and say why.
9. Verify each installed skill has a `SKILL.md` file.
10. Report the installed paths, symlink targets, and any skipped existing skills.
```

## Usage

Invoke skills naturally in conversation:

```text
/agent-handoff
challenge this plan
diagnose this bug
Gemini_WaterMark_Removal
/hands-on
kali on mac
use macos-dev-pro for this menu bar utility
use skill-authoring to draft a new skill
use logo-forge to fetch the Vercel logo
modo ultra preciso
```

Each skill includes trigger language in its `description` frontmatter.

## Where each agent reads skills

Skills follow the [Agent Skills](https://agentskills.io) open standard, so most
tools share one location. The cross-tool home is `~/.agents/skills/`. The table
below maps each agent's actual skill directories, verified against current
official docs.

| Agent | Global skill directories it reads | Reads `~/.agents/skills` directly? |
| --- | --- | --- |
| Claude Code | `~/.claude/skills` | No |
| Codex | `~/.agents/skills`, `/etc/codex/skills` | Yes |
| OpenCode | `~/.config/opencode/skills`, `~/.claude/skills`, `~/.agents/skills` | Yes |
| Cursor | `~/.cursor/skills`, `~/.agents/skills` (+ compat `~/.claude/skills`, `~/.codex/skills`) | Yes |
| Gemini CLI | `~/.gemini/skills`, `~/.agents/skills` (the `.agents` alias wins) | Yes |
| Antigravity (IDE) | `~/.gemini/config/skills` (global); `.agents/skills` then `.agent/skills` (workspace) | Workspace only |
| Antigravity (CLI) | `~/.gemini/antigravity-cli/skills` | — |

Key takeaways:

- **`~/.agents/skills` is read directly by Codex, OpenCode, Cursor, and Gemini
  CLI.** Install a skill there once and those four pick it up. Project-level
  `.agents/skills/` works the same way per repository.
- **Claude Code is the exception** — it only reads `~/.claude/skills`, never
  `~/.agents/skills`. It needs its own copy.
- **The command name comes from a different place per tool.** Claude derives the
  `/command` from the *folder name*; Codex, Cursor, and Gemini derive it from the
  frontmatter `name`. Keep the folder name equal to `name` so the command is the
  same everywhere.
- **`name` is required by Codex, OpenCode, and Cursor** (optional in Claude and
  Antigravity). Always include both `name` and `description` so a skill loads in
  every tool.
- Codex's docs state it follows symlinked skill folders; Claude's docs do not
  guarantee symlink discovery, so prefer real copies for `~/.claude/skills`.

Sources: [Claude Code](https://code.claude.com/docs/en/skills) ·
[Codex](https://developers.openai.com/codex/skills) ·
[OpenCode](https://opencode.ai/docs/skills/) ·
[Cursor](https://cursor.com/docs/skills) ·
[Gemini CLI](https://geminicli.com/docs/cli/skills/) ·
[Antigravity](https://antigravity.google/docs/skills)

## Optional MCP: Chrome DevTools

For browser inspection, screenshots, console logs, network requests, performance
traces, and Lighthouse audits, install Google's Chrome DevTools MCP server.

### Claude Code

```bash
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
claude mcp get chrome-devtools
```

### Codex CLI

Codex CLI supports MCP servers through `codex mcp` and stores them in
`~/.codex/config.toml`.

```bash
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
codex mcp get chrome-devtools
```

Equivalent TOML:

```toml
[mcp_servers.chrome-devtools]
command = "npx"
args = ["-y", "chrome-devtools-mcp@latest"]
```

### opencode

Add this to the top-level `"mcp"` object in `~/.config/opencode/opencode.json`:

```json
{
  "chrome-devtools": {
    "type": "local",
    "command": ["npx", "-y", "chrome-devtools-mcp@latest"],
    "enabled": true,
    "timeout": 15000
  }
}
```

If the file already has other MCP servers, merge only the `chrome-devtools`
entry into the existing `"mcp"` object.

Example prompt:

```text
Use chrome-devtools to open http://localhost:3000, inspect console errors,
review network requests, take a screenshot, and run a Lighthouse audit.
```

## Optional MCP: Desktop Automation

For tools that do not have Codex's bundled computer-use capability, combine:

- `peekaboo` for screenshots and screen state capture.
- `applescript` for native macOS app control through AppleScript.

### opencode

Add these entries to the top-level `"mcp"` object in
`~/.config/opencode/opencode.json`:

```json
{
  "peekaboo": {
    "type": "local",
    "command": ["npx", "-y", "@steipete/peekaboo-mcp"],
    "enabled": true,
    "timeout": 30000
  },
  "applescript": {
    "type": "local",
    "command": ["npx", "-y", "@peakmojo/applescript-mcp"],
    "enabled": true,
    "timeout": 30000
  }
}
```

### Claude Code

```bash
claude mcp add peekaboo -- npx -y @steipete/peekaboo-mcp
claude mcp add applescript -- npx -y @peakmojo/applescript-mcp
```

### macOS Permissions

Grant permissions when macOS prompts, or add the terminal/Node binary manually:

- Screen Recording for screenshots.
- Accessibility for clicks, keyboard input, and window manipulation.
- Automation for controlling individual apps through AppleScript.

Peekaboo can capture without a vision API key. Add a provider key only if you
want built-in image analysis, and keep that key in local config or environment
variables, not in this repository.

## Optional opencode: Manual Ollama Models

opencode can use Ollama through an OpenAI-compatible provider. If model
autodiscovery is not available for your setup, add the models manually in
`~/.config/opencode/opencode.json`.

Use generic model ids and provider names in shared documentation. Keep private
hostnames, internal IPs, usernames, and API keys out of public repositories.

Example provider entry:

```json
{
  "provider": {
    "ollama-remote": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama Remote",
      "options": {
        "baseURL": "https://example-ollama-host/v1",
        "apiKey": "{file:~/.config/opencode/secrets/ollama-api-key}"
      },
      "models": {
        "qwen2.5-coder:32b": {
          "name": "Qwen 2.5 Coder 32B"
        },
        "qwen2.5-coder-32b-32k:latest": {
          "name": "Qwen 2.5 Coder 32B 32k"
        },
        "codestral:latest": {
          "name": "Codestral"
        }
      }
    }
  }
}
```

If your Ollama endpoint does not require authentication, omit the `apiKey`
field. If it does require authentication, prefer a local secret file instead of
placing the key directly in `opencode.json`:

```bash
mkdir -p ~/.config/opencode/secrets
chmod 700 ~/.config/opencode/secrets
printf '%s' 'replace-with-your-api-key' > ~/.config/opencode/secrets/ollama-api-key
chmod 600 ~/.config/opencode/secrets/ollama-api-key
```

Then reference it from `opencode.json`:

```json
"apiKey": "{file:~/.config/opencode/secrets/ollama-api-key}"
```

To choose manual model ids, list the models on the Ollama machine:

```bash
ollama list
```

Use the exact model name from `ollama list` as the key under `"models"`. For
agent workflows, prefer variants with larger context windows when your Ollama
server has them configured.

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
  productivity/
    agent-handoff/
      SKILL.md
    challenge-plan/
      SKILL.md
    diagnose/
      SKILL.md
      scripts/
        hitl-loop.template.sh
    Gemini_WaterMark_Removal/
      SKILL.md
    hands-on/
      SKILL.md
    skill-authoring/
      SKILL.md
    ultra-precise/
      SKILL.md
  cybersecurity/
    kali-mac/
      SKILL.md
      references/
        tool-playbook.md
  design-assets/
    logo-forge/
      SKILL.md
      scripts/
        fetch-logo.mjs
  apple-development/
    macos-dev-pro/
      SKILL.md
    macos-ui-pro/
      SKILL.md
    swiftui-pro/
      SKILL.md
```

Keep each skill small. Add `references/`, `scripts/`, or `assets/` only when
they directly support the skill.
