import AppKit
import ApplicationServices
import Foundation

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}

func failure(_ message: String, _ code: Int = 1) -> NSError {
    NSError(domain: message, code: code)
}

func waitFor(_ message: String, _ predicate: () throws -> Bool) throws {
    let deadline = Date().addingTimeInterval(5)
    repeat {
        if try predicate() { return }
        RunLoop.current.run(until: Date().addingTimeInterval(0.02))
    } while Date() < deadline
    throw failure(message)
}

struct NativeCursorWindow {
    let pid: pid_t
    let title: String
    let app: AXUIElement
    let window: AXUIElement

    init(pid: pid_t, title: String, activateFirst: Bool) throws {
        guard title.hasPrefix("SAFEWORD isolated "),
              NSRunningApplication(processIdentifier: pid)?.localizedName == "Cursor" else {
            throw failure("Refusing a non-test Cursor process")
        }
        self.pid = pid
        self.title = title
        app = AXUIElementCreateApplication(pid)
        guard AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue) == .success else {
            throw failure("Native Accessibility unavailable")
        }
        if activateFirst {
            guard NSRunningApplication(processIdentifier: pid)?.activate(options: []) == true else {
                throw failure("Could not activate the isolated Cursor process")
            }
        }
        let appElement = app
        var selected: AXUIElement?
        try waitFor("Expected one isolated native window", {
            let windows = attribute(appElement, kAXWindowsAttribute) as? [AXUIElement] ?? []
            let matching = windows.filter {
                attribute($0, kAXRoleAttribute) as? String == kAXWindowRole &&
                attribute($0, kAXTitleAttribute) as? String == title
            }
            guard matching.count <= 1 else { throw failure("Ambiguous isolated native window") }
            selected = matching.first
            return selected != nil
        })
        guard let selected = selected else { throw failure("Expected one isolated native window", 2) }
        window = selected
    }

    func elements() throws -> [AXUIElement] {
        var pending = [window]
        var result: [AXUIElement] = []
        while let element = pending.popLast() {
            guard result.count < 20_000 else { throw failure("Native Accessibility tree exceeded bound", 3) }
            result.append(element)
            let children = attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
            pending.append(contentsOf: children.reversed())
        }
        return result
    }

    func foreground() -> Bool {
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid,
              let main = attribute(app, kAXMainWindowAttribute),
              CFGetTypeID(main) == AXUIElementGetTypeID() else { return false }
        return attribute(main as! AXUIElement, kAXTitleAttribute) as? String == title
    }

    func activate() throws {
        guard NSRunningApplication(processIdentifier: pid)?.activate(options: []) == true else {
            throw failure("Could not activate the isolated Cursor process")
        }
        guard AXUIElementPerformAction(window, kAXRaiseAction as CFString) == .success else {
            throw failure("Could not raise the isolated Cursor window")
        }
        try waitFor("Isolated Cursor window did not become foreground") { foreground() }
    }

    func input() throws -> AXUIElement {
        let inputs = try elements().filter { attribute($0, kAXRoleAttribute) as? String == kAXTextAreaRole }
        guard inputs.count == 1 else { throw failure("Expected one native Agent input", 4) }
        return inputs[0]
    }

    func focusedInput() throws -> AXUIElement {
        guard let focused = attribute(app, kAXFocusedUIElementAttribute),
              CFGetTypeID(focused) == AXUIElementGetTypeID() else {
            throw failure("Native Agent input is not focused", 5)
        }
        let input = focused as! AXUIElement
        guard attribute(input, kAXRoleAttribute) as? String == kAXTextAreaRole else {
            throw failure("Native Agent input is not focused", 5)
        }
        guard let inputWindow = attribute(input, kAXWindowAttribute),
              CFEqual(inputWindow, window) else { throw failure("Focused input belongs to another window") }
        return input
    }

    func focusInput() throws {
        try activate()
        let field = try input()
        guard AXUIElementSetAttributeValue(field, kAXFocusedAttribute as CFString, kCFBooleanTrue) == .success else {
            throw failure("Native Agent input could not receive focus", 5)
        }
        try waitFor("Native Agent input did not settle") {
            guard foreground() else { throw failure("Isolated Cursor lost foreground") }
            return attribute(app, kAXFocusedUIElementAttribute).map { CFEqual($0, field) } == true
        }
    }

    func key(_ code: CGKeyCode, flags: CGEventFlags = [], unicode: [UniChar]? = nil) throws {
        guard foreground() else { throw failure("Isolated Cursor lost foreground before keyboard action") }
        _ = try focusedInput()
        for down in [true, false] {
            guard let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down) else {
                throw failure("Could not create native keyboard event")
            }
            event.flags = flags
            if let unicode = unicode {
                unicode.withUnsafeBufferPointer { buffer in
                    event.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: buffer.baseAddress!)
                }
            }
            event.postToPid(pid)
        }
    }

    func text() throws -> String {
        try elements().compactMap { element in
            let role = attribute(element, kAXRoleAttribute) as? String
            if role == kAXStaticTextRole { return attribute(element, kAXValueAttribute) as? String }
            if role == kAXButtonRole {
                let label = attribute(element, kAXTitleAttribute) as? String ?? ""
                let description = attribute(element, kAXDescriptionAttribute) as? String ?? ""
                return "BUTTON: \(label) \(description)"
            }
            if role == kAXMenuItemRole { return "MENU: " + (attribute(element, kAXTitleAttribute) as? String ?? "") }
            return nil
        }.joined(separator: "\n")
    }

    func pressNewAgent() throws {
        try activate()
        var button: AXUIElement?
        try waitFor("Expected one native New Agent control") {
            let buttons = try elements().filter { element in
                guard attribute(element, kAXRoleAttribute) as? String == kAXButtonRole else { return false }
                let description = attribute(element, kAXDescriptionAttribute) as? String ?? ""
                return description == "New Agent (⌘N) [⌥] Replace Agent" || description == "New Agent (⇧⌘L)"
            }
            button = buttons.count == 1 ? buttons[0] : nil
            return button != nil
        }
        guard let button = button else { throw failure("Expected one native New Agent control") }
        guard foreground() else { throw failure("Isolated Cursor lost foreground before New Agent") }
        guard AXUIElementPerformAction(button, kAXPressAction as CFString) == .success else {
            throw failure("Native New Agent action failed")
        }
    }

    func fill(_ prompt: String) throws {
        guard !prompt.isEmpty, !prompt.contains("\n"), !prompt.contains("\r") else {
            throw failure("Expected a single-line synthetic prompt")
        }
        try focusInput()
        try key(0, flags: .maskCommand)
        // Unicode key events preserve the literal prompt without a clipboard or
        // private editor state. Small chunks keep event payloads bounded.
        let units = Array(prompt.utf16)
        // Cursor opens its workflow picker on the physical slash key event.
        // A multi-character Unicode event inserts text but is not that gesture.
        let start = units.first == 47 ? 1 : 0
        if start == 1 { try key(44, unicode: [47]) }
        for offset in stride(from: start, to: units.count, by: 20) {
            try key(0, unicode: Array(units[offset..<min(offset + 20, units.count)]))
        }
        try waitFor("Native Agent input did not retain the synthetic prompt") {
            let observed = attribute(try focusedInput(), kAXValueAttribute) as? String
            return observed == prompt || observed == prompt + "\n"
        }
    }

    func submit(_ prompt: String) throws {
        guard !prompt.isEmpty else { throw failure("Expected a synthetic prompt") }
        // Restore the exact owned field before the one-shot Enter. Submission
        // itself is never retried, and every key still checks PID/window focus.
        try focusInput()
        let observed = attribute(try focusedInput(), kAXValueAttribute) as? String
        guard observed == prompt || observed == prompt + "\n" else {
            throw failure("Prepared prompt differs from the synthetic action")
        }
        try key(36, unicode: [13])
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }

    func selectWorkflow(_ label: String) throws {
        var selectedIndex: Int?
        try waitFor("Expected one candidate-origin native workflow") {
            let rows = try elements().filter { element in
                attribute(element, kAXRoleAttribute) as? String == kAXMenuItemRole &&
                (attribute(element, kAXTitleAttribute) as? String ?? "").hasPrefix("/")
            }
            let indices = rows.indices.filter { attribute(rows[$0], kAXTitleAttribute) as? String == label }
            guard indices.count <= 1 else { throw failure("Ambiguous candidate-origin native workflow") }
            selectedIndex = indices.first
            return selectedIndex != nil
        }
        guard let selectedIndex = selectedIndex, foreground() else {
            throw failure("Isolated Cursor lost workflow selection readiness")
        }
        _ = try focusedInput()
        for _ in 0..<selectedIndex { try key(125) }
        try key(36, unicode: [13])
        RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
}

func run() throws {
    let args = CommandLine.arguments
    guard (4...5).contains(args.count), let pid = Int32(args[1]) else {
        throw failure("Expected PID, isolated title, action and optional payload file")
    }
    let target = try NativeCursorWindow(pid: pid, title: args[2], activateFirst: args[3] == "activate")
    let payload = args.count == 5 ? try String(contentsOfFile: args[4], encoding: .utf8) : nil
    switch args[3] {
    case "activate": try target.activate()
    case "snapshot": print(try target.text())
    case "input": print(attribute(try target.input(), kAXValueAttribute) as? String ?? "")
    case "focused-input": print(attribute(try target.focusedInput(), kAXValueAttribute) as? String ?? "")
    case "new-agent": try target.pressNewAgent()
    case "fill":
        guard let prompt = payload else { throw failure("Expected a synthetic prompt file") }
        try target.fill(prompt)
    case "submit":
        guard let prompt = payload else { throw failure("Expected a synthetic prompt file") }
        try target.submit(prompt)
    case "select-workflow":
        guard let label = payload else { throw failure("Expected a workflow label file") }
        try target.selectWorkflow(label)
    case "close":
        guard let button = attribute(target.window, kAXCloseButtonAttribute), CFGetTypeID(button) == AXUIElementGetTypeID() else {
            throw failure("Expected an isolated window close control")
        }
        guard AXUIElementPerformAction(button as! AXUIElement, kAXPressAction as CFString) == .success else {
            throw failure("Native window closure failed")
        }
    default: throw failure("Unknown native test action")
    }
}

do { try run() }
catch {
    FileHandle.standardError.write(Data("CURSOR_SETUP_UNAVAILABLE: \(error)\n".utf8))
    exit(1)
}
