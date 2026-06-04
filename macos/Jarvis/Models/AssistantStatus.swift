import Foundation

/// Текущее состояние ассистента — определяется по последним строкам лога.
///
/// Зеркалит логику `getAssistantStatus()` из `frontend/utils/chatUtils.js`.
enum AssistantStatus: Equatable {
    case listening   // 🟢 Слушает фоном wake-word
    case recording   // 🔴 Записывает речь пользователя
    case processing  // ⚙️ STT + LLM + tool calling
    case speaking    // 🔊 TTS воспроизводит ответ
    case idle        // ⚪ Ожидание / неизвестно

    var label: String {
        switch self {
        case .listening:  return "Слушаю фоном..."
        case .recording:  return "Запись речи..."
        case .processing: return "Обработка запроса..."
        case .speaking:   return "Джарвис отвечает..."
        case .idle:       return "Готов к работе"
        }
    }

    var systemImage: String {
        switch self {
        case .listening:  return "ear.fill"
        case .recording:  return "mic.fill"
        case .processing: return "brain.head.profile"
        case .speaking:   return "speaker.wave.3.fill"
        case .idle:       return "circle.fill"
        }
    }

    var isActive: Bool {
        self != .idle
    }

    /// Определить статус по сообщению из последней строки лога.
    static func from(message: String) -> AssistantStatus {
        if message.contains("🟢 Слушаю фоном") {
            return .listening
        }
        if message.contains("Слушаю команду") || message.contains("Записал команду") {
            return .recording
        }
        if message.contains("STT:") || message.contains("Tool calls") || message.contains("→") {
            return .processing
        }
        if message.contains("🤖 Джарвис:") {
            return .speaking
        }
        return .idle
    }
}
