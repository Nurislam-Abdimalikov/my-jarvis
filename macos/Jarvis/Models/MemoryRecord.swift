import Foundation
import GRDB

/// Модель записи долгосрочной памяти из таблицы `memos` в `memory.db`.
struct MemoryRecord: Codable, FetchableRecord, TableRecord, Identifiable, Equatable {
    
    /// Название таблицы в SQLite
    static let databaseTableName = "memos"

    let id: Int64?
    let ts: String          // Дата создания в ISO формате
    let content: String     // Текст заметки
    let tag: String?        // Опциональный тег заметки

    /// Форматированная локализованная дата для вывода в интерфейсе.
    var formattedDate: String {
        let formatter = DateFormatter()
        // Пытаемся распарсить ISO формат
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        if let date = formatter.date(from: ts) {
            formatter.locale = Locale(identifier: "ru_RU")
            formatter.dateFormat = "d MMMM yyyy, HH:mm"
            return formatter.string(from: date)
        }
        
        // Фолбэк для других форматов
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let date = formatter.date(from: ts) {
            formatter.locale = Locale(identifier: "ru_RU")
            formatter.dateFormat = "d MMMM yyyy, HH:mm"
            return formatter.string(from: date)
        }
        
        return ts
    }
}
