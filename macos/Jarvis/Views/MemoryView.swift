import SwiftUI

/// Вью отображения и удаления записей из долговременной памяти.
struct MemoryView: View {
    @State private var memos: [MemoryRecord] = []
    @State private var searchText = ""
    @State private var isLoading = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Долговременная память")
                    .font(.system(size: 18, weight: .bold))
                Text("Записи, которые вы просили Джарвиса запомнить")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)

            // Поле поиска
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                
                TextField("Поиск по тексту или тегам...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .onChange(of: searchText) { _, _ in
                        loadMemos()
                    }
                
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                        loadMemos()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
            .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal, 20)
            .padding(.bottom, 16)

            Divider()

            // Список воспоминаний
            if isLoading {
                loadingView
            } else if memos.isEmpty {
                emptyView
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(memos) { memo in
                            MemoryCard(memo: memo, onDelete: {
                                deleteMemo(memo)
                            })
                            .transition(.asymmetric(
                                insertion: .opacity.combined(with: .scale(scale: 0.95)),
                                removal: .opacity.combined(with: .scale(scale: 0.95))
                            ))
                        }
                    }
                    .padding(20)
                }
            }
        }
        .frame(minWidth: 450, minHeight: 400)
        .background(Color(NSColor.windowBackgroundColor))
        .onAppear {
            loadMemos()
        }
    }

    private func loadMemos() {
        isLoading = true
        DispatchQueue.global(qos: .userInitiated).async {
            let loaded = MemoryStore.fetchMemos(query: searchText)
            DispatchQueue.main.async {
                withAnimation(.easeOut(duration: 0.2)) {
                    self.memos = loaded
                    self.isLoading = false
                }
            }
        }
    }

    private func deleteMemo(_ memo: MemoryRecord) {
        guard let id = memo.id else { return }

        // Сначала удаляем из БД
        let success = MemoryStore.deleteMemo(id: id)

        if success {
            // Удаляем из UI с плавной анимацией
            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                memos.removeAll { $0.id == id }
            }
        }
    }

    // MARK: - Loading View
    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView("Загрузка памяти...")
                .progressViewStyle(.circular)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State
    private var emptyView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: searchText.isEmpty ? "brain.head.profile" : "magnifyingglass")
                .font(.system(size: 32))
                .foregroundStyle(.tertiary)

            Text(searchText.isEmpty ? "Память пуста" : "Ничего не найдено")
                .font(.system(size: 14, weight: .semibold))

            Text(searchText.isEmpty
                ? "Джарвис пока ничего не запомнил. Скажите ему: «Запомни, что мой пароль от Wi-Fi — 12345»"
                : "Попробуйте изменить поисковый запрос"
            )
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 40)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Memory Card
private struct MemoryCard: View {
    let memo: MemoryRecord
    let onDelete: () -> Void
    @State private var isHovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                // Красивая дата
                Text(memo.formattedDate)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)

                Spacer()

                // Тег (если есть)
                if let tag = memo.tag, !tag.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text(tag)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.blue)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.08), in: Capsule())
                }

                // Кнопка удаления (видна при наведении или всегда на macOS)
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .font(.system(size: 10))
                        .foregroundStyle(isHovering ? .red : .secondary)
                        .padding(4)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help("Удалить воспоминание")
            }

            // Контент
            Text(memo.content)
                .font(.system(size: 13))
                .foregroundStyle(.primary)
                .lineSpacing(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(Color.primary.opacity(0.02))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
        .onHover { hovering in
            isHovering = hovering
        }
    }
}
