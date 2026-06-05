import Foundation

/// Парсер лога → структурированные сообщения чата.
///
/// Зеркалит логику `buildChatMessages()` из `frontend/utils/chatUtils.js`.
/// Чат = read-only зеркало голосового диалога.
enum LogParser {

    /// Сгруппировать записи лога в сообщения чата.
    static func buildChatMessages(from entries: [LogEntry]) -> [ChatMessage] {
        var messages: [ChatMessage] = []
        var currentGroup: (sender: ChatMessage.Sender, text: String, time: String, skills: [ChatMessage.SkillResult])?

        for entry in entries {
            switch entry.type {
            case "user_message":
                if let group = currentGroup {
                    messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
                }
                currentGroup = (.user, entry.text ?? "", entry.shortTime, [])

            case "assistant_message":
                if let group = currentGroup {
                    messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
                }
                currentGroup = (.jarvis, entry.text ?? "", entry.shortTime, [])

            case "stt_result":
                // В новых версиях всегда идет user_message, но stt_result может быть фолбэком
                if currentGroup == nil {
                    currentGroup = (.user, entry.text ?? "", entry.shortTime, [])
                }

            case "skill_result":
                let skillName = entry.name ?? "skill"
                let isSuccess = entry.success ?? true
                let cleanMsg = entry.message ?? ""
                let result = ChatMessage.SkillResult(name: skillName, success: isSuccess, message: cleanMsg)

                if currentGroup != nil {
                    currentGroup?.skills.append(result)
                } else {
                    messages.append(ChatMessage(
                        sender: .system,
                        text: "\(isSuccess ? "✓" : "✗") [\(skillName)] \(cleanMsg)",
                        time: entry.shortTime,
                        skills: []
                    ))
                }

            default:
                break
            }
        }

        // Не забыть последнюю группу
        if let group = currentGroup {
            messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
        }

        return messages
    }

    /// Структура данных статистики.
    struct StatsData {
        let today: Int
        let total: Int
        let topCommands: [CommandStat]
    }

    /// Элемент статистики команды.
    struct CommandStat: Identifiable, Equatable {
        var id: String { name }
        let name: String
        let count: Int
    }

    /// Подсчитать статистику использования из записей лога.
    static func calculateStats(from entries: [LogEntry]) -> StatsData {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let todayStr = formatter.string(from: Date())

        let sttEntries = entries.filter { $0.type == "stt_result" }
        let total = sttEntries.count
        let today = sttEntries.filter { $0.ts.hasPrefix(todayStr) }.count

        var toolCounts: [String: Int] = [:]

        let skillResultEntries = entries.filter { $0.type == "skill_result" }
        for entry in skillResultEntries {
            if let toolName = entry.name {
                toolCounts[toolName, default: 0] += 1
            }
        }

        let topCommands = toolCounts.map { CommandStat(name: $0.key, count: $0.value) }
            .sorted { $0.count > $1.count }
            .prefix(8)

        return StatsData(today: today, total: total, topCommands: Array(topCommands))
    }
}
