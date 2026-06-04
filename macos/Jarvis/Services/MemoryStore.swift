import Foundation
import GRDB

/// Сервис работы с SQLite базой данных долгосрочной памяти `memory.db`.
enum MemoryStore {

    /// Подключиться к базе данных.
    private static func connect() -> DatabaseQueue? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let dbPath = "\(home)/.cache/jarvis/memory.db"

        // Проверяем наличие файла
        guard FileManager.default.fileExists(atPath: dbPath) else {
            print("⚠️ MemoryStore: файл базы данных не найден по адресу: \(dbPath)")
            return nil
        }

        do {
            var config = Configuration()
            config.readonly = false // Позволяет изменять данные (например, удалять записи)
            return try DatabaseQueue(path: dbPath, configuration: config)
        } catch {
            print("⚠️ MemoryStore: не удалось открыть базу данных SQLite: \(error)")
            return nil
        }
    }

    /// Получить список записей памяти с поисковым фильтром.
    static func fetchMemos(query: String? = nil, limit: Int = 100) -> [MemoryRecord] {
        guard let db = connect() else { return [] }

        do {
            return try db.read { dbConn in
                if let query = query, !query.trimmingCharacters(in: .whitespaces).isEmpty {
                    let pattern = "%\(query)%"
                    return try MemoryRecord
                        .filter(Column("content").like(pattern) || Column("tag").like(pattern))
                        .order(Column("id").desc)
                        .limit(limit)
                        .fetchAll(dbConn)
                } else {
                    return try MemoryRecord
                        .order(Column("id").desc)
                        .limit(limit)
                        .fetchAll(dbConn)
                }
            }
        } catch {
            print("⚠️ MemoryStore: ошибка выборки записей SELECT: \(error)")
            return []
        }
    }

    /// Удалить запись из базы данных памяти по её ID.
    static func deleteMemo(id: Int64) -> Bool {
        guard let db = connect() else { return false }

        do {
            return try db.write { dbConn in
                let deletedCount = try MemoryRecord.filter(Column("id") == id).deleteAll(dbConn)
                return deletedCount > 0
            }
        } catch {
            print("⚠️ MemoryStore: ошибка удаления записи #\(id): \(error)")
            return false
        }
    }
}
