import AppKit

@objc
public enum AppThemeType: Int {
  case auto = -1
  case light = 0
  case dark = 1
}

@_cdecl("lock_app_theme")
public func lockAppTheme(themeType: AppThemeType) {
  var theme: NSAppearance?
  switch themeType {
  case .auto:
    theme = nil
  case .dark:
    theme = NSAppearance(named: .darkAqua)!
  case .light:
    theme = NSAppearance(named: .aqua)!
  }

  DispatchQueue.main.async {
    NSApp.appearance = theme

    // Trigger a repaint of the window
    if let window = NSApplication.shared.mainWindow {
      window.invalidateShadow()
      window.displayIfNeeded()
    }
  }
}

@_cdecl("blur_window_background")
public func blurWindowBackground(window: NSWindow) {
  let windowContent = window.contentView!
  let blurryView = NSVisualEffectView()

  blurryView.material = .sidebar
  blurryView.state = .followsWindowActiveState
  blurryView.blendingMode = .behindWindow
  blurryView.wantsLayer = true

  window.contentView = blurryView
  blurryView.addSubview(windowContent)
}

@_cdecl("set_titlebar_style")
public func setTitlebarStyle(window: NSWindow, transparent: Bool) {
  window.titleVisibility = transparent ? .hidden : .visible
  window.titlebarAppearsTransparent = transparent
}