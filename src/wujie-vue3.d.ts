// Type declarations for wujie-vue3
// The package ships index.d.ts on disk but doesn't reference it in package.json,
// so TypeScript can't find the types automatically.

declare module 'wujie-vue3' {
  import type { DefineComponent, Plugin } from 'vue'
  import type { bus, preloadApp, destroyApp, setupApp } from 'wujie'

  const WujieVue: DefineComponent & Plugin & {
    bus: typeof bus
    setupApp: typeof setupApp
    preloadApp: typeof preloadApp
    destroyApp: typeof destroyApp
  }

  export default WujieVue
}
