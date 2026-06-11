const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const JARVIS_ROOT = path.join(os.homedir(), 'jarvis')
const LOG_PATH = path.join(JARVIS_ROOT, 'logs', 'jarvis.log')
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
      sandbox: true,
      webSecurity: true,
    },
  })

  // Content-Security-Policy: запрещаем загрузку внешних скриптов/объектов.
  // Логи и память пишутся LLM'ом — если в UI попадёт вредоносная разметка,
  // CSP не даст ей подгрузить внешний код (XSS → RCE-цепочка).
  // В dev Next.js требует 'unsafe-eval'/'unsafe-inline' и ws для HMR.
  const csp = isDev
    ? "default-src 'self' http://localhost:3000 ws://localhost:3000; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:3000; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'"
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  // Блокируем навигацию на внешние URL и открытие новых окон из renderer'а —
  // частый вектор эскалации XSS до RCE в Electron.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith('http://localhost:3000') : url.startsWith('file://')
    if (!allowed) event.preventDefault()
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

