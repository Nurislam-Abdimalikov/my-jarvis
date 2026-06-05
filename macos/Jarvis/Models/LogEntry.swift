import Foundation

/// Одно структурированное событие из `events.jsonl`.
struct LogEntry: Codable, Identifiable, Equatable {

    /// Уникальный идентификатор на основе временной метки и типа события
    var id: String {
        ts + "_" + type
    }

    let type: String          // "status", "user_message", "assistant_message", "skill_result", "skills_call", "stt_result"
    let ts: String            // Временная метка ISO: "2026-06-05T17:16:54.123"

    // Опциональные поля в зависимости от типа события
    let status: String?
    let text: String?
    let language: String?
    let duration: Double?
    let names: [String]?
    let name: String?
    let success: Bool?
    let message: String?

    /// Декодировать строку лога в объект `LogEntry`.
    static func parse(_ raw: String) -> LogEntry? {
        guard let data = raw.data(using: .utf8) else { return nil }
        do {
            return try JSONDecoder().decode(LogEntry.self, from: data)
        } catch {
            // Игнорируем некорректные строки (например пустые или поврежденные)
            return nil
        }
    }

    /// Короткое время для отображения в чате: "17:16"
    var shortTime: String {
        let cleanTs = ts.replacingOccurrences(of: "T", with: " ")
        guard cleanTs.count >= 16 else { return "" }
        let start = cleanTs.index(cleanTs.startIndex, offsetBy: 11)
        let end = cleanTs.index(cleanTs.startIndex, offsetBy: 16)
        return String(cleanTs[start..<end])
    }
}
