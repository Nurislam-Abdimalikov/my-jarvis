const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const JARVIS_ROOT = path.join(os.homedir(), 'jarvis')
const LOG_PATH = path.join(JARVIS_ROOT, 'logs', 'events.jsonl')
const MEMORY_DB_PATH = path.join(JARVIS_ROOT, 'memory.db')
const SKILLS_YAML_PATH = path.join(JARVIS_ROOT, 'config', 'skills.yaml')

const isDev = process.env.NODE_ENV !== 'production'

let win = null
let tray = null
app.isQuitting = false

function createWindow() {
  win = new BrowserWindow({
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
    win.loadFile(path.join(__dirname, 'out', 'index.html'))
  }

  // Скрытие окна при закрытии вместо полного завершения
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      win.hide()
    }
    return false
  })
}

function createTray() {
  // Base64-иконка (микрофон или стильная буква J 16x16 в формате Template)
  const iconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEDzhZAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AYDEg8yJ40gugAAADFJREFUOMtjfGzD8J+BAsDEwMCgGBVTCkaKoFExioExbNQMxsCgl4xRwygGDFUwigFDAACL2AElM4N1pAAAAABJRU5ErkJggg=='
  const trayIcon = nativeImage.createFromDataURL(iconBase64)
  trayIcon.setTemplateImage(true) // Авто-смена цвета иконки на macOS

  tray = new Tray(trayIcon)

  const updateMenu = () => {
    const isAutostart = app.getLoginItemSettings().openAtLogin
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Показать Jarvis',
        click: () => {
          if (win) win.show()
        }
      },
      {
        label: 'Запускать при старте системы',
        type: 'checkbox',
        checked: isAutostart,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
            path: app.getPath('exe'),
            openAsHidden: true
          })
          updateMenu()
        }
      },
      { type: 'separator' },
      {
        label: 'Выйти',
        click: () => {
          app.isQuitting = true
          app.quit()
        }
      }
    ])
    tray.setContextMenu(contextMenu)
  }

  tray.setToolTip('Jarvis Assistant')
  updateMenu()

  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide()
      } else {
        win.show()
        win.focus()
      }
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (win) win.show()
  })
})

app.on('window-all-closed', () => {
  // На macOS мы не выходим из приложения при закрытии всех окон,
  // так как оно должно продолжать работать в фоне в трее.
  if (process.platform !== 'darwin') {
    app.quit()
  }
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

// ─── IPC: Clear Log ──────────────────────────────────────────────────────────
ipcMain.handle('clear-log', async () => {
  try {
    fs.writeFileSync(LOG_PATH, '', 'utf-8')
    return true
  } catch (err) {
    console.error('clear-log error:', err)
    return false
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
    let todayCount = 0
    let totalCount = 0
    const toolCounts = {}

    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (event.type === 'stt_result') {
          totalCount++
          if (event.ts && event.ts.startsWith(today)) {
            todayCount++
          }
        } else if (event.type === 'skill_result') {
          if (event.name) {
            toolCounts[event.name] = (toolCounts[event.name] || 0) + 1
          }
        }
      } catch (e) {
        // Игнорируем некорректные строки
      }
    }

    const topCommands = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    return { today: todayCount, total: totalCount, topCommands }
  } catch (err) {
    console.error('get-stats error:', err)
    return { today: 0, total: 0, topCommands: [] }
  }
})

// ─── IPC: Stop TTS ───────────────────────────────────────────────────────────
ipcMain.handle('stop-tts', async () => {
  try {
    const stopFlagPath = path.join(JARVIS_ROOT, 'logs', 'stop.flag')
    const logsDir = path.dirname(stopFlagPath)
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    fs.writeFileSync(stopFlagPath, '', 'utf-8')
    return true
  } catch (err) {
    console.error('stop-tts error:', err)
    return false
  }
})

// ─── IPC: Auto-start status ──────────────────────────────────────────────────
ipcMain.handle('get-autostart-status', async () => {
  try {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin
  } catch (err) {
    console.error('get-autostart-status error:', err)
    return false
  }
})

ipcMain.handle('set-autostart-status', async (_, value) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: value,
      path: app.getPath('exe'),
      openAsHidden: true
    })
    return true
  } catch (err) {
    console.error('set-autostart-status error:', err)
    return false
  }
})
