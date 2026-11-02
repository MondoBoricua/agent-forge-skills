#!/bin/bash
# UserPromptSubmit hook: remind the agent to measure troubleshooting and config claims.
# No match or malformed JSON: no output. This reminder does not block requests.
exec python3 -c '
import json, re, sys
try:
    prompt = json.load(sys.stdin).get("prompt", "") or ""
except Exception:
    sys.exit(0)
pat = (r"\bno (funciona|sirve|anda|abre|arranca|carga|conecta|aparece|se ve|responde)\b"
       r"|\bfall(a|an|o|ó|ando)\b|\berror(es)?\b|\broto\b|\brota\b|se romp|se cuelga|se congela|\bcrash"
       r"|por ?qu[eé]|\barregl|\bfix(ed|ing)?\b|\bdebug|diagn[oó]s|\blent[oa]\b"
       r"|\blimpi[ae]|\bconfigur|\binstal[aeo]|\bdesinstal|\bactualiz|duplicad"
       r"|troubleshoot|\bbroken\b|not working|doesn.?t work|\bwhy\b|\bslow\b")
if re.search(pat, prompt, re.IGNORECASE):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
        "additionalContext": "verify-first: this prompt appears to request troubleshooting or a configuration change. Load verify-first. Measure system state, tool behavior, versions and hardware with a command and its output, or cite a source URL. Label anything unverified as a hypothesis and provide the check that would confirm it."}}))
'
