import SwiftUI

/// Категория навыка для группировки в UI.
struct SkillCategory: Identifiable {
    let id: String
    let label: String
    let skillKeys: [String]
}

/// Вью отображения списка навыков Джарвиса.
struct SkillsView: View {
    @State private var skills: [String: SkillConfig] = [:]
    @State private var isLoading = true

    /// Соответствует категориям из frontend/app/skills/page.jsx
    private let categories = [
        SkillCategory(id: "info", label: "🕐 Информация", skillKeys: ["get_time", "get_date", "get_time_in_city", "get_weather"]),
        SkillCategory(id: "apps", label: "📱 Приложения", skillKeys: ["open_app", "close_app", "switch_app"]),
        SkillCategory(id: "browser", label: "🌐 Браузер", skillKeys: ["web_search", "open_url", "youtube_search", "wiki_search", "close_browser_tab"]),
        SkillCategory(id: "system", label: "⚙️ Система", skillKeys: ["set_volume", "set_brightness", "lock_screen", "sleep_mac", "take_screenshot"]),
        SkillCategory(id: "music", label: "🎵 Музыка", skillKeys: ["play_music", "pause_music", "next_track", "prev_track", "current_song"]),
        SkillCategory(id: "messages", label: "💬 Сообщения", skillKeys: ["send_telegram", "send_imessage", "read_unread_mail"]),
        SkillCategory(id: "calendar", label: "📅 Календарь", skillKeys: ["get_today_events", "get_tomorrow_events", "create_event"]),
        SkillCategory(id: "memory", label: "🧠 Память", skillKeys: ["remember", "recall", "forget"]),
        SkillCategory(id: "files", label: "📂 Файлы", skillKeys: ["open_path", "spotlight_search"]),
        SkillCategory(id: "vision", label: "👁 Видение", skillKeys: ["analyze_screen"])
    ]

    private var totalSkillsCount: Int {
        skills.count
    }

    private var enabledSkillsCount: Int {
        skills.values.filter { $0.isEnabled }.count
    }

    private var enabledPercent: Int {
        totalSkillsCount > 0 ? Int(Double(enabledSkillsCount) / Double(totalSkillsCount) * 100) : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Навыки ассистента")
                    .font(.system(size: 18, weight: .bold))
                Text("\(enabledSkillsCount) из \(totalSkillsCount) активны")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)

            // Прогресс-бар
            VStack(alignment: .leading, spacing: 6) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.primary.opacity(0.06))
                            .frame(height: 5)
                        
                        Capsule()
                            .fill(.linearGradient(
                                colors: [.blue, .green],
                                startPoint: .leading,
                                endPoint: .trailing
                            ))
                            .frame(width: geo.size.width * CGFloat(enabledPercent) / 100.0, height: 5)
                    }
                }
                .frame(height: 5)

                Text("\(enabledPercent)% навыков включено")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)

            Divider()

            // Сетка/список категорий
            if isLoading {
                loadingPlaceholder
            } else if skills.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 14)], spacing: 20) {
                        ForEach(categories) { category in
                            let visibleKeys = category.skillKeys.filter { skills[$0] != nil }
                            if !visibleKeys.isEmpty {
                                categorySection(category: category, keys: visibleKeys)
                            }
                        }
                    }
                    .padding(20)
                }
            }
        }
        .frame(minWidth: 450, minHeight: 400)
        .background(Color(NSColor.windowBackgroundColor))
        .onAppear {
            loadSkills()
        }
    }

    private func loadSkills() {
        isLoading = true
        // Загружаем асинхронно, чтобы не фризить UI
        DispatchQueue.global(qos: .userInitiated).async {
            let loaded = SkillsLoader.load()
            DispatchQueue.main.async {
                self.skills = loaded
                self.isLoading = false
            }
        }
    }

    // MARK: - Category Section
    private func categorySection(category: SkillCategory, keys: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(category.label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.secondary)
                .tracking(1)

            VStack(spacing: 6) {
                ForEach(keys, id: \.self) { key in
                    if let config = skills[key] {
                        SkillRow(name: key, config: config)
                    }
                }
            }
        }
    }

    // MARK: - Loading View
    private var loadingPlaceholder: some View {
        VStack {
            Spacer()
            ProgressView("Загрузка навыков...")
                .progressViewStyle(.circular)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 10) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 28))
                .foregroundStyle(.tertiary)
            Text("Навыки не найдены")
                .font(.system(size: 13, weight: .semibold))
            Text("Проверьте наличие файла config/skills.yaml")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Skill Badge / Row
private struct SkillRow: View {
    let name: String
    let config: SkillConfig

    var body: some View {
        HStack(spacing: 8) {
            // Зеленая или серая точка
            Circle()
                .fill(config.isEnabled ? Color.green : Color.gray.opacity(0.5))
                .frame(width: 6, height: 6)
                .shadow(color: config.isEnabled ? Color.green.opacity(0.4) : Color.clear, radius: 2)

            // Имя навыка
            Text(name)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(config.isEnabled ? .primary : .secondary)
                .lineLimit(1)
            
            Spacer()

            // Доп. информация о навыке
            if config.needsConfirmation {
                Text("CONFIRM")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 3)
                            .stroke(Color.orange.opacity(0.2), lineWidth: 1)
                    )
            }

            if let model = config.model {
                Text(model)
                    .font(.system(size: 9))
                    .foregroundStyle(.blue)
                    .lineLimit(1)
            } else if let engine = config.engine {
                Text(engine)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            } else if let city = config.cityDefault {
                Text(city)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.primary.opacity(0.02))
        .cornerRadius(6)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(Color.primary.opacity(0.05), lineWidth: 1)
        )
    }
}


