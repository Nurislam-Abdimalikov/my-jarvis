import Foundation

/// Управление TTS — создание stop.flag для прерывания озвучки.
///
/// Backend проверяет наличие `~/jarvis/logs/stop.flag` и останавливает TTS.
enum TTSController {

    private static var stopFlagPath: String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return "\(home)/jarvis/logs/stop.flag"
    }

    /// Создать stop.flag → backend остановит текущую озвучку.
    static func stop() {
        let logsDir = (stopFlagPath as NSString).deletingLastPathComponent
        try? FileManager.default.createDirectory(
            atPath: logsDir,
            withIntermediateDirectories: true
        )
        FileManager.default.createFile(atPath: stopFlagPath, contents: nil)
    }
}
