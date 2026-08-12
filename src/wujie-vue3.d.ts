// Type declarations for wujie-vue3
// The package ships index.d.ts on disk but doesn't reference it in package.json,
// so TypeScript can't find the types automatically.

declare module 'wujie-vue3' {
  import type { DefineComponent, Plugin } from 'vue'

  interface WujieVueComponent extends DefineComponent {
    name?: string
    url?: string
    props?: Record<string, unknown>
    plugins?: unknown[]
    beforeLoad?: () => void
    beforeMount?: () => void
    afterMount?: () => void
    loadError?: (e: unknown) => void
    sync?: boolean
    fiber?: boolean
    [key: string]: unknown
  }

  const WujieVue: WujieVueComponent & Plugin & {
    bus: import('wujie').bus
    setupApp: import('wujie').setupApp
    preloadApp: import('wujie').preloadApp
    destroyApp: import('wujie').destroyApp
  }

  export default WujieVue
}

// Also declare the wujie module types for the dynamic import in App.vue
declare module 'wujie' {
  export interface bus {
    $on(event: string, cb: (...args: unknown[]) => void): void
    $off(event: string, cb?: (...args: unknown[]) => void): void
    $emit(event: string, ...args: unknown[]): void
    $onAll(cb: (event: string, ...args: unknown[]) => void): void
    $offAll(cb: (event: string, ...args: unknown[]) => void): void
    $clear(): void
  }
  export function preloadApp(options: Record<string, unknown>): void
  export function destroyApp(name: string): void
  export function setupApp(options: Record<string, unknown>): void
}
