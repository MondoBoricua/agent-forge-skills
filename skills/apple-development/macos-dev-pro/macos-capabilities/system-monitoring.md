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

## Reader Architecture

Build monitoring code around independent readers instead of letting views fetch
system state directly:

- One reader per source family: CPU load, top processes, RAM, disk capacity,
  GPU, battery, sensors, network, etc.
- Each reader has `start`, `stop`, `readNow`, and `setInterval` operations.
- Reader callbacks publish typed snapshots such as `CPUUsageSnapshot`,
  `DiskSnapshot`, or `SensorSnapshot`, not loosely typed dictionaries.
- Keep previous samples inside the reader when metrics require deltas. CPU and
  network percentages are usually derived from the difference between two
  samples, not from one absolute read.
- Gate optional readers by platform and permission. Apple Silicon sensors,
  Intel SMC keys, battery data, SMART data, and external disks are all
  conditional capabilities.
- Stop readers when their module is disabled. Pause expensive detail readers
  when only the compact menu bar summary is visible.

Prefer `DispatchSourceTimer` or a dedicated background task loop over `Timer`
inside SwiftUI views. Deliver UI updates back to the main actor only after the
snapshot is ready.

## Native API Guidance

Use native APIs when they give structured data and lower overhead:

- **Mach counters for CPU/RAM:** use `host_processor_info`,
  `host_statistics`, `host_statistics64`, and `host_info` before falling back
  to `top`, `vm_stat`, or `memory_pressure`. Always retain the previous sample
  for percentage or rate calculations.
- **SystemConfiguration for network identity:** use `SCDynamicStore` and
  `SCNetworkInterface` to discover primary interface, BSD name, user-facing
  display name, MAC address, DNS servers, and interface type.
- **CoreWLAN for Wi-Fi:** use `CWWiFiClient`/`CWInterface` for SSID, BSSID,
  country code, channel, security, PHY mode, RSSI/noise, and transmit rate.
  Expect values to be nil or redacted.
- **IOKit power sources for battery:** use IOPS APIs for high-level charging
  state and IORegistry `AppleSmartBattery` properties for detail values such as
  cycle count, raw capacity, voltage, amperage, and temperature.
- **DiskArbitration for disks:** use `DADisk` descriptions for BSD name,
  removability, protocol, model, volume kind, media UUID, and mounted path.
- **IORegistry for hardware inventory:** use matching services such as
  `IOPlatformExpertDevice`, `IOPCIDevice`, `IOAccelerator`, or class-specific
  services, but always treat missing keys as normal.

Private or unstable APIs need isolation:

- Put IOReport, IOHID sensor access, SMC access, NVMe SMART, and undocumented
  IORegistry keys behind capability-specific readers.
- Compile-gate architecture-specific paths with `#if arch(arm64)` or
  `#if arch(x86_64)` when the source is platform-specific.
- Fail each source independently. If ANE power, SMART, or HID sensors fail,
  keep CPU/RAM/disk/network running.
- Do not promise App Store compatibility for private sensors or hardware
  registry access.

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

## Disk and Sensor Notes

Disk monitors should treat mounted volumes as a changing set. Track disks by a
stable identifier such as BSD name or volume UUID, remove entries that disappear,
and keep removable/hidden volumes behind explicit preferences. For free space,
try multiple sources in order: `statfs`, URL volume capacity resource values,
then `FileManager.attributesOfFileSystem`. Do not assume APFS purgeable space is
cheap to calculate; cache it and refresh on a slower interval.

Sensor monitors should normalize raw sensors into a user-facing model:

- classify sensors by type: temperature, fan, voltage, current, power, energy;
- hide impossible values by default, such as zero-degree temperature or extreme
  outliers;
- group chip-specific sensors into stable summaries such as average CPU,
  hottest CPU, average GPU, hottest GPU, fastest fan, total system power;
- expose unknown sensors only behind an advanced setting;
- keep Intel SMC, Apple Silicon IOReport/IOHID, and calculated sensors as
  separate paths so one failure does not blank the whole module.

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

## Battery Charge Limits and SMC

macOS does not provide a stable public `pmset` API for "cap battery at 80%" on modern MacBooks. AlDente-style tools use SMC control behind a privileged boundary:

- Older Intel flows may expose `BCLM` as a direct battery charge limit key.
- Apple Silicon flows usually control state instead of a direct percent: pause charging with `CHTE` or `CH0C`, and optionally force discharge / adapter behavior with `CHIE` or `CH0I`.
- Probe keys before writing. Do not write guessed SMC keys.
- Keep SMC writes out of the SwiftUI app process. Use a signed privileged helper, XPC/Authorization Services, a root LaunchDaemon with a tightly scoped local socket protocol, or an explicit Terminal/admin handoff.
- For an AlDente-like UX, install a permanent root helper once into `/Library/PrivilegedHelperTools` with a `/Library/LaunchDaemons` plist. The normal app should then talk to that helper without prompting every time the user opens the Battery screen.
- Do not ask for admin on read-only screen entry. Prompt only to install/reinstall/remove the helper, or as a fallback write path.
- If using a Unix socket from a root LaunchDaemon, restrict the command protocol to explicit whitelisted operations (`probe`, `inhibit on|off`, `discharge on|off`, `reset`, `bclm get|set`) and set conservative socket ownership/permissions.
- Always provide a visible reset action that clears charge inhibit, clears force discharge, and restores legacy `BCLM` to `100` when present.
- Sign helper binaries explicitly with Developer ID before signing the app; `codesign --deep` can leave helper executables in Resources without their own `TeamIdentifier` even when the app bundle verifies.
- Poll at a modest interval. The app should decide "pause at >= limit, resume at <= threshold" and then issue one write only when state changes.
- Put the charge-control monitor at app/service scope, not inside a SwiftUI detail view. If the resume logic is view-scoped, charging can remain inhibited until the user opens that screen again.
- When using app-level charge control, tell users to leave Apple Charge Limit at `100%` and turn Optimized Battery Charging off so macOS does not compete with the custom controller.

## UI Integration

- Keep polling intervals modest. Fast dashboard polling can be 2-5 seconds; menu bar summaries should usually be 30-60 seconds unless the user explicitly wants live meters.
- Separate dense metrics into separate rows. RAM + disk + GPU details in one line will truncate in a menu bar popover.
- For long detail text, place the strongest value first: `38% uso · renderer 37% · tiler 10%`.
- Verify SF Symbols on the deployment target. Some symbols such as newer hardware names may not render on older macOS. Use stable fallbacks like `display`, `cpu.fill`, `memorychip.fill`, and `internaldrive.fill`.

## Compact Menu Bar Metrics

When exposing optional CPU/GPU/RAM/disk indicators as separate menu bar extras:

- Make each indicator individually toggleable; users control menu bar crowding.
- Keep labels short: `CPU 25%`, `GPU 38%`, `RAM 69%`, `SSD 87%`.
- Use one `Text` value for compact labels when possible. SwiftUI `MenuBarExtra` may render only the title or drop secondary text when a label is composed as an `HStack`.
- Use a faster polling interval only while live compact metrics are enabled, then keep popover-only status on a more conservative interval.
- Reuse the same snapshot bridge for the full popover and compact extras so clicking an indicator shows the same value the menu bar displays.
- Do not show fake zeroes while waiting for the first sample; prefer `--`, `No data`, or the last known value with stale styling.
