#!/usr/bin/env bash
# ============================================================
# scripts/check_env.sh — диагностика безопасности и pre-commit окружения.
# Проверяет: наличие .env, права 600 на .env, наличие .pre-commit-config.yaml,
# установлен ли pre-commit хук в .git/hooks/pre-commit.
# Exit 0 если всё OK, иначе exit 1.
# ============================================================
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

issues=0

# --- 1. Наличие .env ---
check_env_file() {
    if [ -f ".env" ]; then
        echo "✅ .env найден"
        return 0
    else
        echo "❌ .env not found, run scripts/setup.sh"
        issues=$((issues + 1))
        return 1
    fi
}

# --- 2. Права .env (macOS: stat -f "%Lp") ---
check_env_perms() {
    if [ ! -f ".env" ]; then
        # Уже зарепорчено в check_env_file, не дублируем
        return 1
    fi

    local perms
    perms="$(stat -f "%Lp" .env)"

    if [ "$perms" = "600" ]; then
        echo "✅ .env permissions: 600"
        return 0
    else
        echo "⚠️  .env permissions are ${perms}, expected 600 (run: chmod 600 .env)"
        issues=$((issues + 1))
        return 1
    fi
}

# --- 3. Наличие .pre-commit-config.yaml ---
check_precommit_config() {
    if [ -f ".pre-commit-config.yaml" ]; then
        echo "✅ .pre-commit-config.yaml найден"
        return 0
    else
        echo "⚠️  .pre-commit-config.yaml not found, run: pip install pre-commit && pre-commit install"
        issues=$((issues + 1))
        return 1
    fi
}

# --- 4. Установлен ли git-хук pre-commit ---
check_precommit_hook() {
    local hook=".git/hooks/pre-commit"

    if [ -f "$hook" ] && grep -q "pre-commit" "$hook"; then
        echo "✅ pre-commit hook installed (.git/hooks/pre-commit)"
        return 0
    else
        echo "⚠️  pre-commit hook not installed, run: pre-commit install"
        issues=$((issues + 1))
        return 1
    fi
}

# --- Запуск проверок ---
echo "🔍 Jarvis environment check (repo: ${REPO_ROOT})"
echo ""

check_env_file
check_env_perms
check_precommit_config
check_precommit_hook

echo ""

# --- Summary ---
if [ "$issues" -eq 0 ]; then
    echo "✅ Environment OK"
    exit 0
else
    echo "❌ ${issues} issue(s) found"
    exit 1
fi
