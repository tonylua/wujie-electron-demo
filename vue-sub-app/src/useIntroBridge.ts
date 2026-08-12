/**
 * useIntroBridge — wujie props → Vue provide/inject 桥接 composable
 *
 * 验证 TODO.md 第 1 项：Vue SFC 的 provide/inject 能否在 wujie iframe sandbox 内正常工作。
 * main.ts 调用 provideIntroBridge(app) 将 wujie props 注入 Vue provide 树，
 * 子组件通过 useIntroBridge() inject 获取。
 */
import { inject, type App } from 'vue'

export interface IntroBridge {
  shopItem: { name: string; purchaseLink: string }
  locale: string
  isDark: boolean
  onOpenPurchaseLink: (url: string) => void
  onMessage: (msg: unknown) => void
}

const BRIDGE_KEY = Symbol('introBridge')

/** 在 main.ts 中调用：从 window.$wujie.props 读取并通过 app.provide 注入 */
export function provideIntroBridge(app: App): IntroBridge {
  const props = (window.$wujie?.props ?? {}) as Record<string, unknown>
  const bridge: IntroBridge = {
    shopItem: (props.shopItem as IntroBridge['shopItem']) ?? { name: 'MISSING', purchaseLink: '' },
    locale: (props.locale as string) ?? 'N/A',
    isDark: (props.isDark as boolean) ?? false,
    onOpenPurchaseLink: (props.onOpenPurchaseLink as (url: string) => void) ?? (() => {}),
    onMessage: (props.onMessage as (msg: unknown) => void) ?? (() => {}),
  }
  app.provide(BRIDGE_KEY, bridge)
  return bridge
}

/** 在子组件中调用：inject 获取桥接数据 */
export function useIntroBridge(): IntroBridge | undefined {
  return inject<IntroBridge>(BRIDGE_KEY)
}
