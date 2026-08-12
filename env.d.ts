/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare global {
  // wujie event bus interface — callbacks are dynamically typed
  // (wujie's bus is untyped at runtime, so we use Function for flexibility)
  interface WujieEventBus {
    $on(event: string, cb: Function): void
    $off(event: string, cb?: Function): void
    $emit(event: string, ...args: unknown[]): void
    $onAll(cb: Function): void
    $offAll(cb: Function): void
    $clear(): void
  }

  interface Window {
    // wujie runtime object in child iframe
    $wujie?: {
      props?: Record<string, unknown>
      bus?: WujieEventBus
    }
    // wujie internal — injected into child iframe window
    __WUJIE?: {
      id: string
      name: string
      proxy: Window
      proxyLocation: unknown
      proxyDocument: unknown
      shadowRoot: ShadowRoot | null
      iframeOnEvents: string[]
    }
    __WUJIE_MOUNT?: () => void
    __WUJIE_UNMOUNT?: () => void
    // Exposed by preload.ts via contextBridge.exposeInMainWorld('api', ...)
    api?: {
      getIntroPageStatus(routeKey: string): Promise<{ available: boolean; version?: string }>
      listIntroPages(): Promise<{ routeKey: string; available: boolean }[]>
      openExternal(url: string): Promise<void>
    }
  }
}

export {}
