const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jarvis', {
  readLog: (lines) => ipcRenderer.invoke('read-log', lines),
  readMemory: () => ipcRenderer.invoke('read-memory'),
  readSkills: () => ipcRenderer.invoke('read-skills'),
  getStats: () => ipcRenderer.invoke('get-stats'),
})
