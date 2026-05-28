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

For Claude, either copy the same folders into `~/.claude/skills` or symlink
them to the Codex/agents install so both tools read the same skill files:

```bash
mkdir -p ~/.claude/skills
ln -s ~/.agents/skills/agent-handoff ~/.claude/skills/agent-handoff
ln -s ~/.agents/skills/challenge-plan ~/.claude/skills/challenge-plan
ln -s ~/.agents/skills/diagnose ~/.claude/skills/diagnose
ln -s ~/.agents/skills/Gemini_WaterMark_Removal ~/.claude/skills/Gemini_WaterMark_Removal
ln -s ~/.agents/skills/hands-on ~/.claude/skills/hands-on
ln -s ~/.agents/skills/skill-authoring ~/.claude/skills/skill-authoring
ln -s ~/.agents/skills/ultra-precise ~/.claude/skills/ultra-precise
ln -s ~/.agents/skills/logo-forge ~/.claude/skills/logo-forge
ln -s ~/.agents/skills/kali-mac ~/.claude/skills/kali-mac
ln -s ~/.agents/skills/macos-dev-pro ~/.claude/skills/macos-dev-pro
ln -s ~/.agents/skills/macos-ui-pro ~/.claude/skills/macos-ui-pro
ln -s ~/.agents/skills/swiftui-pro ~/.claude/skills/swiftui-pro
```

Restart or reload your agent environment or Claude session if it does not
discover new skills automatically.

For Gemini and Antigravity CLI, symlink the same installed folders into the
global Gemini skill directories:

```bash
mkdir -p ~/.gemini/skills ~/.gemini/antigravity-cli/skills
ln -s ~/.agents/skills/diagnose ~/.gemini/skills/diagnose
ln -s ~/.agents/skills/diagnose ~/.gemini/antigravity-cli/skills/diagnose
ln -s ~/.agents/skills/logo-forge ~/.gemini/skills/logo-forge
ln -s ~/.agents/skills/logo-forge ~/.gemini/antigravity-cli/skills/logo-forge
```

## Agent Install Prompt

Give this prompt to an AI coding agent when you want it to install these skills
without further human intervention:

```text
Install the reusable skills from https://github.com/MondoBoricua/agent-forge-skills
into the local skills directories for Codex/agents, Claude, and Gemini when
available.

Steps:
1. Create these directories if they do not exist:
   - `~/.agents/skills`
   - `~/.claude/skills`
   - `~/.gemini/skills`
   - `~/.gemini/antigravity-cli/skills`
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
4. For Claude, prefer symlinking from `~/.claude/skills/<skill-name>` to the
   matching `~/.agents/skills/<skill-name>` so both tools read the same files.
5. For Gemini and Antigravity CLI, prefer symlinking from
   `~/.gemini/skills/<skill-name>` and
   `~/.gemini/antigravity-cli/skills/<skill-name>` to the matching
   `~/.agents/skills/<skill-name>`.
6. Do not overwrite an existing local skill or symlink unless its contents already match
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
