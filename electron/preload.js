const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appendLog: (entry) => ipcRenderer.send('append-log', entry),
});
