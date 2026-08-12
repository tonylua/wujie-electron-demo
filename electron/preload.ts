import { contextBridge, ipcRenderer } from 'electron'

// Expose a minimal, whitelist API to the renderer process.
// The wujie iframe sandbox CANNOT access this directly —
// communication with the child app is via wujie props only.
contextBridge.exposeInMainWorld('api', {
  getIntroPageStatus: (routeKey: string) =>
    ipcRenderer.invoke('intro-page-get-status', routeKey),

  listIntroPages: () =>
    ipcRenderer.invoke('intro-page-list'),

  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),
})
