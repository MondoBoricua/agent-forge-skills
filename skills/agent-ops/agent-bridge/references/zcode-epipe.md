# ZCode EPIPE: diagnosis and a scoped local patch

Apply `verify-first` before using this recipe. Upstream reference:
[zai-org/feedback #965](https://github.com/zai-org/feedback/issues/965).
Inspect the installed version and current upstream status; this recipe does not establish that a current version contains the bug.

## Identify the actual error path

A candidate symptom is `Turn execution failed`, `provider_code=EPIPE`, `reason=unknown`, `retryable=false`.
Inspect whether the effective `isNetworkFailure` predicate recognizes ECONNRESET but omits EPIPE.
Trace both the raw error and `ProviderBusinessError` paths before proposing a patch.

EPIPE indicates a write to a closed end, which may be a socket or a local pipe. It does not prove an Internet outage or establish connection quality.
If another error path produced the symptom, investigate that path instead.

## Resolve effective code before editing

Inspect `command -v zcode`, the launcher, symlinks, and the loaded entrypoint. Record the installed application version, using
`plutil -extract CFBundleShortVersionString raw /Applications/ZCode.app/Contents/Info.plist` when that macOS app exists.
Do not print credentials, provider configuration, or complete logs.

Search the effective code with `rg -n 'isNetworkFailure|ECONNRESET|ProviderBusinessError'`.
For minified bundles, inspect bounded text around the match rather than dumping an entire line.
A launcher or wrapper may load a different bundle: editing the wrapper does not necessarily change the classifier.
Do not rely on minified names, line numbers, old hashes, or an environment override without confirming which code actually loads.

## Rehearse a minimal change in an isolated copy

1. Record the version, effective path, SHA256 (`shasum -a 256`), and `node --check` result.
   For a signed macOS application, also record `codesign --verify --deep --strict /Applications/ZCode.app` and its exit code.
2. Copy the effective bundle to staging and retain an immutable original. Extract the actual predicate.
   Require `source.count(old) == 1`; abort if there are zero or multiple matches.
3. Only if this exact omission is confirmed, insert `normalized === "EPIPE" ||` into the existing network-code comparison,
   or its equivalent in the current minified predicate. For example:

   ```javascript
   // Original candidate, only after confirming this is the effective predicate:
   return normalized === "ECONNRESET" || normalized === "ECONNREFUSED";
   // Candidate patch:
   return normalized === "ECONNRESET" || normalized === "EPIPE" || normalized === "ECONNREFUSED";
   ```

   Do not replace error codes globally, catch every exception, or introduce unlimited retries.
4. Check `candidate == original.replace(old, new, 1)` and ensure there is no other difference. Record both hashes.
   Run `node --check` and the same original/patched classifier tests. Cover raw EPIPE, lowercase codes, nested causes,
   and `ProviderBusinessError`; preserve behavior for existing network codes and terminal authentication,
   invalid-request, cancellation, and unknown errors. Use fixtures compatible with the installed SDK's class identities.
5. Before changing a sealed resource in a signed application, obtain explicit approval for that exact signature-invalidating change.
   Show the file and consequence. Do not re-sign the application or change permissions/security settings on your own.
6. Immediately before applying, recheck that the destination matches the rehearsed original hash and the candidate matches its recorded hash.
   On drift, stop and repeat the audit. Create a backup with `cp -p` and verify it with `cmp`.
   Do not overwrite an existing backup unless its hash matches. Keep desktop backups outside the application bundle.
7. Copy only the verified candidate to the destination, preserve its mode, and check its hash, `cmp` against the candidate,
   and `node --check`. If a patch check fails, restore the verified backup.
   Record any approved signature loss explicitly as a consequence, never as a passing check.
8. Check loading with the real runtime and installed dependencies without starting a paid turn merely to test syntax.
   Coordinate before closing/reopening an app with active work. Record separately whether the full UI, a real disconnection,
   and a full retry were tested; syntax or help output does not establish those outcomes.

## Evidence, rollback, and recurrence

Keep a report, originals, candidates, a hash manifest, and classifier tests in a project staging directory such as
`~/projects/app/staging/zcode-epipe/`. Record actual commands, outputs, and exit codes. No historical passing count is a substitute for a fresh run.

To roll back the same installation, first check that the destination still matches the recorded patched hash and the backup matches the original.
Then run `cp -p <backup> <destination>`, `cmp`, `node --check`, and signature verification for a desktop bundle.
Reopen the app to load the original. Never restore an old bundle onto a different version, or assume a signature is valid without measuring it.

An update may replace a local patch. If the symptom returns, resolve versions and effective paths again and check whether the installed upstream code already handles EPIPE.
Repeat the original/patched control only if the omission remains. If EPIPE is already recognized, investigate the new path instead.
Do not install a hook that blindly rewrites every update.
