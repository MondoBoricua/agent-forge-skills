---
name: shell-quirks
description: >-
  Cross-shell and SSH command construction for zsh, fish, bash, Termux, and PowerShell 5.1.
  Use before ssh, scp, container exec, or Windows commands; on "no matches found",
  "bad substitution", "STDIN must be a terminal", or login failures over SSH.
  Covers aliases, kitty, RemoteCommand, nested quoting, and safe script transport.
---

# Shell Quirks

A command-construction reference, not a host inventory. Read the destination's documented
shell and SSH configuration before writing a remote command. Verify behavior locally with
`verify-first`; shell versions, aliases, wrappers, and permissions vary by installation.

## Inventory template

Fill this table from measurements before using it. The following two rows are examples;
replace them with verified values. Keep addresses, credentials, and private topology out
of public documentation.

| SSH alias | OS / default shell | Interactive wrapper | RemoteCommand / HostKeyAlias | Verified command |
|---|---|---|---|---|
| `example-host` | Linux / bash | None | None / example-host | `<record command and output>` |
| `example-windows` | Windows / PowerShell 5.1 | None | None / example-windows | `<record command and output>` |

Keep any local alias inventory in `~/.ssh/AGENTS.md` or another private document.

## Identify the executing shell

A tool named Bash does not prove it launches bash. Inspect the process, executable, and tool
configuration. Scripts run under their own shebang; interactive aliases and functions may
not apply. Shell-tool snapshots can retain old `.zshrc` definitions after edits. Inspect with
`command -v <command>` and test the intended file by absolute path. Interactive menus such
as fzf may read `/dev/tty`, even when stdin is redirected from `/dev/null`.

## zsh

| Trap | Symptom | Remedy |
|---|---|---|
| Unmatched glob under `nomatch` | Entire command aborts with `no matches found` | Quote patterns such as `--include='*.ts'`; use `find` or a deliberate `setopt null_glob`. |
| Inline code with metacharacters | Shell expands code before the interpreter sees it | Use a heredoc with a quoted delimiter. |
| Bare `> file` and NULLCMD | May run `cat > file` and wait for input | Use `: > file` to truncate explicitly. |
| `path` and `UID` variables | PATH changes unexpectedly or assignment fails | Use task-specific variable names; `path` is tied to PATH and `UID` is readonly. |
| Unquoted list variable | One iteration rather than word splitting | Use arrays, explicit line splitting, or `${=TASK_LIST}` when intentional. |
| Multiword command stored in a string | Whole string is treated as an executable name | Use a function or an array, e.g. `runner=(python3 -I); "${runner[@]}" script.py`. |
| `${v##*=}` on labels containing `=` | Removes too much | Use `${v#*=}` for the first delimiter or choose a distinct separator. |
| `ls` replaced by `lsd` | BSD flags rejected; ANSI output breaks parsing | Use `/bin/ls` and inspect aliases. |
| BSD grep filters remote output as binary | Empty filtered output despite remote execution | Use `grep -a`, filter remotely, or sanitize text deliberately; retain unfiltered evidence and exit status. |

Hidden-file patterns also fail when unmatched. For directory sizes, prefer `find` or enable
null-glob behavior deliberately rather than relying on `dir/.[!.]*` always matching.

```bash
python3 - <<'PYEOF'
print('literal code: * [ ] $')
PYEOF
```

## fish and shell parity

fish is not POSIX. Avoid translating a long bash script piecemeal; transmit it and run bash
explicitly on a host where bash exists.

| bash | fish |
|---|---|
| `$?` | `$status` |
| `export X=1` | `set -gx X 1` |
| `a && b` / `a || b` | `a; and b` / `a; or b`; check version-specific operator support |
| `$(command)` | `(command)` |
| `while …; do …; done` | `while …; …; end` |
| Heredoc | Use `printf '%s\n' …` piped to the command, or a script file |
| `[ -f file ]` | `test -f file` |

```bash
/usr/bin/ssh example-host 'bash -lc "command -v python3"'
/usr/bin/ssh example-host bash -s < script.sh
```

fish and zsh configurations are independent. Prefer an executable script in `~/.local/bin`
for commands shared by both. If a function is necessary, maintain and test both definitions;
look in fish's `functions/` directory as well as `config.fish`. Keep duplicated Windows-host
wrapper lists consistent.

## Aliases and kitty SSH

Inspect aliases before automation. `ls` may add ANSI codes or use a replacement binary.
Inside kitty, `ssh` and `scp` may invoke its interactive kitten. Use `/usr/bin/ssh` and
`/usr/bin/scp` for noninteractive commands, and set `GIT_SSH_COMMAND=/usr/bin/ssh` when needed.

`STDIN must be a terminal` can be a local wrapper failure rather than a dead host. The
kitten's POSIX bootstrap can also fail in Windows shells with `'die' is not recognized`
or an unfinished prompt. Exclude Windows aliases from interactive wrappers in every shell.

## SSH decision sequence

1. For scripts or checks, use the actual SSH executable.
2. Inspect the alias for `RemoteCommand` and TTY settings. Disable interactive startup behavior
   for a command invocation with `-o RemoteCommand=none -o RequestTTY=no`.
3. If no stdin is required, redirect from `/dev/null` so SSH cannot consume the caller's input.
4. For Windows, identify whether the default is cmd or PowerShell; do not assume.
5. For nested quotes, substitutions, or multiple execution layers, transmit a script.

```bash
/usr/bin/ssh -o RemoteCommand=none -o RequestTTY=no -o ConnectTimeout=5 example-host 'command -v python3' </dev/null
```

An alias with a configured startup command may open a TUI or container shell rather than
execute the requested command, or the client may reject the conflicting options. Inspect
`ssh -G <alias>` and use the explicit override. A container-host alternative is
`/usr/bin/ssh example-host 'pct exec <container-id> -- <command>'`.

Use configured aliases where host keys differ between operating systems on a multiboot
machine. Record a distinct `HostKeyAlias` for each OS. On a key mismatch, verify the cause
and fingerprint first; do not blindly erase host-key records or disable verification.

Before blaming quoting:

```bash
nc -w3 -z <hostname> 22
command -v /usr/bin/ssh
rg -n -A4 '^Host example-host$' ~/.ssh/config
```

A failed port probe points to connectivity or service availability; it does not identify
which network component failed. Check the shell only after transport and configuration.

## Nested execution layers

Each shell can consume another layer of escapes. Watch for local expansion of remote
`$()` expressions, `bad substitution`, and syntax errors near parentheses.

For a single shell, a quoted heredoc prevents local expansion:

```bash
/usr/bin/ssh example-host 'cat > /tmp/task.sh' <<'SCRIPT'
printf '%s\n' 'literal content'
SCRIPT
```

For more layers, copy and execute a file, inspecting the received content before execution:

```bash
/usr/bin/scp task.sh example-host:/tmp/task.sh
/usr/bin/ssh example-host 'cat /tmp/task.sh'
/usr/bin/ssh example-host 'bash /tmp/task.sh'
```

For container hops or PowerShell, base64 avoids transporting source metacharacters. It is
an encoding, not encryption; keep secrets out of commands and logs.

```bash
payload_b64=$(base64 < task.sh | tr -d '\n')
/usr/bin/ssh example-host "printf '%s' '$payload_b64' | base64 -d | bash"
```

Confirm the destination's base64 decoder flags before use. With `pct exec` or `qm guest exec`,
pass the encoded payload to a small explicit decoder at the final shell rather than stacking
complex quoted programs.

## Windows and PowerShell 5.1

- Measure the default SSH shell. If it is cmd, explicitly launch
  `powershell -NoProfile -EncodedCommand <payload>`; a bare PowerShell cmdlet will fail.
- PowerShell's encoded command expects base64 of UTF-16LE text. For `.ps1` files with
  non-ASCII text on PowerShell 5.1, use UTF-8 with BOM. Inspect the received file before running.
- In PowerShell 5.1, `curl` and `wget` can resolve to `Invoke-WebRequest`; use `curl.exe` for
  the native executable. Do not assume an installed Store `pwsh` works under SSH.
- Backslashes and nested quotes can be consumed by the sending shell. Prefer a `.ps1` file
  and `powershell -NoProfile -ExecutionPolicy Bypass -File <script>` over long inline programs.
- Quote and escape remote paths containing brackets so scp and the local shell do not glob them.
- A nested SSH hop launched from PowerShell can hang in some configurations. Diagnose with
  a minimal `whoami` probe, and compare an explicit `cmd /c` invocation before expanding it.
- Some console hosts freeze on long output under ConPTY. Redirect to a file and read bounded
  chunks; preserve the task identifier and log until termination is confirmed.
- Installers may require the user's interactive session. An explicitly authorized scheduled
  task can use `-LogonType Interactive`, a `.ps1` launched with `-File`, and a log such as
  `C:\Users\Public\task.log`. Use `-RunLevel Highest` only when elevation is authorized and
  the account supports it. Otherwise UAC can wait on a screen nobody is watching.
- Logs redirected by Windows PowerShell may be UTF-16; read them with the correct encoding.
- When a command times out, query process, port, and logs separately before repeating it.
  Timeout is not proof that the work stopped.

```bash
python3 - <<'PYEOF'
import base64
script = 'Get-Process | Select-Object -First 5 Name'
print(base64.b64encode(script.encode('utf-16le')).decode('ascii'))
PYEOF
```

## Minimal remote environments

Remote `command not found` may mean missing PATH entries or a missing executable. Measure
with `command -v docker jq python3`; use an absolute path or an intentional login shell.
Termux can restrict network inspection such as `ip addr`. Keep greetings behind an interactive
session guard so they do not corrupt scp or machine-readable output. GPU utilization inside a
container may differ from the physical host; query the relevant host when diagnosing it.

Long Unix socket paths can break SSH multiplexing and tmux, especially with macOS temporary
directories. Reproduce with a short `ControlPath` or isolated short `TMUX_TMPDIR`; account for
platform socket-length limits instead of concluding that all SSH is broken.

## macOS credentials over SSH

An app can find credentials in a graphical login yet fail over SSH because the keychain
requires interaction unavailable in the SSH security session. Distinguish this from a locked
keychain. Compare a non-printing credential probe in both contexts:

```bash
security find-generic-password -s '<service-name>' -w >/dev/null 2>&1
printf 'exit=%s\n' "$?"
```

Do not print the credential. Record the actual return code and error; `User interaction is
not allowed` suggests a session constraint. A tmux server already started from the graphical
session may retain usable access; test attaching to that existing server. Starting a new
server over SSH can inherit the same restriction. If no suitable server exists, start it
from an authorized graphical session. Where supported, an app's authenticated remote-control
feature is another option; inspect its documentation and current CLI before enabling it.

## macOS copies, external volumes, and permissions

- Measure `/usr/bin/rsync` before choosing flags; bundled versions may lack GNU options such
  as `--info=progress2`. Inspect exit status before filtering output. `rsync -rlptD SRC/ DST/`
  avoids ownership flags on a volume with ownership disabled. Compare file counts and content
  with `diff -rq`, accounting for metadata and sockets; inspect symlink loops rather than
  treating every diagnostic as corruption.
- Allocated size can change when APFS clones become ordinary copies on another volume.
  Use hashes and content comparisons rather than `du` alone to validate copies.
- Inspect immutable flags with `/bin/ls -lO`. Verify destination hashes before changing
  `uchg` protection or removing an old copy. Preserve any intended protection on the new copy.
- Moving a project requires updating stored paths: build configuration, signing-file references,
  agent project metadata and memory, briefs, and indexing roots. Inspect references before
  choosing a symlink; a trailing-slash deletion may traverse a linked target. Stop an active
  filesystem monitor when needed.
- TCC can deny an agent access to Desktop/Documents while Finder remains authorized. Inspect
  the process chain and permission error. Use an authorized Finder copy or another permitted
  working directory; do not assume an agent inherits the terminal app's permission.
- Evicted iCloud files can fail with `Resource deadlock avoided` or interrupt rsync. Inspect
  `dataless` flags, request hydration with `brctl download "<file>"`, wait, and verify the
  actual content before copying. Avoid parsing whitespace-containing filenames with `awk`.
- After application updates, Accessibility permission may need re-enabling in System Settings.
  Verify the actual error; simulator CLI install, launch, screenshot, and URL commands may
  still work even when UI automation cannot click.
- Shell startup variables are not guaranteed in every tool invocation. Load the required
  environment explicitly within the same command, without printing secrets.
- Tool guards can reject a compound command before any subcommand runs. Read the rejection;
  do not infer partial execution. Use bounded, validated paths such as `"${DEST_DIR:?}/file"`
  for authorized deletions, and never bypass a denial by disguising the action.
- A trailing-slash ignore rule such as `/build/` matches directories rather than a replacement
  symlink. If appropriate, put a local exclusion in `.git/info/exclude`. Remove Git worktrees
  through `git worktree remove` and `git worktree prune`, after inspecting their state.
- Background commands can outlive a tool timeout; preserve process handles and logs. Use the
  tool's bounded wait mechanism. After a cwd reset notice, check `pwd` and set the intended
  directory explicitly before continuing.

`grep -r` does not follow directory symlinks. For linked configuration trees use `grep -R`
or `find -L` deliberately, and prove that an empty search actually covered its target.
