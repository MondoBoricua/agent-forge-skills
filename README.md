# Agent Forge Skills

<p>
  <img alt="Skills" src="https://img.shields.io/badge/Skills-16-blueviolet?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge">
  <a href="https://www.patreon.com/MT3K"><img alt="Patreon" src="https://img.shields.io/badge/Patreon-Support_MT3K-FF424D?style=for-the-badge&logo=patreon"></a>
</p>

Reusable Codex and agent skills for productivity, Apple platform development,
planning, handoffs, skill authoring, and defensive cybersecurity workflows.

This repository is designed to stay safe for public use. Skills should be
generic, reusable, and free of private project context.

## Support

These skills are free and open source (MIT). If they save you time, [**become a patron**](https://www.patreon.com/MT3K) — patrons ($5+) get early access to new MT3K tools and a voice in what ships next.

## Quick start: one prompt

Open your coding agent (Claude Code, Codex, Cursor, OpenCode, Gemini CLI) in any
folder and paste this. It installs every skill in this repo for the agents you
actually use, adds the operating rules, the `skill-find` command and the prompt
hooks (Claude Code and Codex), verifies everything and tells you what it did:

```text
Install all the skills from https://github.com/MondoBoricua/agent-forge-skills on
this machine, in one run, without stopping to ask me anything: when a step has a
safe default, take it and note it in the final report. Clone the repo into a
temporary folder, read its README.md, and follow the "Agent Install Prompt"
section exactly, then the "Agent Ops Starter Kit Install Prompt" section
(skill-find command, operating rules, and the prompt hooks for Claude Code and
Codex). Detect which agents I use (Claude Code, Codex, Cursor, OpenCode, Gemini
CLI, Antigravity, ZCode) by checking their binaries and config folders, and
install only for those. Append the three rule sections from starter-kit/RULES.md
to the global rules file of EVERY agent you detected (CLAUDE.md, AGENTS.md,
GEMINI.md, the OpenCode and ZCode AGENTS.md, Cursor rules), creating the file
when it is missing. Never overwrite an existing skill or settings file without a
timestamped backup, never copy .git or any credentials, and do not send my files
anywhere. Finish with a list of the installed skill paths, the rules files and
hooks you added, anything you skipped and why, and remind me to run /hooks once
in Codex if you added hooks there.
```

Add this sentence at the end if you also want the agents to run without
permission prompts (the [YOLO station](starter-kit/YOLO.md)): `Then read
starter-kit/YOLO.md and apply its prompt too.`

The same prompt in Spanish:

```text
Instala todas las skills de https://github.com/MondoBoricua/agent-forge-skills
en esta máquina, de un tirón y sin pararte a preguntarme nada: si un paso tiene
una opción segura por defecto, tómala y anótala en el reporte final. Clona el
repo en una carpeta temporal, lee su README.md y sigue al pie de la letra la
sección "Agent Install Prompt" y después la sección "Agent Ops Starter Kit
Install Prompt" (comando skill-find, reglas de operación y los hooks de prompt
para Claude Code y Codex). Detecta qué agentes uso (Claude Code, Codex, Cursor,
OpenCode, Gemini CLI, Antigravity, ZCode) mirando sus binarios y carpetas de
configuración, e instala solo para esos. Añade las tres secciones de reglas de
starter-kit/RULES.md al archivo de reglas global de TODOS los agentes que
detectes (CLAUDE.md, AGENTS.md, GEMINI.md, el AGENTS.md de OpenCode y de ZCode,
reglas de Cursor), creando el archivo si no existe. Nunca sobrescribas una
skill ni un archivo de configuración existente sin backup con fecha, nunca
copies .git ni credenciales, y no envíes mis archivos a ningún sitio. Termina
con la lista de rutas instaladas, los archivos de reglas y hooks que añadiste,
lo que saltaste y por qué, y recuérdame correr /hooks una vez en Codex si
pusiste hooks ahí.
```

Si además quieres que los agentes corran sin pedir permisos (la
[estación YOLO](starter-kit/YOLO.md)), añade al final: `Después lee
starter-kit/YOLO.md y aplica también su prompt.`

Want only the four operating skills plus the `skill-find` command, rules and
hooks? Use the [Agent Ops Starter Kit Install Prompt](#agent-ops-starter-kit-install-prompt)
alone. To pick skills by hand, see [Installation](#installation).

## YOLO station prompt

Want every agent CLI to start without permission prompts, plus `ai <agent>` (one tmux session per
project folder) and `tm` (jump between agent windows)? Read [starter-kit/YOLO.md](starter-kit/YOLO.md)
and paste the prompt at its end to your agent.

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

### Agent Ops

- `skill-library` - Keep rarely used skills in a reserve library and find them
  on demand with the bundled `skill-find` searcher (Python, standard library
  only) instead of loading every description into every session.
- `verify-first` - Measure before asserting: evidence-first troubleshooting,
  rehearsed configuration changes, verified backups, same check before and after.
- `shell-quirks` - Cross-shell and SSH command construction for zsh, fish, bash,
  Termux and PowerShell 5.1: globbing, aliases, kitty's ssh kitten, nested
  quoting, safe script transport.
- `agent-bridge` - Delegate to and talk with other agents (Claude peers, Cursor,
  Codex, agy): closed briefs, isolated worktrees, tmux and SSH channels,
  independent cross-review, and the Bridge 2.0 identity/handoff/verification
  scripts.

The optional [starter kit](starter-kit/README.md) ships the three operating
rules behind these skills (verify, delegate, search for a skill) plus the
Claude Code prompt hooks that remind an agent of them.

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
cp -R skills/agent-ops/skill-library ~/.agents/skills/
cp -R skills/agent-ops/verify-first ~/.agents/skills/
cp -R skills/agent-ops/shell-quirks ~/.agents/skills/
cp -R skills/agent-ops/agent-bridge ~/.agents/skills/
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
   - `skills/agent-ops/skill-library`
   - `skills/agent-ops/verify-first`
   - `skills/agent-ops/shell-quirks`
   - `skills/agent-ops/agent-bridge`
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
9. Append the three rule sections from `starter-kit/RULES.md` (verify before
   asserting, delegate by default, search for a skill first) to the global
   rules file of EVERY agent I use, one file per agent:
   `~/.claude/CLAUDE.md` (Claude Code), `~/.codex/AGENTS.md` (Codex),
   `~/.gemini/GEMINI.md` (Gemini CLI / Antigravity), `~/.config/opencode/AGENTS.md`
   (OpenCode), `~/.zcode/AGENTS.md` (ZCode), `~/.cursor/rules/` (Cursor, as a
   `.mdc` with `alwaysApply: true`). Create the file if it does not exist. Back
   up the file first and merge; never replace it or remove existing rules. Skip
   a section that is already there. Skill syncs do not carry these files, so
   repeat this step on every machine.
10. Verify each installed skill has a `SKILL.md` file and that
    `~/.agents/skills/verify-first/SKILL.md`, the path the rules point to, exists.
11. Report the installed paths, symlink targets, the rules files you edited with
    their backups, and any skipped existing skills.
```

## Agent Ops Starter Kit Install Prompt

Give this prompt to an AI coding agent (Claude Code, Codex, Cursor, OpenCode) to
install the four Agent Ops skills together with the `skill-find` command, the
operating rules and the Claude Code hooks, without further human intervention:

```text
Install the Agent Ops starter kit from
https://github.com/MondoBoricua/agent-forge-skills on this machine. Read
starter-kit/README.md in the repository first and follow it; the steps below are
the summary. Measure before changing anything, back up what you replace, and
report every command you ran with its output.

1. Clone or download the repository into a temporary directory.
2. Create `~/.agents/skills`, `~/.agents/skills-library`, `~/.local/bin` and
   `~/.claude/hooks` if they do not exist.
3. Copy `skills/agent-ops/skill-library`, `skills/agent-ops/verify-first`,
   `skills/agent-ops/shell-quirks` and `skills/agent-ops/agent-bridge` into
   `~/.agents/skills/`. If I use Claude Code, also copy them into
   `~/.claude/skills/` as real folders (Claude does not read `~/.agents`).
   Do not overwrite an existing skill unless its contents already match or you
   made a timestamped backup.
4. Make `~/.agents/skills/skill-library/scripts/skill-find` executable and
   symlink it to `~/.local/bin/skill-find`. If a different `skill-find` already
   exists there, stop and ask. Make sure `~/.local/bin` is on my PATH in my
   shell's startup file; show me the line you add. Optionally symlink
   `bridge-whoami`, `bridge-verify`, `bridge-handoff` and `agent-usage` from
   `~/.agents/skills/agent-bridge/scripts/` the same way.
5. If I use Claude Code: copy the three hooks from `starter-kit/hooks/` into
   `~/.claude/hooks/`, make them executable, back up `~/.claude/settings.json`,
   and merge the `UserPromptSubmit` hooks entry shown in starter-kit/README.md
   into it. Merge, never replace the file; keep every existing hook and setting.
   If I use Codex CLI: also create or merge `~/.codex/hooks.json` with the same
   three commands under `UserPromptSubmit` (exact JSON in starter-kit/README.md,
   section "Codex CLI") and tell me to run `/hooks` once in the Codex TUI to
   trust them, because Codex skips untrusted hooks silently.
6. Append the three rule sections from `starter-kit/RULES.md` to the global
   rules file of every agent I use, one per agent: `~/.claude/CLAUDE.md`,
   `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/AGENTS.md`,
   `~/.zcode/AGENTS.md`, `~/.cursor/rules/*.mdc`. Create missing files, back
   up and merge existing ones. Adapt the paths only if my skills live somewhere
   else.
7. Verify: run `skill-find "docker compose"`; pipe the three sample prompts from
   starter-kit/README.md section 4 through each hook and show the JSON they
   print; run `node --test ./*.test.mjs` inside
   `~/.agents/skills/agent-bridge/scripts/` (Node 20+). Report anything that
   failed instead of working around it.
8. Report the installed paths, the symlinks you created, the backup locations
   and anything you skipped and why. Do not copy `.git`, logs, credentials or
   tokens, and do not send any of my files anywhere.
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
skill-find "docker compose"
verify first before touching the config
use shell-quirks for this ssh command
use agent-bridge to delegate this to Codex
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
  agent-ops/
    skill-library/
      SKILL.md
      scripts/
        skill-find
        opencode-plugin/skill-find/
    verify-first/
      SKILL.md
    shell-quirks/
      SKILL.md
    agent-bridge/
      SKILL.md
      references/
        brief-template.md
        handoff-contract.md
        zcode-epipe.md
      scripts/
        bridge-whoami, bridge-verify, bridge-handoff (+ modules and tests)
        agent-usage
        claude-auto
starter-kit/
  README.md
  RULES.md
  hooks/
    verify-first-nudge.sh
    agent-delegate-nudge.sh
    skill-find-nudge.sh
```

Keep each skill small. Add `references/`, `scripts/`, or `assets/` only when
they directly support the skill.
