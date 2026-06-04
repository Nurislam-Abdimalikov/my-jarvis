import SwiftUI

/// Вью отображения статистики и аналитики использования ассистента.
struct StatsView: View {
    @ObservedObject var watcher: LogWatcher

    private var stats: LogParser.StatsData {
        LogParser.calculateStats(from: watcher.entries)
    }

    private var maxCount: Int {
        stats.topCommands.first?.count ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Статистика Jarvis")
                    .font(.system(size: 18, weight: .bold))
                Text("Анализ использования голосового ассистента")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 16)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Карточки
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        StatCard(
                            label: "Сегодня",
                            value: "\(stats.today)",
                            sub: "команд сегодня",
                            icon: "⚡",
                            color: .orange
                        )

                        StatCard(
                            label: "Всего",
                            value: "\(stats.total)",
                            sub: "команд в логе",
                            icon: "📊",
                            color: .green
                        )

                        StatCard(
                            label: "Скиллов",
                            value: "\(stats.topCommands.count)",
                            sub: "уникальных",
                            icon: "🔧",
                            color: .blue
                        )
                    }

                    // Топ команды
                    VStack(alignment: .leading, spacing: 12) {
                        Text("ТОП КОМАНДЫ")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.secondary)
                            .tracking(1)

                        if stats.topCommands.isEmpty {
                            Text("Данных пока нет")
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                                .padding(.vertical, 8)
                        } else {
                            VStack(spacing: 8) {
                                ForEach(stats.topCommands) { cmd in
                                    CommandBar(
                                        name: cmd.name,
                                        count: cmd.count,
                                        max: maxCount
                                    )
                                }
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .frame(minWidth: 450, minHeight: 400)
        .background(Color(NSColor.windowBackgroundColor))
    }
}

// MARK: - Stat Card View
private struct StatCard: View {
    let label: String
    let value: String
    let sub: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(icon)
                    .font(.system(size: 14))
            }

            Text(value)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(color)

            Text(sub)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.primary.opacity(0.02))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }
}

// MARK: - Command Bar View
private struct CommandBar: View {
    let name: String
    let count: Int
    let max: Int

    private var percentage: Double {
        max > 0 ? Double(count) / Double(max) : 0.0
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(name)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(.primary)
                .frame(width: 140, alignment: .leading)
                .lineLimit(1)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.primary.opacity(0.04))
                        .frame(height: 4)

                    Capsule()
                        .fill(.linearGradient(
                            colors: [.blue, .purple],
                            startPoint: .leading,
                            endPoint: .trailing
                        ))
                        .frame(width: geo.size.width * CGFloat(percentage), height: 4)
                }
            }
            .frame(height: 4)

            Text("\(count)")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(.secondary)
                .frame(width: 30, alignment: .trailing)
        }
        .padding(.vertical, 4)
        .border(width: 1, edges: [.bottom], color: Color.primary.opacity(0.03))
    }
}

// MARK: - Edge Border Helper
extension View {
    func border(width: CGFloat, edges: [Edge], color: Color) -> some View {
        overlay(EdgeBorder(width: width, edges: edges).foregroundColor(color))
    }
}

private struct EdgeBorder: Shape {
    var width: CGFloat
    var edges: [Edge]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        for edge in edges {
            var x: CGFloat {
                switch edge {
                case .top, .bottom, .leading: return rect.minX
                case .trailing: return rect.maxX - width
                }
            }

            var y: CGFloat {
                switch edge {
                case .top, .leading, .trailing: return rect.minY
                case .bottom: return rect.maxY - width
                }
            }

            var w: CGFloat {
                switch edge {
                case .top, .bottom: return rect.width
                case .leading, .trailing: return width
                }
            }

            var h: CGFloat {
                switch edge {
                case .top, .bottom: return width
                case .leading, .trailing: return rect.height
                }
            }

            path.addRect(CGRect(x: x, y: y, width: w, height: h))
        }
        return path
    }
}
