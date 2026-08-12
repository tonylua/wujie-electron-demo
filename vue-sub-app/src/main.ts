/**
 * main.ts — Vue 子应用入口
 * 验证：window.$wujie.props 在 app.mount() 前是否已注入（时序风险 A）
 */
import { createApp, type App } from 'vue'
import App from './App.vue'
import { provideIntroBridge } from './useIntroBridge'

let app: App | null = null

function mount(): void {
  app = createApp(App)
  const bridge = provideIntroBridge(app)
  app.mount('#app')
  bridge.onMessage({ type: 'vue-boot', hasProps: !!bridge.shopItem, keys: Object.keys(bridge) })
}

function unmount(): void {
  app?.unmount()
  app = null
}

if (window.__POWERED_BY_WUJIE__) {
  window.__WUJIE_MOUNT = mount
  window.__WUJIE_UNMOUNT = unmount
} else {
  mount()
}
