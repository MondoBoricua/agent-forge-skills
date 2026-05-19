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
- `hands-on` - Discover and read local `AGENTS.md` or `CLAUDE.md` context before
  starting work.
- `skill-authoring` - Create, review, and sanitize agent skills.
- `ultra-precise` - Use compact, high-signal technical responses.

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
cp -R skills/productivity/hands-on ~/.agents/skills/
cp -R skills/productivity/skill-authoring ~/.agents/skills/
cp -R skills/productivity/ultra-precise ~/.agents/skills/
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
ln -s ~/.agents/skills/hands-on ~/.claude/skills/hands-on
ln -s ~/.agents/skills/skill-authoring ~/.claude/skills/skill-authoring
ln -s ~/.agents/skills/ultra-precise ~/.claude/skills/ultra-precise
ln -s ~/.agents/skills/kali-mac ~/.claude/skills/kali-mac
ln -s ~/.agents/skills/macos-dev-pro ~/.claude/skills/macos-dev-pro
ln -s ~/.agents/skills/macos-ui-pro ~/.claude/skills/macos-ui-pro
ln -s ~/.agents/skills/swiftui-pro ~/.claude/skills/swiftui-pro
```

Restart or reload your agent environment or Claude session if it does not
discover new skills automatically.

## Agent Install Prompt

Give this prompt to an AI coding agent when you want it to install these skills
without further human intervention:

```text
Install the reusable skills from https://github.com/MondoBoricua/agent-forge-skills
into the local skills directories for Codex/agents and Claude when available.

Steps:
1. Create these directories if they do not exist:
   - `~/.agents/skills`
   - `~/.claude/skills`
2. Clone or download the repository into a temporary directory.
3. Copy these folders into `~/.agents/skills/`:
   - `skills/productivity/agent-handoff`
   - `skills/productivity/challenge-plan`
   - `skills/productivity/hands-on`
   - `skills/productivity/skill-authoring`
   - `skills/productivity/ultra-precise`
   - `skills/cybersecurity/kali-mac`
   - `skills/apple-development/macos-dev-pro`
   - `skills/apple-development/macos-ui-pro`
   - `skills/apple-development/swiftui-pro`
4. For Claude, prefer symlinking from `~/.claude/skills/<skill-name>` to the
   matching `~/.agents/skills/<skill-name>` so both tools read the same files.
5. Do not overwrite an existing local skill or symlink unless its contents already match
   this repository or you have made a timestamped backup.
6. Do not copy `.git`, logs, dumps, datasets, reports, exports, environment
   files, secrets, tokens, credentials, hashes, or potfiles.
7. If one destination is not used on this machine, skip it and say why.
8. Verify each installed skill has a `SKILL.md` file.
9. Report the installed paths, symlink targets, and any skipped existing skills.
```

## Usage

Invoke skills naturally in conversation:

```text
/agent-handoff
challenge this plan
/hands-on
kali on mac
use macos-dev-pro for this menu bar utility
use skill-authoring to draft a new skill
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
