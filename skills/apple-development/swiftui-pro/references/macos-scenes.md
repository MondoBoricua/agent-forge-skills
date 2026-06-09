# macOS Scenes Reference

> SwiftUI scene types for macOS apps — `Settings`, `MenuBarExtra`, `WindowGroup`, `Window`, `UtilityWindow`, and `DocumentGroup`. Covers macOS-only scenes and cross-platform scenes with macOS-specific behavior.

## Table of Contents

- [Quick Lookup Table](#quick-lookup-table)
- [Settings (macOS-only)](#settings-macos-only)
- [MenuBarExtra (macOS-only)](#menubarextra-macos-only)
- [WindowGroup (macOS behavior)](#windowgroup-macos-behavior)
- [Window](#window)
- [UtilityWindow (macOS-only)](#utilitywindow-macos-only)
- [DocumentGroup](#documentgroup)
- [Platform Conditionals](#platform-conditionals)
- [Best Practices](#best-practices)

---

## Quick Lookup Table

| API | Availability | macOS-Only? | macOS-Specific Behavior |
|-----|-------------|:-----------:|------------------------|
| `WindowGroup` | macOS 11.0+ | No | Multiple window instances, tabbed interface, automatic Window menu commands |
| `Window` | macOS 13.0+ | No | App quits when sole window closes; adds itself to Windows menu |
| `UtilityWindow` | macOS 15.0+ | Yes | Floating tool palette; receives `FocusedValues` from active main window |
| `Settings` | macOS 11.0+ | Yes | Presents preferences window (Cmd+,) |
| `MenuBarExtra` | macOS 13.0+ | Yes | Persistent icon/menu in the system menu bar |
| `DocumentGroup` | macOS 11.0+ | No | Document-based menu bar commands (File > New/Open/Save); multiple document windows |

---

## Settings (macOS-only)

Presents the app's preferences window, accessible via **Cmd+,** or the app menu. SwiftUI automatically enables the Settings menu item and manages the window lifecycle.

```swift
Settings {
    TabView {
        Tab("General", systemImage: "gear") { GeneralSettingsView() }
        Tab("Advanced", systemImage: "star") { AdvancedSettingsView() }
    }
    .scenePadding()
    .frame(maxWidth: 350, minHeight: 100)
}
```

Use `TabView` with `Tab` items for multi-pane preferences. Each tab's content is typically a `Form` with `@AppStorage`-backed controls.

### SettingsLink (macOS 14.0+)

A button that opens the Settings scene. Use for in-app navigation to preferences.

```swift
struct SidebarFooter: View {
    var body: some View {
        SettingsLink {
            Label("Preferences", systemImage: "gear")
        }
    }
}
```

### openSettings environment action (macOS 14.0+)

Programmatically open (or bring to front) the Settings window.

```swift
struct OpenSettingsButton: View {
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        Button("Open Settings") {
            openSettings()
        }
    }
}
```

---

## MenuBarExtra (macOS-only)

Renders a persistent control in the system menu bar. Two styles available:
- **`.menu`** (default) — standard dropdown menu
- **`.window`** — popover panel with custom SwiftUI views

### Menu-style (dropdown)

```swift
MenuBarExtra("My Utility", systemImage: "hammer") {
    Button("Action One") { /* ... */ }
    Button("Action Two") { /* ... */ }
    Divider()
    Button("Quit") { NSApplication.shared.terminate(nil) }
}
```

### Window-style (popover panel)

```swift
MenuBarExtra("Status", systemImage: "chart.bar") {
    DashboardView()
        .frame(width: 240)
}
.menuBarExtraStyle(.window)
```

**Variations:**
- **Toggleable** — pass `isInserted:` with an `@AppStorage` binding to let users show/hide the extra: `MenuBarExtra("Status", systemImage: "chart.bar", isInserted: $showMenuBarExtra)`
- **Menu-bar-only app** — use `MenuBarExtra` as the sole scene + set `LSUIElement = true` in Info.plist to hide the Dock icon. The app auto-terminates if the user removes the extra from the menu bar.

### Persistent utility with main window + menu bar extra

For Mac utilities, a common pattern is: the main window can close/hide, but the app keeps running from the menu bar. Use `WindowGroup(id:)`, reopen with `openWindow(id:)`, and keep an explicit Quit command.

```swift
@main
struct UtilityApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup("Utility", id: "main") {
            ContentView()
        }

        MenuBarExtra("Utility", systemImage: "display") {
            UtilityMenu()
                .frame(width: 280)
        }
        .menuBarExtraStyle(.window)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}

struct UtilityMenu: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Open Utility") {
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
        }

        Button("Hide Window") {
            NSApp.hide(nil)
        }

        Divider()

        Button("Quit") {
            NSApp.terminate(nil)
        }
    }
}
```

### Menu bar monitoring layout

When a `.window` menu extra shows live status:

- Keep data collection outside the `View` body; publish a compact observable snapshot.
- Use one row per metric family: CPU, GPU, RAM, disk, battery, network, etc.
- Put the most important value first because secondary text often truncates.
- Use manual refresh plus a conservative timer for menu summaries.
- Verify SF Symbol availability on the deployment target. Newer symbols can render blank; prefer stable fallbacks such as `display`, `cpu.fill`, `memorychip.fill`, and `internaldrive.fill`.

### Compact menu bar labels

Do not rely on pure SwiftUI multiline labels for the visible `MenuBarExtra`
status item. Labels such as `Text("SSD\n87%")` can have the correct text but
still be clipped by macOS because the status item is laid out inside the real
menu bar height, not a normal SwiftUI stack.

For compact two-line metrics, render the label into a fixed-height `NSImage`
and use `Image(nsImage:)` as the `MenuBarExtra` label. Keep the image around
22pt high, draw the title and value manually with AppKit/Core Graphics, use
monospaced digits for changing numbers, and apply threshold colors while
drawing. This gives macOS one complete image instead of asking it to relayout
two SwiftUI text lines inside the menu bar.

```swift
MenuBarExtra {
    MetricsMenu()
} label: {
    Image(nsImage: MetricMenuBarImage.render(title: "SSD", value: "87%", color: .systemGreen))
        .accessibilityLabel("SSD 87 percent")
}
```

If the visible menu bar surface contains multiple live widgets, tiny charts, or
user-reorderable metric groups, prefer an AppKit `NSStatusItem` with custom
`NSView` subviews instead of forcing everything through `MenuBarExtra`. Let
SwiftUI own the popover/window content, while AppKit owns the status item pixels,
hit testing, width calculation, and preserved menu bar position.

Secondary guidelines for short single-line status strings:

- If you keep a SwiftUI `Text` label, use one `Text` containing both title and value rather than splitting the value into multiple child views, which macOS can collapse to show only the title.
- Use `.fixedSize()` for short status strings that should not wrap or compress.
- Keep labels short enough for menu bar crowding.
- Put richer detail in the menu/popover content, not the always-visible label.
- If several extras share a timer-backed model, ensure `startPolling` is idempotent and preserves the fastest active interval.

---

## WindowGroup (macOS behavior)

On macOS, `WindowGroup` supports:
- **Multiple window instances** — users can open many windows from File > New Window
- **Tabbed interface** — users can merge windows into tabs
- **Automatic Window menu** — commands for window management appear automatically

```swift
@main
struct Mail: App {
    var body: some Scene {
        // Basic multi-window support
        WindowGroup {
            MailViewer()
        }

        // Data-presenting window opened programmatically
        WindowGroup("Message", for: Message.ID.self) { $messageID in
            MessageDetail(messageID: messageID)
        }
    }
}

// Open a specific window programmatically
struct NewMessageButton: View {
    var message: Message
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Open Message") {
            openWindow(value: message.id)
        }
    }
}
```

> **Key difference from `Window`:** `WindowGroup` keeps the app running even after all windows are closed. `Window` (as sole scene) quits the app when closed.

---

## Window

A single, unique window scene. The system ensures only one instance exists.

```swift
@main
struct Mail: App {
    var body: some Scene {
        WindowGroup {
            MailViewer()
        }

        // Supplementary singleton window
        Window("Connection Doctor", id: "connection-doctor") {
            ConnectionDoctor()
        }
    }
}

// Open programmatically — brings to front if already open
struct OpenDoctorButton: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Connection Doctor") {
            openWindow(id: "connection-doctor")
        }
    }
}
```

### Window as sole scene

If `Window` is the only scene, the app quits when the window closes:

```swift
@main
struct VideoCall: App {
    var body: some Scene {
        Window("VideoCall", id: "main") {
            CameraView()
        }
    }
}
```

> **Recommendation:** In most cases, prefer `WindowGroup` for the primary scene. Use `Window` for supplementary singleton windows.

---

## UtilityWindow (macOS-only)

A specialized floating window for tool palettes and inspector panels. Available since macOS 15.0.

**Key behaviors:**
- Receives `FocusedValues` from the focused main scene (like menu bar commands)
- Floats above main windows (default level: `.floating`)
- Hides when the app is no longer active
- Only becomes focused when explicitly needed (e.g., clicking the title bar)
- Dismissible with the Escape key
- Not minimizable by default
- Automatically adds a show/hide item to the View menu

```swift
@main
struct PhotoBrowser: App {
    var body: some Scene {
        WindowGroup {
            PhotoGallery()
        }

        UtilityWindow("Photo Info", id: "photo-info") {
            PhotoInfoViewer()
        }
    }
}

struct PhotoInfoViewer: View {
    // Automatically updates based on whichever main window is focused
    @FocusedValue(PhotoSelection.self) private var selectedPhotos

    var body: some View {
        if let photos = selectedPhotos {
            Text("\(photos.count) photos selected")
        } else {
            Text("No selection")
                .foregroundStyle(.secondary)
        }
    }
}
```

> **Tip:** Remove the automatic View menu item with `.commandsRemoved()` and place a `WindowVisibilityToggle` elsewhere in your commands.

---

## DocumentGroup

Document-based apps with automatic file management. On macOS, provides:
- **Document-based menu bar commands** (File > New, Open, Save, Revert)
- **Multiple document windows** simultaneously
- On iOS, shows a document browser instead

```swift
DocumentGroup(newDocument: TextFile()) { config in
    ContentView(document: config.$document)
}
```

The document type must conform to `FileDocument` (value type) or `ReferenceFileDocument` (reference type). Key requirements:

```swift
struct TextFile: FileDocument {
    static var readableContentTypes: [UTType] { [.plainText] }
    var text: String = ""
    init() {}
    init(configuration: ReadConfiguration) throws {
        text = String(data: configuration.file.regularFileContents ?? Data(), encoding: .utf8) ?? ""
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}
```

For multiple document types, add additional `DocumentGroup` scenes — use `DocumentGroup(viewing:)` for read-only formats.

---

## Platform Conditionals

Always wrap macOS-only scenes in `#if os(macOS)`:

```swift
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }

        #if os(macOS)
        Settings {
            SettingsView()
        }

        MenuBarExtra("Status", systemImage: "bolt") {
            StatusMenu()
        }
        #endif
    }
}
```

---

## Best Practices

- **Use `Settings`** for preferences — prefer this over a custom preferences window
- **Use `MenuBarExtra`** for menu bar items — prefer this over managing AppKit's `NSStatusItem` directly
- **Use image-rendered labels** for compact multiline status metrics — SwiftUI text labels can clip in the menu bar
- **Use `WindowGroup`** as the primary scene — reserve `Window` for supplementary singletons
- **Use `UtilityWindow`** for inspectors/palettes — it handles floating, focus, and visibility automatically
- **Use `DocumentGroup`** for document-based apps — it provides the full File menu and document lifecycle
- **Gate macOS-only scenes** with `#if os(macOS)` for multiplatform projects
- **Use `openWindow(id:)`** to open windows programmatically — it brings existing windows to front
