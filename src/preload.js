const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  onProgress: (cb) => ipcRenderer.on('progress', (_, data) => cb(data)),
  onChangelog: (cb) => ipcRenderer.on('changelog', (_, data) => cb(data)),
  onBackground: (cb) => ipcRenderer.on('background', (_, dataUrl) => cb(dataUrl)),
  onReady: (cb) => ipcRenderer.on('ready', (_, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('error', (_, msg) => cb(msg)),
  launchGame: () => ipcRenderer.send('launch-game'),
  retryUpdate: () => ipcRenderer.send('retry-update'),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
})
