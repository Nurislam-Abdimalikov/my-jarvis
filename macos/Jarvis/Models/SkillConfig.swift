import Foundation

/// Настройки одного навыка из `skills.yaml`.
struct SkillConfig: Codable, Equatable {
    let enabled: Bool?
    let requiresConfirmation: Bool?
    let cityDefault: String?
    let engine: String?
    let provider: String?
    let model: String?
    let maxTokens: Int?
    let capture: String?

    enum CodingKeys: String, CodingKey {
        case enabled
        case requiresConfirmation = "requires_confirmation"
        case cityDefault = "city_default"
        case engine
        case provider
        case model
        case maxTokens = "max_tokens"
        case capture
    }

    /// Вспомогательное свойство для безопасного получения флага активности.
    var isEnabled: Bool {
        enabled ?? false
    }

    /// Вспомогательное свойство для безопасного получения флага подтверждения.
    var needsConfirmation: Bool {
        requiresConfirmation ?? false
    }
}

/// Корневой контейнер для парсинга `skills.yaml`.
struct SkillsFileContent: Codable {
    let skills: [String: SkillConfig]
}
