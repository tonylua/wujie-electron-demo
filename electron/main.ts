import { app, BrowserWindow, protocol, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'

// ============================================================
// 1. Register magiintro:// as a privileged scheme
//    MUST be called before app.ready
//    - standard: URL parsed as host + path (relative paths resolve correctly)
//    - secure: treated as secure origin (allows fetch, etc.)
//    - supportFetchAPI: fetch() works with this scheme
//    - corsEnabled: CORS enabled (wujie iframe can fetch resources)
//    - stream: supports streaming responses
// ============================================================
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'magiintro',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

// ============================================================
// 2. MIME type mapping (mirrors magiAssetsProtocol.ts)
// ============================================================
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

// ============================================================
// 3. Intro Pages base path
//    Production: app.getPath('userData') + '/intro-pages/'
//    Demo:       project resources directory (inspectable)
// ============================================================
function getIntroPagesRoot(): string {
  // In a real app, this would be: path.join(app.getPath('userData'), 'intro-pages')
  // For the demo, we use the project's resources directory so files are visible
  return path.join(app.getAppPath(), 'resources', 'intro-pages')
}

// ============================================================
// 4. Security: validate path is within allowed directory
//    Prevents path traversal (../../etc/passwd)
// ============================================================
function isPathSafe(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(filePath)
  const resolvedBase = path.resolve(baseDir)
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase
}

// ============================================================
// 5. Protocol handler: magiintro://<routeKey>/<relativePath>
//    1. Parse routeKey from host, relativePath from pathname
//    2. Read "current" pointer file → version directory
//    3. Serve file from <routeKey>/<version>/<relativePath>
// ============================================================
function registerMagiIntroProtocol(): void {
  protocol.handle('magiintro', async (request) => {
    const url = new URL(request.url)

    // For standard schemes: host = routeKey, pathname = /<relativePath>
    const routeKey = url.host
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')

    console.log(`[magiintro] ${request.url} → routeKey="${routeKey}" path="${relativePath}"`)

    if (!routeKey) {
      return new Response('Missing routeKey', { status: 400 })
    }

    const introPagesRoot = getIntroPagesRoot()
    const routeDir = path.join(introPagesRoot, routeKey)

    // Read "current" pointer to get the active version
    const currentFile = path.join(routeDir, 'current')
    let version: string
    try {
      version = fs.readFileSync(currentFile, 'utf-8').trim()
    } catch {
      return new Response(`No current version pointer for routeKey: ${routeKey}`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Build the real file path: <routeKey>/<version>/<relativePath>
    const versionDir = path.join(routeDir, version)
    const filePath = path.join(versionDir, relativePath)

    // Security: prevent path traversal
    if (!isPathSafe(filePath, versionDir)) {
      return new Response('Forbidden: path traversal detected', { status: 403 })
    }

    // Check file exists and is not a directory
    try {
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        return new Response('Forbidden: path is a directory', { status: 403 })
      }
    } catch {
      return new Response(`Not Found: ${routeKey}/${relativePath}`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Read file and serve with correct MIME type
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME_TYPES[ext] || 'application/octet-stream'

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
      },
    })
  })
}

// ============================================================
// 6. IPC Handlers
// ============================================================
function registerIpcHandlers(): void {
  // Check if an intro page is available (used by navigation to decide visibility)
  ipcMain.handle('intro-page-get-status', (_event, routeKey: string) => {
    const introPagesRoot = getIntroPagesRoot()
    const currentFile = path.join(introPagesRoot, routeKey, 'current')
    try {
      const version = fs.readFileSync(currentFile, 'utf-8').trim()
      const versionDir = path.join(introPagesRoot, routeKey, version)
      const indexExists = fs.existsSync(path.join(versionDir, 'index.html'))
      return { available: indexExists, version }
    } catch {
      return { available: false }
    }
  })

  // List all available intro pages (route keys with current pointer + index.html)
  ipcMain.handle('intro-page-list', () => {
    const introPagesRoot = getIntroPagesRoot()
    try {
      const entries = fs.readdirSync(introPagesRoot, { withFileTypes: true })
      const pages: { routeKey: string; available: boolean }[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const routeKey = entry.name
        const currentFile = path.join(introPagesRoot, routeKey, 'current')
        try {
          const version = fs.readFileSync(currentFile, 'utf-8').trim()
          const indexExists = fs.existsSync(path.join(introPagesRoot, routeKey, version, 'index.html'))
          pages.push({ routeKey, available: indexExists })
        } catch {
          pages.push({ routeKey, available: false })
        }
      }
      return pages
    } catch {
      return []
    }
  })

  // Open external URL (e.g., purchase link) — child cannot call this directly
  ipcMain.handle('open-external', (_event, url: string) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url)
    }
  })
}

// ============================================================
// 7. Window creation
// ============================================================
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Wujie + Electron Custom Protocol Demo',
    webPreferences: {
      // Preload script path: out/preload/preload.js relative to out/main/
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// ============================================================
// 8. App lifecycle
// ============================================================
app.whenReady().then(() => {
  registerMagiIntroProtocol()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
