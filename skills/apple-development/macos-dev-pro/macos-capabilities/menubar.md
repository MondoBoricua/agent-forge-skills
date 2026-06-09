# Menu Bar Apps

Building menu bar applications with MenuBarExtra (SwiftUI) and NSStatusItem (AppKit). Covers background-only apps, popover menus, and hybrid architectures.

## MenuBarExtra (SwiftUI, macOS 13+)

The modern, declarative way to build menu bar apps.

### Simple Menu

```swift
@main
struct MyMenuBarApp: App {
    var body: some Scene {
        MenuBarExtra("MyApp", systemImage: "star.fill") {
            Button("Open Dashboard") {
                // Action
            }
            Button("Check for Updates") {
                // Action
            }
            Divider()
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
        }
    }
}
```

### Window-Style Popover

For richer UIs, use `.menuBarExtraStyle(.window)`:

```swift
@main
struct StatusApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        MenuBarExtra("Status", systemImage: appState.statusIcon) {
            StatusPopoverView()
                .environment(appState)
                .frame(width: 320, height: 400)
        }
        .menuBarExtraStyle(.window)

        // Optional: main window
        Window("Settings", id: "settings") {
            SettingsView()
                .environment(appState)
        }
    }
}

struct StatusPopoverView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("System Status")
                    .font(.headline)
                Spacer()
                Button("Settings", systemImage: "gear") {
                    openWindow(id: "settings")
                    NSApp.activate(ignoringOtherApps: true)
                    dismiss()
                }
                .buttonStyle(.borderless)
            }

            Divider()

            // Content
            ForEach(appState.statusItems) { item in
                StatusRow(item: item)
            }

            Divider()

            // Footer
            HStack {
                Text("Last updated: \(appState.lastUpdate.formatted())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Refresh") {
                    Task { await appState.refresh() }
                }
                .controlSize(.small)
            }
        }
        .padding()
    }
}
```

### Dynamic Icon

Update the menu bar icon based on state:

```swift
@Observable class AppState {
    var isConnected = false
    var unreadCount = 0

    var statusIcon: String {
        if !isConnected { return "wifi.slash" }
        if unreadCount > 0 { return "bell.badge.fill" }
        return "bell.fill"
    }
}

// The icon updates automatically when properties change
MenuBarExtra("Status", systemImage: appState.statusIcon) { ... }
```

### Compact Metric Labels

`MenuBarExtra` labels are constrained by the real menu bar height. Pure SwiftUI
multiline labels can be measured as valid text but still render clipped, for
example a compact `"SSD\n87%"` label where the title is cut off. For dense
status utilities, render the compact label into an `NSImage` and use
`Image(nsImage:)` as the visible label.

```swift
MenuBarExtra {
    MetricsPopover()
} label: {
    Image(nsImage: CompactMetricMenuLabel.image(
        title: "SSD",
        value: "87%",
        color: .systemGreen
    ))
    .accessibilityLabel("SSD 87 percent")
}

enum CompactMetricMenuLabel {
    static func image(title: String, value: String, color: NSColor) -> NSImage {
        let size = NSSize(width: 34, height: 22)
        let image = NSImage(size: size)

        image.lockFocus()
        defer { image.unlockFocus() }

        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byClipping

        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 7, weight: .medium),
            .foregroundColor: NSColor.secondaryLabelColor,
            .paragraphStyle: paragraph
        ]
        let valueAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold),
            .foregroundColor: color,
            .paragraphStyle: paragraph
        ]

        title.draw(in: NSRect(x: 0, y: 13, width: size.width, height: 8), withAttributes: titleAttributes)
        value.draw(in: NSRect(x: 0, y: 0, width: size.width, height: 14), withAttributes: valueAttributes)

        image.isTemplate = false
        return image
    }
}
```

Use dynamic `NSColor` values or resolve threshold colors during rendering so
light and dark menu bar appearances stay legible. Prefer monospaced digits for
values that update frequently; otherwise the status item jitters as numbers
change.

### Dismissing the Menu After Actions

The menu should dismiss after the user clicks an action item:

```swift
struct MenuView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Open Main Window") {
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
            dismiss()  // Dismiss after action
        }
    }
}
```

## NSStatusItem (AppKit)

For more control over the menu bar item, use AppKit's NSStatusItem directly.
Use this when the status item needs exact pixel/point layout, multiple compact
metrics, custom charts, preserved item position, or mixed left/right click
behavior. `MenuBarExtra` is excellent for ordinary utilities, but it does not
give enough control for dense live-monitoring widgets.

### Basic Setup

```swift
class StatusBarController {
    private var statusItem: NSStatusItem?

    func setup() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "star.fill", accessibilityDescription: "MyApp")
            button.action = #selector(handleClick(_:))
            button.target = self
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
    }

    @objc func handleClick(_ sender: NSStatusBarButton) {
        let event = NSApp.currentEvent!
        if event.type == .rightMouseUp {
            showContextMenu()
        } else {
            togglePopover()
        }
    }

    func showContextMenu() {
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Settings...", action: #selector(openSettings), keyEquivalent: ","))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q"))
        statusItem?.menu = menu
        statusItem?.button?.performClick(nil)
        statusItem?.menu = nil  // Reset so left-click works again
    }
}
```

### Custom Status Item Views

For professional monitoring utilities, model the menu bar surface as a small
AppKit view tree hosted inside `NSStatusBarButton`, then set the status item
length from the measured widget widths. This avoids SwiftUI relayout surprises
and supports charts, labels, separators, and multiple metrics in one item.

```swift
final class MetricsStatusItem {
    private var item: NSStatusItem?
    private let contentView = NSView(frame: NSRect(x: 0, y: 0, width: 0, height: 22))
    private var widgets: [NSView] = []

    func install() {
        item = NSStatusBar.system.statusItem(withLength: 0)
        item?.autosaveName = "MetricsStatusItem"
        item?.button?.image = NSImage()
        item?.button?.addSubview(contentView)
        item?.button?.target = self
        item?.button?.action = #selector(togglePopover)
        item?.button?.sendAction(on: [.leftMouseDown, .rightMouseDown])
        recalculateWidth()
    }

    func setWidgets(_ newWidgets: [NSView]) {
        contentView.subviews.forEach { $0.removeFromSuperview() }
        widgets = newWidgets
        widgets.forEach(contentView.addSubview)
        recalculateWidth()
    }

    private func recalculateWidth() {
        var x: CGFloat = 2
        for widget in widgets {
            widget.setFrameOrigin(NSPoint(x: x, y: widget.frame.origin.y))
            x += widget.frame.width + 2
        }
        contentView.setFrameSize(NSSize(width: x, height: 22))
        item?.length = x
    }

    @objc private func togglePopover() {
        // Show an NSPopover/NSPanel relative to item?.button.
    }
}
```

Keep widget views responsible for their own drawing and intrinsic width. When a
widget value changes, update only that widget, then call a width callback if the
string or chart width changed. Use `NSStatusItem.autosaveName` when preserving
user-controlled menu bar ordering matters.

### Popover with SwiftUI Content

```swift
class StatusBarController {
    private var statusItem: NSStatusItem?
    private var popover: NSPopover?

    func setup() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem?.button?.image = NSImage(systemSymbolName: "star.fill", accessibilityDescription: "MyApp")
        statusItem?.button?.action = #selector(togglePopover)
        statusItem?.button?.target = self

        popover = NSPopover()
        popover?.contentSize = NSSize(width: 320, height: 400)
        popover?.behavior = .transient  // Auto-dismiss when clicking outside
        popover?.contentViewController = NSHostingController(
            rootView: PopoverContentView()
        )
    }

    @objc func togglePopover() {
        guard let popover, let button = statusItem?.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}
```

### Popover Data Caching

Do not redraw expensive popover detail views on every sensor tick while the
popover is hidden. Store the latest snapshot, render immediately the first time,
render live only while visible, and replay the cached value when the popover
opens. This keeps the menu bar responsive without showing stale data.

```swift
final class PopupCache<Value> {
    private var latest: Value?
    private var initialized = false

    func apply(_ value: Value, visible: Bool, render: (Value) -> Void) {
        latest = value
        if visible || !initialized {
            render(value)
            initialized = true
        }
    }

    func replay(render: (Value) -> Void) {
        if let latest {
            render(latest)
        }
    }
}
```

## Background-Only App Architecture

A menu bar app with no Dock icon and no main window:

### Info.plist Configuration

```xml
<!-- Hide from Dock -->
<key>LSUIElement</key>
<true/>
```

Use `LSUIElement=true` for accessory/menu-bar utilities that should keep running after their main window closes without remaining in the Dock. Pair this with an explicit Quit item in the status menu.

### Single Main Window From A Menu Bar Item

If a status item has an "Open App" or "Open Main Window" action, use a singleton SwiftUI `Window`, not `WindowGroup`. `WindowGroup` can create duplicate windows every time `openWindow(id:)` is called.

```swift
@main
struct UtilityApp: App {
    var body: some Scene {
        Window("Utility", id: "main") {
            ContentView()
                .frame(minWidth: 900, minHeight: 600)
        }

        MenuBarExtra("Utility", systemImage: "waveform") {
            MenuContent()
        }
        .menuBarExtraStyle(.window)
    }
}

struct MenuContent: View {
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button("Open App") {
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
            dismiss()
        }
        Divider()
        Button("Quit") { NSApp.terminate(nil) }
    }
}
```

For this pattern, `applicationShouldTerminateAfterLastWindowClosed` should usually return `false`. Closing the window hides it; quitting remains explicit from the menu.

### SwiftUI Approach

```swift
@main
struct BackgroundApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        MenuBarExtra("MyUtil", systemImage: "gearshape") {
            MenuView()
        }
        .menuBarExtraStyle(.window)

        // Settings window (opens on demand)
        Settings {
            SettingsView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // No main window to show
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        // Clicking Dock icon (if visible) doesn't open a window
        false
    }
}
```

## Status Item Icon Guidance

Status bar labels are rendered in a constrained system area with selection/highlight states. Prefer:

- SF Symbols through `MenuBarExtra("Title", systemImage: "symbol")` or `Image(systemName:)`.
- Template-style monochrome symbols for status items.
- Short text labels with `.fixedSize()` for compact metrics (`CPU 25%`, `RAM 70%`).

Avoid drawing custom bars/blobs with arbitrary SwiftUI shapes unless you have tested highlighted, inactive, dark, light, and wallpaper-translucent menu bar states. Custom filled shapes can turn into dark blobs or lose contrast when selected.

If a custom image is required, provide proper 1x/2x/3x representations and set a stable point size. Use `isTemplate=true` for monochrome system-style icons; leave it false only when intentional brand colors must survive.

### Activation Policy Switching

Toggle between Dock and menu-bar-only mode:

```swift
@Observable class AppMode {
    var showInDock: Bool = false {
        didSet {
            NSApp.setActivationPolicy(showInDock ? .regular : .accessory)
        }
    }
}
```

## Common Patterns

### Status Item with Badge Count

```swift
func updateBadge(count: Int) {
    guard let button = statusItem?.button else { return }
    if count > 0 {
        button.title = " \(count)"
        button.imagePosition = .imageLeading
    } else {
        button.title = ""
        button.imagePosition = .imageOnly
    }
}
```

### Opening Windows from Menu Bar

```swift
// Problem: openWindow() opens the window but doesn't bring it to front
// Solution: activate the app after opening

Button("Show Dashboard") {
    openWindow(id: "dashboard")
    NSApp.activate(ignoringOtherApps: true)
    dismiss()  // Close the menu
}
```

### Close Button Keeps Utility Alive

For utilities where the menu bar extra is the primary persistent surface, closing the main window should hide the window, not terminate the process. Use a singleton `Window(id:)` for the main control window and an app delegate that keeps the app alive:

```swift
@main
struct UtilityApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Window("Utility", id: "main") {
            ContentView()
        }

        MenuBarExtra("Utility", systemImage: "display") {
            UtilityMenu()
        }
        .menuBarExtraStyle(.window)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
```

From the menu bar, reopen the main window with `openWindow(id:)` and activate the app:

```swift
@Environment(\.openWindow) private var openWindow

Button("Open Utility") {
    openWindow(id: "main")
    NSApp.activate(ignoringOtherApps: true)
}
```

Offer an explicit Quit item so users retain control.

### Monitoring Popovers

Menu bar monitoring popovers should be dense, predictable, and cheap to refresh:

- Poll expensive system state outside the view body and publish a snapshot object.
- Keep rows stable: icon, title, primary value, short secondary detail.
- Put one metric family per row. CPU, GPU, RAM, and disk become unreadable when combined.
- Make manual refresh available even when auto-refresh exists.
- Use compatible SF Symbol fallbacks. If a hardware-specific symbol does not render on the target macOS, use stable symbols such as `display`, `cpu.fill`, `memorychip.fill`, or `internaldrive.fill`.

### Compact Metric Extras

For optional always-visible menu bar metrics, prefer separate short `MenuBarExtra` items over one crowded mega-label:

```swift
MenuBarExtra {
    MetricDetailView(metric: metric)
} label: {
    Text("CPU \(cpuPercent)%")
        .fixedSize()
}
```

Important implementation notes:

- A single `Text` label is more reliable than `HStack { Text("CPU"); Text("25%") }`; macOS can collapse composed labels and hide the dynamic value.
- Keep title and value together in the label string so the percentage remains visible before click.
- If you use `isInserted:` with `@AppStorage`, make each metric independently toggleable.
- When multiple extras share one polling bridge, choose the fastest requested interval and avoid starting duplicate timers.
- On click, show a tiny popover with detail and refresh, not a full dashboard.

### Global Keyboard Shortcut

Register a hotkey to toggle the menu bar popover:

```swift
import Carbon

class HotkeyManager {
    private var hotkeyRef: EventHotKeyRef?

    func register(keyCode: UInt32, modifiers: UInt32, handler: @escaping () -> Void) {
        var hotKeyID = EventHotKeyID()
        hotKeyID.signature = OSType(0x4D794170) // "MyAp"
        hotKeyID.id = 1

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard),
                                       eventKind: UInt32(kEventHotKeyPressed))

        InstallEventHandler(GetApplicationEventTarget(), { _, event, _ -> OSStatus in
            // Handler called on hotkey press
            return noErr
        }, 1, &eventType, nil, nil)

        RegisterEventHotKey(keyCode, modifiers, hotKeyID,
                           GetApplicationEventTarget(), 0, &hotkeyRef)
    }
}
```

## Best Practices

1. **Use MenuBarExtra for new apps** - Simpler, declarative, less code
2. **Use `.menuBarExtraStyle(.window)` for rich UIs** - Default menu style is limited
3. **Always provide a Quit option** - Users expect it in menu bar apps
4. **Dismiss the menu after actions** - Standard macOS behavior
5. **Activate the app when opening windows** - Use `NSApp.activate(ignoringOtherApps: true)`
6. **Set LSUIElement for background-only apps** - Hides from Dock
7. **Keep menus lightweight** - Don't do heavy computation in the menu view
8. **Support keyboard shortcuts** - Add `.keyboardShortcut()` to menu items
9. **Use SF Symbols for the status item** - Automatic template rendering for dark/light menu bar
10. **Verify symbol availability** - Newer SF Symbols can render as blanks on older macOS; use stable fallbacks
11. **Use explicit quit behavior** - If closing windows keeps the app alive, the menu bar extra must include Quit
12. **Keep compact labels atomic** - For numeric status extras, put title and value in one `Text` so the menu bar does not drop the value
13. **Render compact multiline metric labels as images** - SwiftUI text labels can clip inside `MenuBarExtra`
