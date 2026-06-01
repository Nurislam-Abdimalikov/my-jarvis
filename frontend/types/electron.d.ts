// Type declarations for Electron IPC bridge (window.jarvis)

export {}

declare global {
  interface Window {
    jarvis?: {
      /** Read last N lines from ~/jarvis/logs/jarvis.log */
      readLog(lines?: number): Promise<string[]>

      /** Read rows from ~/jarvis/memory.db SQLite */
      readMemory(): Promise<Record<string, unknown>[]>

      /** Read ~/jarvis/config/skills.yaml parsed as JS object */
      readSkills(): Promise<{
        skills: Record<string, { enabled: boolean; [key: string]: unknown }>
      }>

      /** Get stats: today's command count, total, top commands */
      getStats(): Promise<{
        today: number
        total: number
        topCommands: { name: string; count: number }[]
      }>
    }
  }
}
