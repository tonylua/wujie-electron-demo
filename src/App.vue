<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <h1>Wujie + Electron Custom Protocol Demo</h1>
      <p>
        Verifying: wujie loads local HTML via
        <code>magiintro://</code> custom Electron protocol
      </p>
    </header>

    <!-- Controls -->
    <div class="controls">
      <div class="control-group">
        <span class="label">Load mode:</span>
        <button
          :class="{ active: mode === 'url' }"
          @click="switchMode('url')"
        >
          URL mode (primary)
        </button>
        <button
          :class="{ active: mode === 'html' }"
          @click="switchMode('html')"
        >
          HTML mode (fallback)
        </button>
      </div>

      <div class="status-item">
        <span class="label">URL:</span>
        <code class="url-display">{{ protocolUrl }}</code>
      </div>

      <div class="status-item">
        <span class="label">Status:</span>
        <span :class="['status-badge', `status-${status}`]">{{ statusText }}</span>
      </div>

      <button class="reload-btn" @click="reload">Reload</button>
    </div>

    <!-- Wujie Container -->
    <div class="wujie-wrapper">
      <!-- URL mode: wujie fetches HTML from magiintro:// URL directly -->
      <!-- SECURITY: wujie plugins.jsBeforeLoaders injects a shield script that
           overrides window.parent/top to point to the iframe itself,
           running BEFORE any child app code. This blocks window.parent.api
           access without breaking subresource loading (no sandbox attr needed). -->
      <WujieVue
        v-if="mode === 'url' && renderKey > 0"
        :key="`url-${renderKey}`"
        name="test-url"
        :url="protocolUrl"
        :props="wujieProps"
        :plugins="wujiePlugins"
        :afterMount="onWujieMount"
        :loadError="onWujieError"
        :sync="true"
        :fiber="true"
      />

      <!-- HTML mode: fetch HTML string, pass as prop (fallback if URL mode fails) -->
      <WujieVue
        v-else-if="mode === 'html' && htmlContent && renderKey > 0"
        :key="`html-${renderKey}`"
        name="test-html"
        :html="htmlContent"
        :url="protocolUrl"
        :props="wujieProps"
        :plugins="wujiePlugins"
        :afterMount="onWujieMount"
        :loadError="onWujieError"
        :sync="true"
        :fiber="true"
      />

      <!-- Loading placeholder -->
      <div v-else class="placeholder">
        <p>Loading...</p>
      </div>
    </div>

    <!-- Message Log -->
    <div class="log-panel">
      <div class="log-header">
        <h3>Message Log</h3>
        <button class="clear-btn" @click="logs = []">Clear</button>
      </div>
      <div class="log-entries">
        <div
          v-for="(entry, i) in logs"
          :key="i"
          :class="['log-entry', entry.type]"
        >
          <span class="log-time">[{{ entry.time }}]</span>
          {{ entry.text }}
        </div>
        <div v-if="logs.length === 0" class="log-empty">No messages yet</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ============================================================
// State
// ============================================================
const mode = ref<'url' | 'html'>('url')
const status = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const htmlContent = ref('')
const renderKey = ref(0) // increment to force wujie re-render
const logs = ref<{ type: string; text: string; time: string }[]>([])

const protocolUrl = 'magiintro://test/index.html'

// ============================================================
// wujie isolation plugin
// wujie's bounded iframe is same-origin with the main app, so by default
// the child can access window.parent.api (LEAK). Fix: inject a script via
// jsBeforeLoaders that runs BEFORE any child app code and overrides
// window.parent / window.top to point to the iframe's own window.
// This blocks parent access without breaking subresource loading.
// ============================================================
const PARENT_SHIELD_SCRIPT = `
  (function() {
    var w = window;
    try {
      Object.defineProperty(w, 'parent', { get: function() { return w; }, configurable: false });
      Object.defineProperty(w, 'top',    { get: function() { return w; }, configurable: false });
    } catch (e) {
      w.parent = w;
      w.top = w;
    }
  })();
`

const wujiePlugins = [{
  jsBeforeLoaders: [{ content: PARENT_SHIELD_SCRIPT }],
}]

// ============================================================
// wujie props — passed to child app via window.$wujie.props
// This is the ONLY communication channel to the sandboxed child
// ============================================================
const wujieProps = {
  routeKey: 'test',
  message: 'Hello from parent app!',
  isDark: false,
  locale: 'zh_CN',
  // Child → Parent communication via callback props
  onMessage: (msg: unknown) => {
    addLog('info', `Child → Parent: ${JSON.stringify(msg)}`)
  },
  onNavigate: (target: string) => {
    addLog('info', `Child requested navigation to: ${target}`)
  },
  onOpenPurchaseLink: (url: string) => {
    addLog('info', `Child requested open purchase link: ${url}`)
    // Proxy to main process (child cannot call window.api directly)
    window.api?.openExternal(url)
  },
}

// ============================================================
// Helpers
// ============================================================
function addLog(type: string, text: string): void {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  logs.value.push({ type, text, time })
  // Keep last 100 entries
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(-100)
  }
}

const statusText = computed(() => {
  switch (status.value) {
    case 'idle': return 'Idle'
    case 'loading': return 'Loading...'
    case 'loaded': return 'Loaded ✓'
    case 'error': return 'Error ✗'
    default: return ''
  }
})

// ============================================================
// wujie lifecycle callbacks
// ============================================================
function onWujieMount(): void {
  status.value = 'loaded'
  addLog('success', `wujie mounted (${mode.value} mode) — child app rendered`)
}

function onWujieError(e: unknown): void {
  status.value = 'error'
  addLog('error', `wujie load error (${mode.value} mode): ${JSON.stringify(e)}`)
}

// ============================================================
// Mode switching
// ============================================================
async function switchMode(m: 'url' | 'html'): Promise<void> {
  if (mode.value === m && renderKey.value > 0) return
  mode.value = m
  status.value = 'loading'
  addLog('info', `Switched to ${m} mode`)

  if (m === 'html') {
    // Fetch HTML content via the custom protocol, then pass as string to wujie
    try {
      const resp = await fetch(protocolUrl)
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }
      htmlContent.value = await resp.text()
      addLog('success', `Fetched HTML via fetch() — ${htmlContent.value.length} bytes`)
    } catch (e) {
      addLog('error', `fetch() failed for ${protocolUrl}: ${e}`)
      status.value = 'error'
      return
    }
  }

  // Force re-render by incrementing key
  renderKey.value++
}

function reload(): void {
  addLog('info', 'Reloading wujie container...')
  status.value = 'loading'
  renderKey.value++
}

// ============================================================
// Init
// ============================================================
onMounted(async () => {
  addLog('info', 'App started. Loading test page via magiintro:// protocol...')

  // Check intro page status via IPC
  try {
    const result = await window.api?.getIntroPageStatus('test')
    if (result?.available) {
      addLog('success', `Intro page "test" available (version: ${result.version})`)
    } else {
      addLog('error', 'Intro page "test" not available — check resources/intro-pages/test/current')
    }
  } catch (e) {
    addLog('error', `IPC getIntroPageStatus failed: ${e}`)
  }

  // Start loading in URL mode
  status.value = 'loading'
  renderKey.value = 1
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a202c;
  color: #e2e8f0;
}

/* Header */
.header {
  padding: 14px 24px;
  background: #2d3748;
  border-bottom: 1px solid #4a5568;
}
.header h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}
.header p {
  font-size: 12px;
  color: #a0aec0;
}
.header code {
  background: #4a5568;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #63b3ed;
}

/* Controls */
.controls {
  padding: 10px 24px;
  background: #2d3748;
  border-bottom: 1px solid #4a5568;
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
}
.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.label {
  font-size: 12px;
  color: #a0aec0;
  font-weight: 500;
}
.controls button {
  padding: 4px 12px;
  background: #4a5568;
  color: #e2e8f0;
  border: 1px solid #718096;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.controls button:hover {
  background: #718096;
}
.controls button.active {
  background: #3182ce;
  border-color: #3182ce;
  color: white;
}
.reload-btn {
  margin-left: auto;
}
.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.url-display {
  background: #4a5568;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #63b3ed;
}
.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.status-idle { background: #4a5568; color: #a0aec0; }
.status-loading { background: #d69e2e; color: #1a202c; }
.status-loaded { background: #38a169; color: white; }
.status-error { background: #e53e3e; color: white; }

/* Wujie container */
.wujie-wrapper {
  flex: 1;
  overflow: auto;
  background: white;
  position: relative;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #a0aec0;
  font-size: 14px;
}

/* Log panel */
.log-panel {
  height: 160px;
  background: #2d3748;
  border-top: 1px solid #4a5568;
  display: flex;
  flex-direction: column;
}
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  border-bottom: 1px solid #4a5568;
}
.log-header h3 {
  font-size: 12px;
  color: #a0aec0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.clear-btn {
  padding: 2px 8px;
  background: transparent;
  color: #a0aec0;
  border: 1px solid #4a5568;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}
.clear-btn:hover {
  background: #4a5568;
}
.log-entries {
  flex: 1;
  overflow-y: auto;
  padding: 6px 16px;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.6;
}
.log-entry {
  padding: 1px 0;
}
.log-time {
  color: #718096;
  margin-right: 4px;
}
.log-entry.info { color: #90cdf4; }
.log-entry.success { color: #68d391; }
.log-entry.error { color: #fc8181; }
.log-empty {
  color: #718096;
  font-style: italic;
}
</style>
