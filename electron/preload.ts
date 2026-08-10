import { contextBridge, ipcRenderer } from 'electron'

// Expose a minimal, whitelist API to the renderer process.
// The wujie iframe sandbox CANNOT access this directly —
// communication with the child app is via wujie props only.
contextBridge.exposeInMainWorld('api', {
  /** Check if an intro page resource is available for a given routeKey */
  getIntroPageStatus: (routeKey: string) =>
    ipcRenderer.invoke('intro-page-get-status', routeKey),

  /** Open an external URL (e.g., purchase link) — validated in main process */
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),
})
