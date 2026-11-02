#!/bin/bash
# UserPromptSubmit: suggest at most three matching library skills, capped at 400 characters.
# Threshold: at least two matching tokens and score >= 8. No match: no output.
SF="$HOME/.local/bin/skill-find"
[ -x "$SF" ] || SF="$HOME/.agents/skills/skill-library/scripts/skill-find"
[ -x "$SF" ] || exit 0
export SF
python3 -I -c '
import json, os, subprocess, sys
try:
    prompt = json.load(sys.stdin).get("prompt", "")
    if not isinstance(prompt, str) or len(prompt.strip()) < 20:
        sys.exit(0)
    if "<task-notification>" in prompt or "[SYSTEM NOTIFICATION" in prompt or prompt.lstrip().startswith("<"):
        sys.exit(0)  # Internal notifications and system messages are not user requests.
    proc = subprocess.run([sys.executable, "-I", os.environ["SF"], "--auto", prompt, "--json"], capture_output=True, text=True, timeout=4)
    rows = json.loads(proc.stdout) if proc.returncode == 0 and proc.stdout.strip() else []
    rows = [r for r in rows if r.get("bucket") == "library"][:3]
    if rows:
        prefix = "skill-find: possible library skills for this task: "
        suffix = "; if relevant, read ~/.agents/skills-library/<skill>/SKILL.md before starting"
        names = ", ".join(str(r["name"]) for r in rows)
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": (prefix + names + suffix)[:400]}}, ensure_ascii=False))
except Exception:
    pass
' 2>/dev/null
exit 0
