#!/bin/bash
set -e

# Переходим в директорию скрипта
cd "$(dirname "$0")"

echo "🔨 Сборка проекта через Swift Package Manager в режиме Release..."
swift build -c release

echo "📂 Создание структуры бандла Jarvis.app..."
mkdir -p build/Jarvis.app/Contents/MacOS
mkdir -p build/Jarvis.app/Contents/Resources

echo "💾 Копирование исполняемого файла..."
cp .build/release/Jarvis build/Jarvis.app/Contents/MacOS/

echo "📝 Копирование Info.plist..."
cp Jarvis/Info.plist build/Jarvis.app/Contents/Info.plist

echo "✅ Сборка успешно завершена!"
echo "🚀 Приложение готово к запуску: $(pwd)/build/Jarvis.app"
