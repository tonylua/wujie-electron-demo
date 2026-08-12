<template>
  <div class="app">
    <header class="header">
      <h1>{{ headerTitle }}</h1>
      <p>
        {{ headerSubtitle }}
        <code>magiintro://</code>
      </p>
    </header>

    <div class="controls">
      <div class="control-group">
        <span class="label">{{ t('page') }}:</span>
        <button
          v-for="page in availablePages"
          :key="page.routeKey"
          :class="{ active: routeKey === page.routeKey, disabled: !page.available }"
          :disabled="!page.available"
          @click="switchRouteKey(page.routeKey)"
        >
          {{ page.routeKey }}
          <span v-if="!page.available" class="na-tag">N/A</span>
        </button>
      </div>

      <div class="control-group">
        <span class="label">Theme:</span>
        <button :class="{ active: isDark }" @click="toggleTheme">{{ isDark ? '🌙' : '☀️' }}</button>
      </div>

      <div class="control-group">
        <span class="label">{{ t('locale') }}:</span>
        <button :class="{ active: locale === 'zh_CN' }" @click="locale = 'zh_CN'">中文</button>
        <button :class="{ active: locale === 'en_US' }" @click="locale = 'en_US'">EN</button>
      </div>

      <div class="status-item">
        <span class="label">{{ t('status') }}:</span>
        <span :class="['status-badge', `status-${status}`]">{{ statusText }}</span>
      </div>
      <button class="reload-btn" @click="reload">↻</button>
    </div>

    <div v-if="busEvents.length > 0" class="bus-panel">
      <span class="label">Bus:</span>
      <span v-for="(evt, i) in busEvents" :key="i" class="bus-event">{{ evt }}</span>
    </div>

    <div class="wujie-wrapper" :style="{ '--theme-bg': isDark ? '#0f172a' : '#ffffff' }">
      <WujieVue
        v-if="renderKey > 0 && routeKey"
        :key="`${routeKey}-${renderKey}`"
        :name="routeKey"
        :url="`magiintro://${routeKey}/index.html`"
        :props="wujieProps"
        :plugins="wujiePlugins"
        :beforeLoad="onWujieBeforeLoad"
        :beforeMount="onWujieBeforeMount"
        :afterMount="onWujieMount"
        :loadError="onWujieError"
        :sync="true"
        :fiber="false"
      />

      <div v-else class="placeholder">
        <p>{{ status === 'idle' ? t('selectPage') : 'Loading...' }}</p>
      </div>
    </div>

    <div class="log-panel">
      <div class="log-header">
        <h3>Message Log</h3>
        <div class="log-actions">
          <button class="clear-btn" @click="logs = []">Clear</button>
        </div>
      </div>
      <div class="log-entries">
        <div v-for="(entry, i) in logs" :key="i" :class="['log-entry', entry.type]">
          <span class="log-time">[{{ entry.time }}]</span>
          {{ entry.text }}
        </div>
        <div v-if="logs.length === 0" class="log-empty">No messages yet</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import WujieVue from 'wujie-vue3'

// In the PARENT app, the bus is accessed via WujieVue.bus (not window.$wujie,
// which is only set inside the child iframe's context).
const wujieBus: WujieEventBus = WujieVue.bus

interface IntroPageInfo {
  routeKey: string
  available: boolean
}

const routeKey = ref<string>('test')
const status = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
const renderKey = ref(0)
const logs = ref<{ type: string; text: string; time: string }[]>([])

const isDark = ref(false)
const locale = ref<'zh_CN' | 'en_US'>('zh_CN')
const busEvents = ref<string[]>([])

const availablePages = ref<IntroPageInfo[]>([])
const mountedBusListeners = ref<{ event: string; cb: Function }[]>([])

const PRODUCT_INFO: Record<string, any> = {
  test: { name: 'Test Page' },
  alpha: { name: 'Alpha Module' },
}

// Simple i18n for parent UI
const i18n = {
  zh_CN: {
    title: 'Wujie + Electron 自定义协议 Demo',
    subtitle: '验证 wujie 通过 magiintro:// 协议加载本地 HTML',
    page: '页面',
    locale: '语言',
    status: '状态',
    selectPage: '选择一个页面加载',
  },
  en_US: {
    title: 'Wujie + Electron Custom Protocol Demo',
    subtitle: 'Verifying wujie loads local HTML via magiintro:// protocol',
    page: 'Page',
    locale: 'Locale',
    status: 'Status',
    selectPage: 'Select a page to load',
  },
}

function t(key: keyof typeof i18n.zh_CN): string {
  return i18n[locale.value][key]
}

const headerTitle = computed(() => t('title'))
const headerSubtitle = computed(() => t('subtitle'))

const wujiePlugins = [{
  // Runs right after iframe window is created — before any scripts execute.
  // 1) Defines lifecycle hooks for plain HTML pages (no framework).
  // 2) Sandbox isolation: wujie's Proxy only intercepts self/window, NOT
  //    parent/top. We override them here so child pages can't access
  //    the parent window's API (e.g. window.parent.api).
  windowPropertyOverride: (iframeWindow: Window) => {
    // --- lifecycle hooks ---
    if (typeof iframeWindow.__WUJIE_MOUNT !== 'function') {
      iframeWindow.__WUJIE_MOUNT = function () {}
    }
    if (typeof iframeWindow.__WUJIE_UNMOUNT !== 'function') {
      iframeWindow.__WUJIE_UNMOUNT = function () {}
    }

    // --- sandbox isolation for parent/top ---
    // Use Object.defineProperty (not assignment) to override the native
    // getter-only properties. configurable:true allows wujie's internal
    // patchWindowEffect to still process these later.
    try {
      Object.defineProperty(iframeWindow, 'parent', {
        get: function () { return iframeWindow },
        configurable: true,
      })
    } catch {}
    try {
      Object.defineProperty(iframeWindow, 'top', {
        get: function () { return iframeWindow },
        configurable: true,
      })
    } catch {}
  },
}]

const wujieProps = computed(() => ({
  productInfo: PRODUCT_INFO[routeKey.value] || null,
  locale: locale.value,
  isDark: isDark.value,
  onMessage: (msg: unknown) => {
    const m = msg as { type?: string; text?: string; routeKey?: string }
    addLog('info', `Child → Parent: ${JSON.stringify(msg)}`)
    if (m?.type === 'ready') {
      addLog('success', `Intro page ready: ${m.routeKey}`)
    }
  },
  onOpenPurchaseLink: (url: string) => {
    addLog('info', `Child requested open: ${url}`)
    if (window.api?.openExternal) {
      window.api.openExternal(url)
    }
  },
  onNavigate: (target: string) => {
    addLog('info', `Child requested navigation: ${target}`)
  },
  bus: undefined as any,
}))

function addLog(type: string, text: string): void {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  logs.value.push({ type, text, time })
  if (logs.value.length > 200) logs.value = logs.value.slice(-200)
}

function addBusEvent(event: string): void {
  busEvents.value.push(event)
  if (busEvents.value.length > 50) busEvents.value = busEvents.value.slice(-50)
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

async function refreshPages(): Promise<void> {
  try {
    const pages = await window.api?.listIntroPages()
    if (pages && pages.length > 0) {
      availablePages.value = pages.map(p => ({ routeKey: p.routeKey, available: p.available }))
      addLog('success', `Loaded ${pages.filter(p => p.available).length} pages`)
    }
  } catch (e) {
    addLog('error', `listIntroPages failed: ${e}`)
    availablePages.value = Object.keys(PRODUCT_INFO).map(key => ({ routeKey: key, available: true }))
  }
}

function toggleTheme(): void {
  isDark.value = !isDark.value
  addBusEvent(`theme-change: isDark=${isDark.value}`)
  wujieBus.$emit('theme-change', { isDark: isDark.value })
}

watch(locale, (newLocale) => {
  addBusEvent(`locale-change: ${newLocale}`)
  wujieBus.$emit('locale-change', { locale: newLocale })
})

async function switchRouteKey(newKey: string): Promise<void> {
  if (routeKey.value === newKey && renderKey.value > 0) return
  // Destroy old wujie instance — wujie caches by name, and reusing a cached
  // instance skips script re-execution, leaving the page in a stale state.
  if (routeKey.value) {
    try { WujieVue.destroyApp(routeKey.value) } catch {}
  }
  routeKey.value = newKey
  status.value = 'loading'
  addLog('info', `Switching to "${newKey}"`)
  renderKey.value++
}

function reload(): void {
  addLog('info', 'Reloading...')
  if (routeKey.value) {
    try { WujieVue.destroyApp(routeKey.value) } catch {}
  }
  status.value = 'loading'
  renderKey.value++
}

function cleanupMountedBusListeners(): void {
  if (wujieBus) {
    for (const l of mountedBusListeners.value) {
      try { wujieBus.$off(l.event, l.cb) } catch {}
    }
  }
  mountedBusListeners.value = []
}

function onWujieBeforeLoad(): void {
  addLog('info', `[lifecycle] beforeLoad: ${routeKey.value}`)
}

function onWujieBeforeMount(): void {
  addLog('info', `[lifecycle] beforeMount: ${routeKey.value}`)
}

function onWujieMount(): void {
  status.value = 'loaded'
  addLog('success', `[lifecycle] afterMount: ${routeKey.value}`)

  nextTick(() => {
    cleanupMountedBusListeners()
    if (!wujieBus) return

    const themeCb = (payload: { isDark: boolean }) => {
      isDark.value = payload.isDark
      addBusEvent(`child-theme-change: isDark=${payload.isDark}`)
    }
    const localeCb = (payload: { locale: string }) => {
      if (payload.locale === 'zh_CN' || payload.locale === 'en_US') {
        locale.value = payload.locale
        addBusEvent(`child-locale-change: ${payload.locale}`)
      }
    }
    const productCb = (payload: { productInfo: any }) => {
      addBusEvent(`child-product-update: ${JSON.stringify(payload.productInfo?.name)}`)
    }

    wujieBus.$on('theme-change', themeCb)
    wujieBus.$on('locale-change', localeCb)
    wujieBus.$on('product-info-update', productCb)
    mountedBusListeners.value = [
      { event: 'theme-change', cb: themeCb },
      { event: 'locale-change', cb: localeCb },
      { event: 'product-info-update', cb: productCb },
    ]
  })
}

onBeforeUnmount(() => {
  cleanupMountedBusListeners()
})

function onWujieError(e: unknown): void {
  status.value = 'error'
  addLog('error', `wujie load error: ${JSON.stringify(e)}`)
}

async function preloadAvailablePages(): Promise<void> {
  const wujieModule = await import('wujie')
  const wujie = (wujieModule as any)?.default || wujieModule
  const pages = await window.api?.listIntroPages()
  if (!pages) return

  for (const page of pages) {
    if (!page.available) continue
    try {
      wujie.preloadApp({
        name: page.routeKey,
        url: `magiintro://${page.routeKey}/index.html`,
        exec: true,
        fiber: true,
      })
      addLog('info', `Preloaded: ${page.routeKey}`)
    } catch {
      // non-critical
    }
  }
}

onMounted(async () => {
  addLog('info', '=== Wujie Demo ===')

  // Intercept console.log/error/warn to capture wujie's internal errors
  // (WujieVue's startApp try/catch logs errors to console but doesn't call loadError)
  const origLog = console.log.bind(console)
  const origError = console.error.bind(console)
  const origWarn = console.warn.bind(console)
  console.log = (...args: unknown[]) => {
    origLog(...args)
    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    if (text.toLowerCase().includes('wujie') || text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
      addLog('error', `[console.log] ${text}`)
    }
  }
  console.error = (...args: unknown[]) => {
    origError(...args)
    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    addLog('error', `[console.error] ${text}`)
  }
  console.warn = (...args: unknown[]) => {
    origWarn(...args)
    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    if (text.toLowerCase().includes('wujie') || text.toLowerCase().includes('deprecat')) {
      addLog('info', `[console.warn] ${text}`)
    }
  }

  // Capture all errors to UI
  window.addEventListener('error', (e) => {
    addLog('error', `[window.error] ${e.message} @ ${e.filename}:${e.lineno}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    addLog('error', `[unhandledrejection] ${e.reason}`)
  })

  await refreshPages()

  try {
    const result = await window.api?.getIntroPageStatus(routeKey.value)
    if (result?.available) {
      addLog('success', `Intro page "${routeKey.value}" available`)
    } else {
      addLog('error', `Intro page "${routeKey.value}" not available`)
    }
  } catch (e) {
    addLog('error', `getIntroPageStatus failed: ${e}`)
  }

  status.value = 'loading'
  renderKey.value = 1

  // Fallback: if afterMount doesn't fire within 5s, mark as error
  setTimeout(() => {
    if (status.value === 'loading') {
      addLog('error', '[timeout] afterMount did not fire — wujie lifecycle callback missing')
      status.value = 'error'
    }
  }, 5000)
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
.app { display: flex; flex-direction: column; height: 100vh; background: #1a202c; color: #e2e8f0; }

.header { padding: 14px 24px; background: #2d3748; border-bottom: 1px solid #4a5568; }
.header h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.header p { font-size: 12px; color: #a0aec0; }
.header code { background: #4a5568; padding: 2px 6px; border-radius: 3px; font-size: 12px; color: #63b3ed; }

.controls { padding: 10px 24px; background: #2d3748; border-bottom: 1px solid #4a5568; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.control-group { display: flex; align-items: center; gap: 6px; }
.label { font-size: 12px; color: #a0aec0; font-weight: 500; }
.controls button { padding: 4px 12px; background: #4a5568; color: #e2e8f0; border: 1px solid #718096; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.15s; }
.controls button:hover:not(:disabled) { background: #718096; }
.controls button.active { background: #3182ce; border-color: #3182ce; color: white; }
.controls button:disabled { opacity: 0.4; cursor: not-allowed; }
.na-tag { color: #fc8181; font-size: 10px; margin-left: 4px; }

.status-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.status-idle { background: #4a5568; color: #a0aec0; }
.status-loading { background: #d69e2e; color: #1a202c; }
.status-loaded { background: #38a169; color: white; }
.status-error { background: #e53e3e; color: white; }
.reload-btn { margin-left: auto; font-size: 16px !important; padding: 4px 10px !important; }

.bus-panel { padding: 6px 24px; background: #1a365d; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 11px; }
.bus-panel .label { color: #90cdf4; }
.bus-event { background: #2c5282; color: #bee3f8; padding: 2px 8px; border-radius: 3px; }

.wujie-wrapper { flex: 1; overflow: auto; background: var(--theme-bg, #ffffff); position: relative; }
.placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: #a0aec0; font-size: 14px; }

.log-panel { height: 180px; background: #2d3748; border-top: 1px solid #4a5568; display: flex; flex-direction: column; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 16px; border-bottom: 1px solid #4a5568; }
.log-header h3 { font-size: 12px; color: #a0aec0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.log-actions { display: flex; gap: 8px; }
.clear-btn { padding: 2px 8px; background: transparent; color: #a0aec0; border: 1px solid #4a5568; border-radius: 3px; cursor: pointer; font-size: 11px; }
.clear-btn:hover { background: #4a5568; }
.log-entries { flex: 1; overflow-y: auto; padding: 6px 16px; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 11px; line-height: 1.6; }
.log-time { color: #718096; margin-right: 4px; }
.log-entry.info { color: #90cdf4; }
.log-entry.success { color: #68d391; }
.log-entry.error { color: #fc8181; }
.log-empty { color: #718096; font-style: italic; }
</style>
