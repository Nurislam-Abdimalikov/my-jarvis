import Foundation

/// Структурированное сообщение чата — извлекается из лога.
///
/// Чат = read-only зеркало голосового диалога. Текстового ввода нет.
struct ChatMessage: Identifiable, Equatable {
    let id = UUID()
    let sender: Sender
    let text: String
    let time: String          // "19:44"
    let skills: [SkillResult]

    enum Sender: Equatable {
        case user
        case jarvis
        case system
    }

    struct SkillResult: Equatable {
        let name: String
        let success: Bool
        let message: String
    }
}
