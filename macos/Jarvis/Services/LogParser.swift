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
            let msg = entry.message

            if msg.contains("🗣️ Ты:") {
                // Сохранить предыдущую группу
                if let group = currentGroup {
                    messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
                }
                let text = msg.replacingOccurrences(of: "🗣️ Ты:", with: "").trimmingCharacters(in: .whitespaces)
                currentGroup = (.user, text, entry.shortTime, [])

            } else if msg.contains("🤖 Джарвис:") {
                if let group = currentGroup {
                    messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
                }
                let text = msg.replacingOccurrences(of: "🤖 Джарвис:", with: "").trimmingCharacters(in: .whitespaces)
                currentGroup = (.jarvis, text, entry.shortTime, [])

            } else if msg.contains("📝 STT:") {
                // Fallback для записей без "🗣️ Ты:" (старый формат)
                if let group = currentGroup {
                    messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
                }
                var text = msg.replacingOccurrences(of: "📝 STT:", with: "").trimmingCharacters(in: .whitespaces)
                // Убрать одинарные кавычки
                if text.hasPrefix("'") { text.removeFirst() }
                if let parenIdx = text.lastIndex(of: "(") {
                    text = String(text[text.startIndex..<parenIdx]).trimmingCharacters(in: .whitespaces)
                }
                if text.hasSuffix("'") { text.removeLast() }
                currentGroup = (.user, text, entry.shortTime, [])

            } else if msg.contains("→") && (msg.contains("(✓)") || msg.contains("(✗)")) {
                let isSuccess = msg.contains("(✓)")
                // Извлечь имя навыка и сообщение
                let skillName: String
                let cleanMsg: String

                if let arrowRange = msg.range(of: "→") {
                    let afterArrow = msg[arrowRange.upperBound...].trimmingCharacters(in: .whitespaces)
                    let parts = afterArrow.components(separatedBy: ":")
                    if parts.count >= 2 {
                        let namePart = parts[0]
                            .replacingOccurrences(of: "(✓)", with: "")
                            .replacingOccurrences(of: "(✗)", with: "")
                            .trimmingCharacters(in: .whitespaces)
                        skillName = namePart
                        cleanMsg = parts.dropFirst().joined(separator: ":").trimmingCharacters(in: .whitespaces)
                    } else {
                        skillName = "skill"
                        cleanMsg = afterArrow
                    }
                } else {
                    skillName = "skill"
                    cleanMsg = msg
                }

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
            }
        }

        // Не забыть последнюю группу
        if let group = currentGroup {
            messages.append(ChatMessage(sender: group.sender, text: group.text, time: group.time, skills: group.skills))
        }

        return messages
    }
}
