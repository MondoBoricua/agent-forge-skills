# Installing the ZCode CLI (`zcode`) from source

Measured on the Mac on 2026-10-22 (runtime 3.16.2) and re-checked against upstream on
2026-11-05: there is **no official installer for the CLI**. GitHub releases of
`zai-org/ZCode` ship only the desktop app (DMG/ZIP for macOS, EXE for Windows); the npm
packages `zcode` and `zcode-cli` (0.0.1) are unrelated placeholders; the README of
`apps/zcode-cli` says to build it from the pnpm workspace. The desktop app does not install
the CLI either.

## Recipe (macOS; ~7 min measured)

Requirements: Node 24 and pnpm, versions pinned in the repo's `mise.toml` (here Node 24.14.0
and pnpm 10.33.2).

```bash
# 1. Clone and install the workspace
git clone https://github.com/zai-org/ZCode.git ~/Developer/ZCode
cd ~/Developer/ZCode
pnpm install --frozen-lockfile

# 2. Build the packaged CLI: writes dist/zcode/{latest.json,<pkg>-<ver>.tar.gz,install.sh}
#    (scripts/build-zcode.mjs needs a base URL for install.sh; a local one is enough)
pnpm build:zcode --base-url http://127.0.0.1:8765/

# 3. Serve the dist folder and run the generated installer
cd dist/zcode && python3 -m http.server 8765 &
sh install.sh            # -> ~/.zcode/runtime/releases/<ver>, ~/.zcode/runtime/current, ~/.local/bin/zcode
kill %1

# 4. Check
zcode --version          # runtime version, e.g. 3.16.2
zcode doctor             # CLI version (0.17.0), node, platform
```

`ZCODE_DIST_HOME` and `ZCODE_DIST_BIN_DIR` change the install paths (README of the repo).
Updating: `git pull`, then steps 2 and 3 again; `install.sh` switches `~/.zcode/runtime/current` to the
new release, keeps the old one for rollback (`ln -sfn releases/<old> ~/.zcode/runtime/current`) and
overwrites `~/.local/bin/zcode`, so restore the fixed-Node wrapper afterwards. Measured: 3.16.2 → 3.17.2
in ~13 min (`pnpm install` ~10 min because the desktop package rebuilds Electron, build ~1 min).

## Traps (measured)

- The `~/.local/bin/zcode` that `install.sh` writes does `exec node …`, so it fails in a shell
  without Node on PATH (fish, clean zsh): `exec: node: not found`. Fix: a 4-line wrapper with the
  absolute Node path, e.g. `exec "$HOME/.nvm/versions/node/v24.14.0/bin/node" "$HOME/.zcode/runtime/current/bin/zcode.mjs" "$@"`.
  Independent of the nvm default.
- With ZCode.app installed on the same machine, log the CLI in **only** with the Coding Plan API
  key (`/login zai-coding-plan-api-key <key>` in the TUI). `zcode login zai` (OAuth) from the CLI
  logs the desktop app out (`oauth-logout:zai`). Details in the private canon of this skill.
- The CLI and the app share `~/.zcode/v2/` (login, settings); CLI data lives in `~/.zcode/cli/`.
  Global rules: `~/.zcode/AGENTS.md`; skills roots: `~/.zcode/skills` and `~/.agents/skills`.
- Version numbers differ by design: `zcode --version` is the runtime (3.16.2), `zcode version` /
  `zcode doctor` is the CLI inside it (0.17.0). The app can be ahead (3.17.2 on 2026-11-05).
