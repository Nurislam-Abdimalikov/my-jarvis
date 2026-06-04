import SwiftUI

/// Отдельное окно чата — read-only зеркало голосового диалога.
struct ChatWindow: View {
    @ObservedObject var watcher: LogWatcher

    private var chatMessages: [ChatMessage] {
        LogParser.buildChatMessages(from: watcher.entries)
    }

    var body: some View {
        VStack(spacing: 0) {
            if chatMessages.isEmpty {
                emptyStateView
            } else {
                messagesScrollView
            }

            Divider()

            // Интерактивный футер со статусом
            statusFooter
        }
        .frame(minWidth: 400, minHeight: 500)
        .background(Color(NSColor.windowBackgroundColor))
    }

    // MARK: - Empty State View
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Spacer()

            // Анимированный пульсирующий микрофон
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 80, height: 80)
                
                // Внешнее пульсирующее кольцо
                Circle()
                    .stroke(Color.blue.opacity(0.2), lineWidth: 1)
                    .frame(width: 100, height: 100)
                    .scaleEffect(watcher.status == .listening ? 1.1 : 1.0)
                    .opacity(watcher.status == .listening ? 0.5 : 1.0)
                    .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: watcher.status)

                Image(systemName: "mic.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(.linearGradient(
                        colors: [.blue, .cyan],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
            }
            .padding(.bottom, 8)

            VStack(spacing: 6) {
                Text("Чат пуст")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)

                Text("Произнесите ключевое слово ")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                + Text("«Джарвис»")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundStyle(.cyan)
                + Text(" и дайте команду!")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)

            Spacer()
        }
    }

    // MARK: - Messages Scroll View
    private var messagesScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    ForEach(chatMessages) { message in
                        MessageRow(message: message)
                            .id(message.id)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .onChange(of: chatMessages.count) { _, _ in
                scrollToBottom(with: proxy)
            }
            .onAppear {
                scrollToBottom(with: proxy)
            }
        }
    }

    private func scrollToBottom(with proxy: ScrollViewProxy) {
        if let lastMessage = chatMessages.last {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo(lastMessage.id, anchor: .bottom)
            }
        }
    }

    // MARK: - Status Footer
    private var statusFooter: some View {
        HStack {
            Spacer()
            
            // Нажимаемый статус-бар
            Button {
                if watcher.status == .speaking {
                    TTSController.stop()
                }
            } label: {
                HStack(spacing: 10) {
                    statusWidget
                    
                    Text(watcher.status == .speaking ? "Джарвис отвечает... (Нажмите, чтобы остановить)" : watcher.status.label)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(watcher.status == .speaking ? .red : .secondary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(watcher.status == .speaking ? Color.red.opacity(0.08) : Color.primary.opacity(0.03))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(watcher.status == .speaking ? Color.red.opacity(0.2) : Color.clear, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(watcher.status != .speaking)
            .help(watcher.status == .speaking ? "Остановить речь Джарвиса" : "")
            
            Spacer()
        }
        .padding(.vertical, 12)
        .background(.ultraThinMaterial) // Эффект стекла
    }

    // MARK: - Status Widget
    @ViewBuilder
    private var statusWidget: some View {
        switch watcher.status {
        case .listening:
            ZStack {
                Circle()
                    .fill(Color.green.opacity(0.2))
                    .frame(width: 14, height: 14)
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
            }
        case .recording:
            ZStack {
                Circle()
                    .fill(Color.red.opacity(0.3))
                    .frame(width: 14, height: 14)
                    .scaleEffect(1.2)
                Circle()
                    .fill(Color.red)
                    .frame(width: 8, height: 8)
            }
        case .processing:
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(0.6)
                .frame(width: 14, height: 14)
        case .speaking:
            // Анимированный эквалайзер
            EqualizerAnimation()
                .frame(width: 16, height: 12)
        case .idle:
            Circle()
                .fill(Color.gray)
                .frame(width: 8, height: 8)
        }
    }
}

// MARK: - Message Row View
private struct MessageRow: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.sender == .user {
                Spacer(minLength: 50)
            } else if message.sender == .system {
                Spacer(minLength: 10)
            }

            VStack(alignment: message.sender == .user ? .trailing : .leading, spacing: 4) {
                // Имя отправителя
                if message.sender != .system {
                    Text(message.sender == .user ? "Вы" : "Джарвис")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.secondary)
                }

                // Тело сообщения (баббл)
                if message.sender == .system {
                    Text(message.text)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
                        )
                } else {
                    VStack(alignment: message.sender == .user ? .trailing : .leading, spacing: 6) {
                        Text(message.text)
                            .font(.system(size: 13))
                            .foregroundStyle(message.sender == .user ? .white : .primary)
                            .multilineTextAlignment(.leading)
                            .lineSpacing(3)
                        
                        Text(message.time)
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(message.sender == .user ? .white.opacity(0.7) : .secondary.opacity(0.7))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        message.sender == .user
                            ? AnyShapeStyle(.linearGradient(
                                colors: [.blue, .purple],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                              ))
                            : AnyShapeStyle(Color.primary.opacity(0.05)),
                        in: RoundedRectangle(cornerRadius: 16)
                    )
                }

                // Вызванные навыки под бабблом
                if !message.skills.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(message.skills, id: \.name) { skill in
                            HStack(spacing: 3) {
                                Image(systemName: skill.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .font(.system(size: 9))
                                Text(skill.name)
                                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            }
                            .foregroundStyle(skill.success ? .green : .red)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                (skill.success ? Color.green : Color.red).opacity(0.08),
                                in: Capsule()
                            )
                            .overlay(
                                Capsule()
                                    .stroke((skill.success ? Color.green : Color.red).opacity(0.2), lineWidth: 1)
                            )
                        }
                    }
                    .padding(.top, 2)
                }
            }

            if message.sender == .jarvis {
                Spacer(minLength: 50)
            } else if message.sender == .system {
                Spacer(minLength: 10)
            }
        }
    }
}

// MARK: - Equalizer Animation Helper
private struct EqualizerAnimation: View {
    @State private var animate = false

    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(0..<4) { index in
                RoundedRectangle(cornerRadius: 1)
                    .fill(Color.red)
                    .frame(width: 2)
                    .frame(height: animate ? CGFloat.random(in: 4...12) : 3)
                    .animation(
                        .easeInOut(duration: 0.3)
                        .repeatForever(autoreverses: true)
                        .delay(Double(index) * 0.1),
                        value: animate
                    )
            }
        }
        .onAppear {
            animate = true
        }
    }
}


