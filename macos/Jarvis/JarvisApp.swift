import SwiftUI

/// Точка входа нативного macOS-клиента Jarvis.
///
/// Приложение живёт в menubar (MenuBarExtra) — без Dock-иконки.
/// Чат = read-only зеркало голосового диалога. Текстового ввода нет.
@main
struct JarvisApp: App {
    @StateObject private var logWatcher = LogWatcher()

    var body: some Scene {
        // MenuBarExtra — нативный menubar macOS 14+.
        // Иконка в трее с выпадающей панелью.
        MenuBarExtra {
            MenuBarView(watcher: logWatcher)
        } label: {
            Label {
                Text("Jarvis")
            } icon: {
                Image(systemName: menuBarIcon)
            }
        }
        .menuBarExtraStyle(.window)
        .defaultSize(width: 320, height: 400)

        // Отдельное окно чата
        Window("Чат", id: "chat") {
            ChatWindow(watcher: logWatcher)
        }
        .defaultSize(width: 500, height: 600)
    }

    /// Иконка в menubar меняется в зависимости от статуса ассистента.
    private var menuBarIcon: String {
        switch logWatcher.status {
        case .listening:  return "ear.fill"
        case .recording:  return "mic.fill"
        case .processing: return "brain.head.profile"
        case .speaking:   return "speaker.wave.2.fill"
        case .idle:       return "waveform"
        }
    }

    init() {
        // Запускаем наблюдение за логом при инициализации приложения.
        // LogWatcher.start() вызовется после @StateObject init.
        DispatchQueue.main.async { [self] in
            logWatcher.start()
        }
    }
}
