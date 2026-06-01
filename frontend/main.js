const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const JARVIS_ROOT = path.join(os.homedir(), 'jarvis')
const LOG_PATH = path.join(JARVIS_ROOT, 'logs', 'jarvis.log')
const MEMORY_DB_PATH = path.join(JARVIS_ROOT, 'memory.db')
const SKILLS_YAML_PATH = path.join(JARVIS_ROOT, 'config', 'skills.yaml')

const isDev = process.env.NODE_ENV !== 'production'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:3000')
  } else {
    win.loadFile(path.join(__dirname, 'ui', 'out', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Read Log ───────────────────────────────────────────────────────────
ipcMain.handle('read-log', async (_, lines = 500) => {
  try {
    if (!fs.existsSync(LOG_PATH)) return []
    const content = fs.readFileSync(LOG_PATH, 'utf-8')
    const allLines = content.split('\n').filter(Boolean)
    return allLines.slice(-lines)
  } catch (err) {
    console.error('read-log error:', err)
    return []
  }
})

// ─── IPC: Read Memory DB ─────────────────────────────────────────────────────
ipcMain.handle('read-memory', async () => {
  try {
    if (!fs.existsSync(MEMORY_DB_PATH)) return []
    const Database = require('better-sqlite3')
    const db = new Database(MEMORY_DB_PATH, { readonly: true })
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    if (!tables.length) return []
    const tableName = tables[0].name
    const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 100`).all()
    db.close()
    return rows
  } catch (err) {
    console.error('read-memory error:', err)
    return []
  }
})

// ─── IPC: Read Skills YAML ───────────────────────────────────────────────────
ipcMain.handle('read-skills', async () => {
  try {
    if (!fs.existsSync(SKILLS_YAML_PATH)) return {}
    const yaml = require('js-yaml')
    const content = fs.readFileSync(SKILLS_YAML_PATH, 'utf-8')
    return yaml.load(content)
  } catch (err) {
    console.error('read-skills error:', err)
    return {}
  }
})

// ─── IPC: Get Stats ──────────────────────────────────────────────────────────
ipcMain.handle('get-stats', async () => {
  try {
    if (!fs.existsSync(LOG_PATH)) return { today: 0, total: 0, topCommands: [] }
    const content = fs.readFileSync(LOG_PATH, 'utf-8')
    const lines = content.split('\n').filter(Boolean)

    const today = new Date().toISOString().slice(0, 10)

    const sttLines = lines.filter(l => l.includes('📝 STT:'))
    const todaySTT = sttLines.filter(l => l.startsWith(today))

    const toolCallLines = lines.filter(l => l.includes('Tool calls') && l.includes('['))
    const toolCounts = {}
    for (const line of toolCallLines) {
      const match = line.match(/\[([^\]]+)\]/)
      if (match) {
        const tools = match[1].split(',').map(t => t.replace(/['"]/g, '').trim()).filter(Boolean)
        for (const tool of tools) {
          toolCounts[tool] = (toolCounts[tool] || 0) + 1
        }
      }
    }

    const topCommands = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    return { today: todaySTT.length, total: sttLines.length, topCommands }
  } catch (err) {
    console.error('get-stats error:', err)
    return { today: 0, total: 0, topCommands: [] }
  }
})
