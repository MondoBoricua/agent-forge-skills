---
name: kali-mac
description: >
  Help use Kali Linux tools from a Mac for authorized, defensive security
  learning and lab work. Use when the user asks about Kali on macOS, Kali VMs,
  Kali containers, local lab tooling, tool selection, safe command discovery,
  or how to choose and learn Kali apps without targeting third-party systems.
---

# Kali Mac

Help the user work with Kali tooling from macOS in a safe, authorized,
defensive context. Prefer tool discovery, environment setup, documentation,
local labs, and validation workflows over attack recipes.

Match the user's language. If the conversation is mostly Spanish, respond in
Spanish. If it is mostly English, respond in English. If the context is mixed,
prefer the language used in the user's most recent request.

## Scope

Use this skill for:

- choosing Kali tools by defensive goal,
- using Kali in a VM, container, SSH session, or local lab,
- discovering installed tools and reading their help,
- building study plans for security tooling,
- validating owned systems, toy targets, CTFs, or explicitly authorized labs,
- translating tool output into defensive findings and remediation steps.

Do not use this skill for:

- public targets without explicit authorization,
- exploitation walkthroughs against real systems,
- stealth, persistence, evasion, malware, phishing, credential theft, or
  unauthorized access,
- dumping, cracking, or reusing secrets from third parties,
- turning scan output into attack chains.

## Workflow

1. Confirm the context is owned, local, educational, CTF, or explicitly
   authorized.
2. Identify the user's goal: discovery, inventory, web testing, wireless lab,
   forensics, password policy validation, reporting, or remediation.
3. Determine how Kali is being accessed from macOS: VM, container, SSH, terminal
   alias, or package installed locally.
4. Discover available tools instead of assuming a fixed list.
5. Prefer safe help commands before execution.
6. Provide bounded, defensive commands and explain what output means.
7. End with cleanup, reporting, or remediation guidance.

## Tool Discovery

Inside Kali, start with:

```bash
command -v <tool>
<tool> --help
man <tool>
apropos <keyword>
dpkg -l | grep -i <keyword>
ls /usr/share/kali-menu/applications 2>/dev/null
```

On macOS, first identify the access method:

```bash
uname -a
which ssh docker podman colima multipass utm 2>/dev/null
```

If the user has a known local alias or wrapper, ask before relying on it unless
the current context already defines it.

## Tool Areas

Use categories instead of memorizing every Kali app:

- Recon and inventory: identify assets and exposed services in authorized
  ranges.
- Web assessment: test local or authorized web apps and map findings to fixes.
- Wireless labs: practice only on owned lab hardware and test networks.
- Forensics: inspect images, logs, memory captures, and timelines.
- Reverse engineering: analyze owned binaries or educational samples.
- Password policy validation: evaluate strength and rotation needs without
  exposing secrets.
- Reporting: summarize findings, evidence paths, risk, and remediation.

For each area, choose tools by asking:

```text
What asset is owned or authorized?
What question are we trying to answer?
What evidence is needed?
What is the least invasive tool that answers it?
How will we clean up and report results?
```

## Safe Command Pattern

Prefer this shape:

```text
Goal: [defensive outcome]
Tool: [tool name]
Why this tool: [short reason]
Dry run/help: [safe discovery command]
Run: [bounded command, only if authorized]
Read output as: [defensive interpretation]
Next: [remediation/reporting step]
```

## Boundaries

- Keep commands bounded by time, scope, or explicit target.
- Do not include private hosts, customer names, credentials, hashes, potfiles,
  dumps, or report rows in reusable artifacts.
- If the user asks for public repo content, sanitize examples to placeholders.
- If authorization is unclear, pause and ask for scope.
- If the request turns offensive, refuse that part and redirect to safe lab,
  defensive, or educational alternatives.

## Tool Playbook

For concrete Mac/Kali tool workflows, read
`references/tool-playbook.md` only when the user asks for steps, examples,
installed-tool usage, HTB-style lab flow, or local network practice.
