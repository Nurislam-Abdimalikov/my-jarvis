import Foundation

/// Наблюдатель за `jarvis.log` — перечитывает файл при изменениях.
///
/// Использует `DispatchSource.makeFileSystemObjectSource` (kqueue на macOS)
/// для мгновенного уведомления об изменениях. Не полирует файл по таймеру.
@MainActor
final class LogWatcher: ObservableObject {

    @Published private(set) var entries: [LogEntry] = []
    @Published private(set) var status: AssistantStatus = .idle

    private let logPath: String
    private var source: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32 = -1

    /// Максимум строк для хранения в памяти (последние N).
    private let maxLines = 800

    init() {
        // ~/jarvis/logs/jarvis.log
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.logPath = "\(home)/jarvis/logs/jarvis.log"
    }

    /// Начать наблюдение. Вызывается при появлении view.
    func start() {
        // Первичное чтение
        readLog()

        // Открыть файл для наблюдения (read-only)
        fileDescriptor = open(logPath, O_RDONLY | O_EVTONLY)
        guard fileDescriptor >= 0 else {
            print("⚠️ LogWatcher: не удалось открыть \(logPath)")
            return
        }

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fileDescriptor,
            eventMask: [.write, .extend, .rename],
            queue: .global(qos: .utility)
        )

        source.setEventHandler { [weak self] in
            // Файл изменился — перечитываем на main thread
            Task { @MainActor [weak self] in
                self?.readLog()
            }
        }

        source.setCancelHandler { [weak self] in
            if let fd = self?.fileDescriptor, fd >= 0 {
                close(fd)
            }
        }

        source.resume()
        self.source = source
    }

    /// Остановить наблюдение.
    func stop() {
        source?.cancel()
        source = nil
    }

    /// Прочитать файл целиком и обновить entries + status.
    private func readLog() {
        guard FileManager.default.fileExists(atPath: logPath) else {
            entries = []
            status = .idle
            return
        }

        guard let content = try? String(contentsOfFile: logPath, encoding: .utf8) else {
            return
        }

        let lines = content.components(separatedBy: "\n")
            .filter { !$0.isEmpty }
            .suffix(maxLines)

        entries = lines.map { LogEntry.parse($0) }

        // Статус определяем по последней строке
        if let lastEntry = entries.last {
            status = AssistantStatus.from(message: lastEntry.message)
        } else {
            status = .idle
        }
    }

    deinit {
        source?.cancel()
    }
}
