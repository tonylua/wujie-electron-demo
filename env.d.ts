/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// WujieVue is globally registered via app.use(WujieVue)
declare global {
  interface Window {
    // wujie runtime object. Only $wujie.bus is reliably present in the parent;
    // $wujie.props is injected inside the child iframe (not in the parent window).
    $wujie?: {
      props?: Record<string, unknown>
      bus?: {
        $on: (event: string, cb: Function) => void
        $emit: (event: string, ...args: unknown[]) => void
        $off?: (event: string, cb?: Function) => void
      }
    }
    // Exposed by preload.ts via contextBridge.exposeInMainWorld('api', ...).
    // contextBridge only injects this into the main renderer frame, not into
    // wujie child iframes (different execution contexts).
    api?: {
      getIntroPageStatus: (routeKey: string) => Promise<{ available: boolean; version?: string }>
      listIntroPages: () => Promise<{ routeKey: string; available: boolean }[]>
      openExternal: (url: string) => Promise<void>
    }
  }
}

export {}
