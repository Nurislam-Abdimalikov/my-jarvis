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

    /// Определить статус по строке кода из JSON-события.
    static func from(code: String) -> AssistantStatus {
        switch code {
        case "listening":  return .listening
        case "recording":  return .recording
        case "processing": return .processing
        case "speaking":   return .speaking
        default:           return .idle
        }
    }
}
