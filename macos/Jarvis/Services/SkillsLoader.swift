import Foundation
import Yams

/// Сервис загрузки навыков из `config/skills.yaml`.
enum SkillsLoader {

    /// Прочитать и распарсить YAML-конфиг навыков.
    static func load() -> [String: SkillConfig] {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let path = "\(home)/jarvis/config/skills.yaml"

        guard FileManager.default.fileExists(atPath: path) else {
            print("⚠️ SkillsLoader: файл конфига не найден по пути: \(path)")
            return [:]
        }

        do {
            let yamlContent = try String(contentsOfFile: path, encoding: .utf8)
            let decoder = YAMLDecoder()
            let content = try decoder.decode(SkillsFileContent.self, from: yamlContent)
            return content.skills
        } catch {
            print("⚠️ SkillsLoader: ошибка чтения/парсинга YAML: \(error)")
            return [:]
        }
    }
}
