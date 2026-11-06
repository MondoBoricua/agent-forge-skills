# YOLO station: every agent without permission prompts, one command per project folder

Two pieces, both from the `agent-bridge` skill:

1. **Shell aliases** so the bare command of each CLI starts without permission prompts, with a
   `-safe` variant to get the normal behavior back. Same lines in zsh and fish.
2. **`ai` and `tm`** (`skills/agent-ops/agent-bridge/scripts/`): `ai <agent>` opens or re-attaches
   a tmux session for the current folder with that agent in YOLO mode (`ai safe <agent>` without
   the flags); `tm` is an fzf picker over every tmux window (session, agent, mode, path) with a
   live preview. Requirements: bash 3.2+, tmux, fzf, python3, and the agent CLIs you use
   (`claude`, `codex`, `agy`, `cursor-agent`, `opencode`, `copilot`, `zcode`, `dsh`).

## 1. Aliases

zsh (`~/.zshrc`):

```bash
# agent defaults: skip permissions; use -safe for the normal mode
alias claude='claude-auto'            # scripts/claude-auto: --continue only if there is history and no live claude in the cwd
alias claude-new='command claude --dangerously-skip-permissions'
alias claude-safe='command claude'
alias codex='command codex --dangerously-bypass-approvals-and-sandbox'
alias codex-safe='command codex'
alias agy='command agy --dangerously-skip-permissions'
alias agy-safe='command agy'
alias zcode='command zcode --mode yolo'   # TUI in yolo; headless -p is already yolo by default
alias cursor-agent='command cursor-agent --force --approve-mcps --trust'
alias cursor-agent-safe='command cursor-agent'
```

fish (`~/.config/fish/config.fish`): the same lines, fish accepts this `alias name='…'` form.

`claude-auto` is the wrapper shipped in `skills/agent-ops/agent-bridge/scripts/`; symlink it into
`~/.local/bin` or alias `claude` directly to `command claude --dangerously-skip-permissions`.

## 1b. Headless calls (what `agent-bridge` delegation uses)

Aliases only cover the interactive commands. Headless calls in briefs are explicit:

- Codex: put the defaults in `~/.codex/config.toml` so `codex exec` never asks and can write
  (measured: the header then prints `approval: never` / `sandbox: danger-full-access`):

  ```toml
  approval_policy = "never"
  sandbox_mode = "danger-full-access"
  ```

  Without that, pass `codex exec --dangerously-bypass-approvals-and-sandbox …` per call.
- Cursor: `cursor-agent -p --trust --force …`
- agy: `agy --dangerously-skip-permissions -p='…'` (the alias adds it; name it in scripts)
- zcode: `zcode -p '…'` is yolo by default; `--mode yolo` for the TUI
- Copilot: `copilot -p '…' --allow-all-tools` (without it, it answers but runs no tools)
- OpenCode: `opencode run --auto …`

## 2. `ai` and `tm`

```bash
install -m 755 skills/agent-ops/agent-bridge/scripts/ai ~/.local/bin/ai
install -m 755 skills/agent-ops/agent-bridge/scripts/tm ~/.local/bin/tm
ai status        # versions, flags and auth per agent (no secrets)
ai codex         # tmux session "<folder>-codex" in YOLO; Ctrl+b d to detach
ai safe codex    # same agent, normal permissions
tm               # jump to any agent window
```

Flags each agent gets in YOLO are listed by `ai plan <agent>` (prints the command, runs nothing).
Measured on macOS; the scripts refuse to run on Termux or Windows because those hosts have their
own station.

## 3. Prompt for an agent

```text
Set up the YOLO agent station from https://github.com/MondoBoricua/agent-forge-skills on this
machine. Clone the repo into a temporary folder and read starter-kit/YOLO.md. Then: (1) detect
which agent CLIs I have (claude, codex, agy, cursor-agent, opencode, copilot, zcode, dsh) and
which shells I use (zsh, fish, bash); (2) add the aliases from YOLO.md for the agents I have to
my shell startup files, keeping a -safe variant for each, backing up every file first and never
duplicating an alias that already exists; (3) install scripts/ai, scripts/tm and
scripts/claude-auto from skills/agent-ops/agent-bridge/scripts/ into ~/.local/bin, make them
executable, and make sure ~/.local/bin is on my PATH in each shell (show me the line you add);
(4) check that tmux, fzf and python3 are installed and tell me what to install if not;
(5) verify with `ai status`, `ai plan codex` and `tm --list` in a new shell of each kind, and
show me the output. Do not send my files anywhere and do not log in to any agent for me.
```
