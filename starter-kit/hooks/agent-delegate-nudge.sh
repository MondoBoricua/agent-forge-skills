#!/bin/bash
# UserPromptSubmit hook: remind the coordinator to delegate implementation.
# No match or an input error: exit successfully without output.
[ -e "$HOME/.claude/agent-skills-off" ] && exit 0
[ "${CLAUDE_NO_AGENT_SKILLS:-}" = "1" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0
exec python3 -c '
import json, re, sys
try:
    prompt = json.load(sys.stdin).get("prompt", "")
    if not isinstance(prompt, str):
        sys.exit(0)
except Exception:
    sys.exit(0)
if re.match(r"^\s*[¿?]?\s*(?:qu[eé]|cu[aá]nt[oa]s?|expl[ií]came|mu[eé]strame|lista|verifica si|mide|por qu[eé]|reinicia|borra|p[aá]sale|resume)\b", prompt, re.IGNORECASE):
    sys.exit(0)
pat = (r"\b(?:crea|cr[eé]ame|hazme|haz\s+un(?:a)?|escribe|escr[ií]beme|implementa|programa|desarrolla|codea|agrega|a[nñ]ade|agr[eé]gale|m[eé]te(?:le)?|parchea|refactor(?:iza)?|migra|portea|build|compila|write|implement|refactor|migrate|patch|scripted)\b"
       r"|\barregla\s+el\s+(?:c[oó]digo|script|bug)\b"
       r"|\bconvierte\b.{0,100}\ba\s+(?:python|bash|zsh|node|swift)\b"
       r"|\b(?:un|una)\s+(?:script|wrapper|hook|backend|funci[oó]n|comando|alias|plugin|cask|workflow)\b"
       r"|\b(?:PR|pull request|fork|tests?|testea|add\s+(?:a|an|the)|create\s+(?:a|an)|port|wire\s+up|hook\s+up|script|backend|endpoint|feature)\b"
       r"|\bcambia\s+(?:el|la|los|las)\s+(?:greedy|c[oó]digo|script|hook|backend|endpoint|funci[oó]n|feature)\b")
if re.search(pat, prompt, re.IGNORECASE):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
        "additionalContext": "delegate-by-default: this prompt appears to request implementation (code, script, patch, hook or backend). Load agent-bridge if needed. Delegate implementation to an available agent in an isolated worktree with a closed brief: objective, allowed and forbidden files, branch and required checks. Coordinate, verify live and synthesize the result. Risky server, authentication or deployment changes need at least two independent reviews. Exceptions: the user explicitly opts out, or the answer is one line without code."}}))
'
