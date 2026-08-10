/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// WujieVue is globally registered via app.use(WujieVue)
declare global {
  interface Window {
    $wujie: {
      props: Record<string, unknown>
      bus: { $on: (event: string, cb: Function) => void; $emit: (event: string, ...args: unknown[]) => void }
    }
    // Exposed by preload.ts via contextBridge.exposeInMainWorld('api', ...)
    api: {
      getIntroPageStatus: (routeKey: string) => Promise<{ available: boolean; version?: string }>
      openExternal: (url: string) => Promise<void>
    }
  }
}
