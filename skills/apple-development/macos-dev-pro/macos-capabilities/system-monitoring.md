# macOS System Monitoring Utilities

Use this reference when building direct-distribution macOS utilities that show CPU, GPU, RAM, disk, thermal, battery, privacy, or power state. Prefer public APIs where they exist, but many useful Mac utility signals come from stable system commands, IORegistry properties, or private-but-read-only sensor paths. Keep collection off the main actor and make failures visible instead of silently showing zeroes.

## Core Rules

1. **Never block SwiftUI refresh paths with heavy system reads.** Poll on a timer, run commands asynchronously, and publish compact snapshots to the UI.
2. **Do not parse shell pipelines when Process can run one command directly.** Run `/usr/bin/top`, `/bin/df`, `/usr/sbin/ioreg`, etc. and parse output in Swift. This avoids quoting, shell, and pipe-buffer failure modes.
3. **Drain `Process` stdout/stderr while the child is running.** macOS pipe buffers are small. If a child writes enough data and the parent waits before reading, the child can block on `write()` and the parent blocks on `waitUntilExit()`.
4. **Never convert command failure into a fake metric.** Use `nil`, `NaN`, or an explicit unavailable state so UI can show "No data" instead of `0%`.
5. **Design for direct distribution separately from App Store sandboxing.** Reading `ioreg`, TCC databases, `/Library`, launch agents, and power settings may fail or be inappropriate under sandbox rules.

## Useful Read-Only Sources

| Metric | Source | Notes |
| --- | --- | --- |
| CPU usage | `/usr/bin/top -l 1 -n 0` | Parse `CPU usage: X% user, Y% sys, Z% idle`. |
| RAM | `/usr/sbin/sysctl -n hw.memsize` + `/usr/bin/vm_stat` | Used memory is often active + wired + compressed pages. |
| Memory pressure | `/usr/bin/memory_pressure` | Parse warning/critical labels; do not infer only from used GB. |
| Swap | `/usr/sbin/sysctl vm.swapusage` | Parse total/used MB. |
| APFS root disk usage | `/bin/df -k /System/Volumes/Data` | `/` can be the sealed system snapshot and under-report user data usage. Fallback to `/` only if Data volume is absent. |
| Process count/top processes | `ps` with explicit columns | Avoid `ps | grep`; parse rows in Swift. |
| Battery/cycles | `ioreg` power sources | Battery may be absent on desktop Macs. |
| Thermal pressure | `pmset -g therm` or `thermalpressure` where available | Treat format changes as expected. |
| GPU utilization on Apple Silicon | `/usr/sbin/ioreg -r -c AGXAccelerator -l` | `PerformanceStatistics` can expose `Device Utilization %`, `Renderer Utilization %`, `Tiler Utilization %`, and GPU memory without sudo on some systems. |
| Apple Silicon temperatures | IOHID sensor services | Sensor names vary by chip; keep this in a background reader/cache. |
| Power assertions | `/usr/bin/pmset -g assertions` | Shows processes preventing sleep/display sleep. |

## GPU Notes

For Apple Silicon GPU usage, test this first:

```bash
/usr/sbin/ioreg -r -c AGXAccelerator -l
```

Look for a `PerformanceStatistics` dictionary with keys like:

```text
"Device Utilization %"=38
"Renderer Utilization %"=37
"Tiler Utilization %"=10
"In use system memory"=1640333312
```

This is often enough for a menu bar monitor without `sudo` or `powermetrics`. Keep the reader tolerant:

- AGX class names vary by chip generation.
- The keys may be absent on Intel, older systems, virtual machines, or future macOS versions.
- Use a fallback display such as "GPU unavailable" rather than showing `0%`.
- Prefer a direct `ioreg` invocation and Swift parsing. Avoid `ioreg | grep` inside app code.

`powermetrics` is still useful for deep diagnostics, but it often needs elevated privileges and is too heavy for frequent UI polling.

## Power / Caffeine Patterns

For temporary keep-awake behavior, use `caffeinate` as a child process and store its PID:

```bash
caffeinate -ims
```

Good presets:

- `-i -m -s`: keep system/disk awake while allowing display sleep; good for OLED and USB drives.
- `-d -i -m -s -u`: aggressive Caffeine-style mode; keeps display awake too.
- `pmset displaysleepnow`: turn display off without sleeping the Mac.

If offering permanent profiles, use explicit AC/battery scopes:

```bash
sudo pmset -c sleep 0 displaysleep 2 disksleep 0 powernap 0
sudo pmset -c sleep 15 displaysleep 10 disksleep 10 powernap 1
```

Make battery profiles opt-in and clearly warn about drain.

## UI Integration

- Keep polling intervals modest. Fast dashboard polling can be 2-5 seconds; menu bar summaries should usually be 30-60 seconds unless the user explicitly wants live meters.
- Separate dense metrics into separate rows. RAM + disk + GPU details in one line will truncate in a menu bar popover.
- For long detail text, place the strongest value first: `38% uso · renderer 37% · tiler 10%`.
- Verify SF Symbols on the deployment target. Some symbols such as newer hardware names may not render on older macOS. Use stable fallbacks like `display`, `cpu.fill`, `memorychip.fill`, and `internaldrive.fill`.
