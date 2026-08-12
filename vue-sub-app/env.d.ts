/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare global {
  interface Window {
    $wujie?: {
      props?: Record<string, unknown>
      bus?: { $on: Function; $off: Function; $emit: Function }
    }
    __POWERED_BY_WUJIE__?: boolean
    __WUJIE_MOUNT?: () => void
    __WUJIE_UNMOUNT?: () => void
  }
}

export {}
