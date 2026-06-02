const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jarvis', {
  readLog: (lines) => ipcRenderer.invoke('read-log', lines),
  clearLog: () => ipcRenderer.invoke('clear-log'),
  readMemory: () => ipcRenderer.invoke('read-memory'),
  readSkills: () => ipcRenderer.invoke('read-skills'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  stopTts: () => ipcRenderer.invoke('stop-tts'),
  getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
  setAutostartStatus: (val) => ipcRenderer.invoke('set-autostart-status', val),
})
