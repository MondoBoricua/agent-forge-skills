# OpenCode `skill-find` plugin (API v2, OpenCode ≥ 2.x)

Canonical source of the plugin that suggests up to 3 library skills (`~/.agents/skills-library`) on every new OpenCode request,
reusing `skill-find` (`~/.local/bin/skill-find`) and its derived index. Equivalent to Claude's `UserPromptSubmit` hook.

- Install (link, no copy): `ln -s ~/.agents/skills/skill-library/scripts/opencode-plugin/skill-find ~/.config/opencode/plugins/skill-find && opencode service restart`
- Rollback: `rm ~/.config/opencode/plugins/skill-find && opencode service restart`
- Log (without the prompt text, only sha12): `~/.local/state/opencode/skill-find-plugin.log` (or `SKILL_FIND_PLUGIN_LOG`).
- Security: `execFileSync("python3", ["-I", skill-find, "--auto=<texto>", "--json"])` with no shell; the user's text is ONE argument;
  the returned names are only used inside a text notice in `event.system`; nothing from the search is ever executed; 4 s timeout; fail-open.
- Measured on two OpenCode models: glm-5.3-flash 0/5 → 5/5, glm-5.3 0/5 → 5/5, 0 false read positives across 6 negatives, 186 ms per prompt.
