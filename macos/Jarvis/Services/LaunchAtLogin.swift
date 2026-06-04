import Foundation
import ServiceManagement

/// Сервис управления автозапуском приложения при входе в систему (Launch at Login) через SMAppService.
@MainActor
final class LaunchAtLogin: ObservableObject {
    
    @Published var isEnabled: Bool {
        didSet {
            updateLaunchStatus(enabled: isEnabled)
        }
    }

    init() {
        let status = SMAppService.mainApp.status
        self.isEnabled = (status == .enabled)
    }

    /// Регистрация или отмена регистрации автозапуска.
    private func updateLaunchStatus(enabled: Bool) {
        let service = SMAppService.mainApp
        let currentStatus = service.status

        if enabled && currentStatus != .enabled {
            do {
                try service.register()
                print("✅ LaunchAtLogin: приложение добавлено в автозапуск")
            } catch {
                print("⚠️ LaunchAtLogin: не удалось зарегистрировать автозапуск: \(error)")
                // Откатываем значение чекбокса обратно в случае ошибки
                DispatchQueue.main.async {
                    self.isEnabled = false
                }
            }
        } else if !enabled && currentStatus == .enabled {
            do {
                try service.unregister()
                print("✅ LaunchAtLogin: приложение удалено из автозапуска")
            } catch {
                print("⚠️ LaunchAtLogin: не удалось отменить автозапуск: \(error)")
                // Откатываем значение чекбокса обратно в случае ошибки
                DispatchQueue.main.async {
                    self.isEnabled = true
                }
            }
        }
    }
}
