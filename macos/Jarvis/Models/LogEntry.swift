import Foundation

/// Одна строка из `jarvis.log` — формат loguru.
///
/// ```
/// 2026-05-18 19:44:29.140 | INFO | module:func:line - 📝 STT: 'текст'
/// ```
struct LogEntry: Identifiable, Equatable {
    let id = UUID()
    let raw: String
    let timestamp: String   // "2026-05-18 19:44:29.140"
    let level: LogLevel
    let module: String      // "jarvis.stt.whisper_stt:_transcribe:90"
    let message: String     // "📝 STT: 'Открой хром.' (lang=ru, 4.5s)"

    enum LogLevel: String, CaseIterable {
        case debug = "DEBUG"
        case info = "INFO"
        case warning = "WARNING"
        case error = "ERROR"
        case unknown = "UNKNOWN"
    }

    /// Парсинг одной строки лога loguru.
    ///
    /// Формат: `TIMESTAMP | LEVEL | MODULE - MESSAGE`
    static func parse(_ raw: String) -> LogEntry {
        // Regex: "2026-05-18 19:44:29.140 | INFO | module:func:90 - message"
        let pattern = #"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*-\s*(.+)$"#

        guard let match = raw.range(of: pattern, options: .regularExpression) else {
            return LogEntry(raw: raw, timestamp: "", level: .info, module: "", message: raw)
        }

        // Достаём через NSRegularExpression для доступа к группам
        let nsRange = NSRange(raw.startIndex..., in: raw)
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let result = regex.firstMatch(in: raw, range: nsRange) else {
            return LogEntry(raw: raw, timestamp: "", level: .info, module: "", message: raw)
        }

        func group(_ i: Int) -> String {
            guard let range = Range(result.range(at: i), in: raw) else { return "" }
            return String(raw[range]).trimmingCharacters(in: .whitespaces)
        }

        let levelStr = group(2).uppercased()
        let level = LogLevel(rawValue: levelStr) ?? .unknown

        return LogEntry(
            raw: raw,
            timestamp: group(1),
            level: level,
            module: group(3),
            message: group(4)
        )
    }

    /// Короткое время для отображения в чате: "19:44"
    var shortTime: String {
        guard timestamp.count >= 16 else { return "" }
        let start = timestamp.index(timestamp.startIndex, offsetBy: 11)
        let end = timestamp.index(timestamp.startIndex, offsetBy: 16)
        return String(timestamp[start..<end])
    }
}
