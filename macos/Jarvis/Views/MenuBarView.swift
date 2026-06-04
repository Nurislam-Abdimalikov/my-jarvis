import SwiftUI

/// Основное представление MenuBarExtra — компактный статус и быстрые действия.
struct MenuBarView: View {
    @ObservedObject var watcher: LogWatcher
    @Environment(\.openWindow) private var openWindow

    private var chatMessages: [ChatMessage] {
        LogParser.buildChatMessages(from: watcher.entries)
    }

    private var lastMessages: [ChatMessage] {
        Array(chatMessages.suffix(5))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // ─── Header ───
            HStack(spacing: 8) {
                // Аватар Jarvis
                ZStack {
                    Circle()
                        .fill(.linearGradient(
                            colors: [.cyan.opacity(0.3), .blue.opacity(0.4)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 28, height: 28)

                    Text("J")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.cyan)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text("Jarvis")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.primary)

                    HStack(spacing: 4) {
                        statusDot
                        Text(watcher.status.label)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                // Кнопка «Стоп» при озвучке
                if watcher.status == .speaking {
                    Button {
                        TTSController.stop()
                    } label: {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.red)
                            .padding(4)
                            .background(.red.opacity(0.15), in: RoundedRectangle(cornerRadius: 4))
                    }
                    .buttonStyle(.plain)
                    .help("Остановить озвучку")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider()

            // ─── Последние сообщения чата ───
            if lastMessages.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "mic.badge.plus")
                        .font(.system(size: 20))
                        .foregroundStyle(.tertiary)
                    Text("Скажите «Джарвис» для активации")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 6) {
                        ForEach(lastMessages) { msg in
                            MessageBubble(message: msg)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                }
                .frame(maxHeight: 200)
            }

            Divider()

            // ─── Footer ───
            VStack(spacing: 2) {
                HStack {
                    Label("Записей: \(watcher.entries.count)", systemImage: "doc.text")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("⌘⇧J — голосовая команда")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                }

                Divider()

                Button {
                    openWindow(id: "chat")
                } label: {
                    HStack {
                        Image(systemName: "message")
                        Text("Открыть чат...")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)

                Divider()

                Button {
                    openWindow(id: "skills")
                } label: {
                    HStack {
                        Image(systemName: "slider.horizontal.3")
                        Text("Навыки Джарвиса...")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)

                Divider()

                Button {
                    openWindow(id: "memory")
                } label: {
                    HStack {
                        Image(systemName: "brain")
                        Text("Память Джарвиса...")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)

                Divider()

                Button {
                    NSApplication.shared.terminate(nil)
                } label: {
                    HStack {
                        Image(systemName: "power")
                        Text("Выйти")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .frame(width: 320)
    }

    @ViewBuilder
    private var statusDot: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 6, height: 6)
            .shadow(color: statusColor.opacity(0.6), radius: 3)
    }

    private var statusColor: Color {
        switch watcher.status {
        case .listening:  return .green
        case .recording:  return .red
        case .processing: return .orange
        case .speaking:   return .cyan
        case .idle:       return .gray
        }
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            if message.sender == .user {
                Spacer(minLength: 40)
            }

            VStack(alignment: message.sender == .user ? .trailing : .leading, spacing: 2) {
                Text(message.text)
                    .font(.system(size: 11))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(
                        message.sender == .user
                            ? AnyShapeStyle(.blue.opacity(0.2))
                            : AnyShapeStyle(.secondary.opacity(0.1)),
                        in: RoundedRectangle(cornerRadius: 8)
                    )

                // Навыки
                if !message.skills.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(message.skills.indices, id: \.self) { i in
                            let skill = message.skills[i]
                            Text("\(skill.success ? "✓" : "✗") \(skill.name)")
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundStyle(skill.success ? .green : .red)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(
                                    (skill.success ? Color.green : Color.red).opacity(0.1),
                                    in: Capsule()
                                )
                        }
                    }
                }

                Text(message.time)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.tertiary)
            }

            if message.sender != .user {
                Spacer(minLength: 40)
            }
        }
    }
}
