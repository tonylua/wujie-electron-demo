# Demo 待增加验证清单

基于设计文档 `docs/dynamic-intro-pages-design.md`，当前 demo 已验证协议加载、parent shield 隔离、基础 props 通信。以下为**尚未验证但文档声称支持**的关键风险点，按优先级排序。

---

## ✅ 已验证

- [x] `magiintro://` 协议加载 HTML + 外链资源（CSS/JS/SVG）
- [x] wujie `jsBeforeLoaders` parent shield：`window.parent.api` 被阻断为 `undefined`
- [x] 基础 props 通信：父 → 子（`routeKey`/`message`），子 → 父（`onMessage` 回调）
- [x] 资源加载验证：JS 执行（counter）、CSS 应用、图片加载

---

## 🚧 待增加验证

### 1. 【优先级：高】真实 Vue 组件迁移的 provide/inject 模式

**背景**：文档 §8.3 要求将现有 `Hud.vue`/`Lte.vue` 从"主应用 inject/useShop/window.api"改为"wujie props → 子应用 provide/inject"。当前 demo 的 `app.js` 是素的 JS 直接读 `window.$wujie.props`，**未验证 Vue SFC 的 provide/inject 在 wujie iframe sandbox 内是否正常工作**。

**风险点**：
- **A. 时序风险**：`main.ts` 执行时（`app.mount()` 前）`window.$wujie.props` 是否已注入？若未注入，provide 的值为 `undefined`，全部 inject 失败
- **B. sandbox 兼容性**：iframe 内独立 Vue 实例的 provide/inject 能否正常传播？wujie 的 Proxy 是否干扰 Vue reactivity？
- **C. callback 往返**：子组件 `inject('onOpenPurchaseLink')(url)` → 父函数 → `window.api.openExternal`，callback 引用能否跨 props 桥梁执行？

**实施方案**：
在 `resources/intro-pages/test/` 新增 Vue 版本目录 `1.0.1-vue00001/`（不迁移完整 Hud.vue，只验证模式）：

```
intro-vue-src/             # demo 外单独管理（避免污染 demo package.json）
├── vite.config.ts         # base: './', outDir → ../resources/.../1.0.1-vue00001
├── index.html
└── src/
    ├── main.ts            # window.$wujie.props → app.provide()
    ├── App.vue            # inject('shopItem') 并显示
    └── components/PurchasePanel.vue  # inject('onOpenPurchaseLink') 并调用
```

**main.ts**（核心移行ブリッジ）:
```ts
import { createApp } from 'vue'
import App from './App.vue'

const props = (window as any).$wujie?.props ?? {}
const app = createApp(App)
app.provide('shopItem', props.shopItem)
app.provide('locale', props.locale)
app.provide('onOpenPurchaseLink', props.onOpenPurchaseLink)  // callback 桥梁
app.mount('#app')

// 向父报告 boot 状态（验证信号）
props.onMessage?.({ type: 'vue-boot', hasProps: !!props.shopItem, keys: Object.keys(props) })
```

**App.vue**:
```vue
<script setup lang="ts">
import { inject } from 'vue'
import PurchasePanel from './components/PurchasePanel.vue'
const shopItem = inject<any>('shopItem')
const locale = inject<string>('locale')
</script>
<template>
  <h2>Vue SFC Migration Pattern Verification</h2>
  <p>shopItem.name: <b>{{ shopItem?.name ?? 'MISSING' }}</b></p>
  <p>locale: <b>{{ locale ?? 'MISSING' }}</b></p>
  <PurchasePanel />
</template>
```

**PurchasePanel.vue**（验证 callback 往返）:
```vue
<script setup lang="ts">
import { inject } from 'vue'
const shopItem = inject<any>('shopItem')
const onOpenPurchaseLink = inject<(u: string) => void>('onOpenPurchaseLink')
function buy() {
  onOpenPurchaseLink?.(shopItem?.purchaseLink ?? 'https://example.com/fallback')
}
</script>
<template><button @click="buy">Buy (via injected callback)</button></template>
```

**demo 父 `src/App.vue` 修改**（补充子应用期望的 props）:
```ts
const wujieProps = {
  routeKey: 'test',
  message: 'Hello from parent!',
  shopItem: { name: 'MagicPen', purchaseLink: 'https://example.com/buy-magicpen' },
  locale: 'zh_CN',
  isDark: false,
  onOpenPurchaseLink: (url: string) => {
    addLog('info', `子→父: 请求打开购买链接 ${url}`)
    window.api?.openExternal(url)
  },
  onMessage: (msg: unknown) => addLog('info', `子→父: ${JSON.stringify(msg)}`),
}
```

**验证步骤**：
1. 构建 Vue 子应用 → 输出到 `resources/intro-pages/test/1.0.1-vue00001/`
2. 修改 `test/current` 为 `1.0.1-vue00001`
3. 启动 demo，观察：
   - ✅ Log 显示 `vue-boot hasProps:true keys:[shopItem,locale,...]` → **时序 OK**
   - ✅ UI 显示 `shopItem.name: MagicPen`（非 `MISSING`）→ **provide/inject 贯通**
   - ✅ 点击"Buy"按钮 → Log 显示购买链接 + 浏览器打开 → **callback 往返 OK**

**派生发现**（可能在验证中暴露）：
- wujie props 是**挂载时快照**，实行时の変更（如主题切换/语言切换）不会自动同步到子应用。如需响应式同步，需引入 `window.$wujie.bus`（事件总线）或定期轮询。真实 intro pages 需要 `isDark`/`locale` 响应式，此验证可暴露这一设计缺口。

**克制边界**：
- ❌ 不迁移 Hud.vue 的视频播放/轮播/滚动监听（超出验证范围）
- ✅ 仅验证 provide/inject + callback prop 的**移行模式**（3 文件 ~80 行）

---

### 2. 【优先级：中】多文件依赖链的相对路径解析

**背景**：文档声称支持 Vue/React 构建产物的**复杂依赖链**（如 `index.html` → `assets/main.js` → 动态 `import('./chunks/vendor.js')`）。当前 demo 仅测试了**一层相对路径**（`index.html` → `./assets/style.css`），未验证深层嵌套与动态 import 是否正确解析 base URL。

**风险点**：
- 动态 `import()` 在 iframe 内解析 base 时，`magiintro://` 协议的 `standard: true` 配置是否生效？
- CSS 内的 `@import './fonts/custom.css'` 能否正确解析？
- 上级目录 `..` 路径（如 `<img src="../shared/logo.png">`）是否正确？

**实施方案**：
在 `resources/intro-pages/test/1.0.0-abcd1234/` 新增测试文件：

```
assets/
  app.js                        # 已有
  dynamic-loader.js             # 新增：动态 import
  chunks/
    lazy-check.js               # 被动态加载的模块
  fonts/
    custom.css                  # 被 @import 引用
shared/                         # 新增：上级目录测试
  shared-logo.svg
```

**dynamic-loader.js**:
```js
// 在 assets/app.js 末尾添加：
import('./chunks/lazy-check.js').then(m => {
  document.getElementById('check-dynamic-import').classList.add('ok')
  document.getElementById('check-dynamic-import').textContent = '✓ Dynamic import loaded'
}).catch(e => {
  console.error('Dynamic import failed:', e)
  document.getElementById('check-dynamic-import').textContent = '✗ Dynamic import failed'
})
```

**chunks/lazy-check.js**:
```js
export default { loaded: true }
```

**assets/style.css 顶部添加**:
```css
@import './fonts/custom.css';
```

**fonts/custom.css**:
```css
.custom-font-test { font-family: 'Test', sans-serif; color: green; }
```

**index.html 添加**:
```html
<div class="check" id="check-dynamic-import">Dynamic import loading...</div>
<div class="check" id="check-css-import">CSS @import loaded</div>
<img src="../shared/shared-logo.svg" alt="Shared" class="shared-logo" id="shared-img" />
<div class="check" id="check-parent-path">Parent path (..) loaded</div>
```

**app.js 添加**:
```js
// CSS @import 检查（依赖 custom.css 中的类存在）
setTimeout(() => {
  const el = document.getElementById('check-css-import')
  const testDiv = document.createElement('div')
  testDiv.className = 'custom-font-test'
  document.body.appendChild(testDiv)
  const color = getComputedStyle(testDiv).color
  if (color === 'rgb(0, 128, 0)') {  // green
    el.classList.add('ok')
    el.textContent = '✓ CSS @import loaded'
  }
  testDiv.remove()
}, 500)

// 上级目录图片检查
document.getElementById('shared-img').onload = () => {
  const el = document.getElementById('check-parent-path')
  el.classList.add('ok')
  el.textContent = '✓ Parent path (..) loaded'
}
```

**验证步骤**：
1. 添加上述文件到 demo
2. 重启 demo，观察 5 个新检查项是否全部绿色 ✓
3. DevTools Network 确认：
   - `magiintro://test/assets/chunks/lazy-check.js` → 200
   - `magiintro://test/assets/fonts/custom.css` → 200
   - `magiintro://test/shared/shared-logo.svg` → 200

**通过标准**：全部 5 个检查项显示绿色 ✓，无 404 错误

**克制边界**：
- ❌ 不测试整个 Vite 构建链的所有边界情况
- ✅ 仅验证 **3 种典型相对路径场景**（动态 import / CSS @import / 上级目录 `..`）

---

### 3. 【优先级：低】版本目录切换的原子性与 wujie 缓存交互

**背景**：文档 §3.4.6 声称"就地原子替换（删旧 + rename），当前会话已渲染的页面实例靠 wujie 缓存续用（不闪烁），重新进入时读到新版"。当前 demo 使用 **`current` 指针文件**，与文档的 **semver 目录扫描 `findLatestVersionDir()`** 不一致。

**风险点**：
- 协议 handler 改为扫描 `<routeKey>-<version>-<hash8>` 目录名后，是否仍能正确定位最新版本？
- 模拟更新（删旧目录 + 添加新目录）时，当前已渲染的 wujie 实例是否仍可交互（缓存续用）？
- Reload 后是否自动读取新版本？

**实施方案**：
1. **修改 `electron/main.ts` 协议 handler**：
   ```ts
   // 移除读 current 指针的逻辑（L103-112）
   // 改为调用 findLatestVersionDir()
   function findLatestVersionDir(baseDir: string, prefix: string): string | null {
     const entries = fs.readdirSync(baseDir, { withFileTypes: true })
     const versionDirs = entries
       .filter(e => e.isDirectory() && e.name.startsWith(prefix + '-'))
       .map(e => {
         const match = e.name.match(/^[\w-]+-(\d+\.\d+\.\d+)-[a-f0-9]{8}$/i)
         return match ? { name: e.name, version: match[1] } : null
       })
       .filter(Boolean)
     
     if (!versionDirs.length) return null
     
     // 简易版本比较（生产应用应用 semver 库）
     versionDirs.sort((a, b) => {
       const [aMajor, aMinor, aPatch] = a.version.split('.').map(Number)
       const [bMajor, bMinor, bPatch] = b.version.split('.').map(Number)
       return (bMajor - aMajor) || (bMinor - aMinor) || (bPatch - aPatch)
     })
     
     return versionDirs[0].name
   }
   
   // 在 protocol.handle 中使用：
   const versionDirName = findLatestVersionDir(routeDir, routeKey)
   if (!versionDirName) {
     return new Response(`No version directory found for ${routeKey}`, { status: 404 })
   }
   const versionDir = path.join(routeDir, versionDirName)
   ```

2. **重命名测试目录**：
   ```bash
   cd resources/intro-pages/test/
   mv 1.0.0-abcd1234 test-1.0.0-abcd1234
   rm current  # 不再需要指针文件
   ```

3. **模拟版本更新**（手动操作，验证 wujie 缓存行为）：
   - Step 1: 启动 demo，加载 `test-1.0.0-abcd1234`，counter 开始计数
   - Step 2: 不关闭 demo，在文件系统中：
     - 复制 `test-1.0.0-abcd1234` → `test-1.0.1-newHash`
     - 修改新版本的 `index.html` title 为 "v1.0.1"
     - 删除 `test-1.0.0-abcd1234` 目录（模拟原子替换）
   - Step 3: 在 demo 中**不刷新**，验证：
     - ✅ counter 仍在运行（wujie 缓存的旧实例未崩溃）
     - ✅ 点击"Send message"按钮仍能触发父 log（旧实例仍可交互）
   - Step 4: 点击"Reload"按钮，验证：
     - ✅ title 变为 "v1.0.1"（读到新版本）
     - ✅ DevTools Network 显示请求路径为 `magiintro://test/...`（协议正常）

**通过标准**：
- 协议 handler 成功定位最新版本目录（无需 `current` 文件）
- 旧版本被删除后，已缓存的 wujie 实例仍可交互（不崩溃）
- Reload 后自动读取新版本内容

**克制边界**：
- ❌ 不实现完整的下载/解压/DB 写入流程（属于 `introPages.ts` 职责）
- ✅ 仅验证 **协议层的版本扫描逻辑** + **wujie 缓存行为**（通过手动文件操作模拟）

---

### 4. 【优先级：低】关键文件 MD5 防篡改的加载前校验

**背景**：文档第六节声称"wujie 加载前重新计算 MD5 比对，不匹配拒绝渲染"。当前 demo **未实现任何 MD5 校验**，直接从协议读文件。真实场景中，MD5 校验应在 **IPC `intro-page-get-status`** 返回 `available` 前执行。

**风险点**：
- 关键文件（`.html`/`.js`/`.css`）被篡改后，能否被检测并拒绝加载？
- 校验失败后，UI 是否正确降级为"不可用"状态？

**实施方案**：
1. **生成 MD5 manifest**（模拟解压时的组合 MD5 计算）：
   ```bash
   cd resources/intro-pages/test/test-1.0.0-abcd1234/
   # 手动计算并创建 .md5-manifest.json（生产应自动）
   {
     "combinedMD5": "abc123def456...",  // 所有 .html/.js/.css 的联合哈希
     "files": [
       "index.html",
       "assets/app.js",
       "assets/style.css"
     ]
   }
   ```

2. **修改 `electron/main.ts` IPC handler**：
   ```ts
   ipcMain.handle('intro-page-get-status', (_event, routeKey: string) => {
     const introPagesRoot = getIntroPagesRoot()
     const routeDir = path.join(introPagesRoot, routeKey)
     const versionDirName = findLatestVersionDir(routeDir, routeKey)
     if (!versionDirName) return { available: false }
     
     const versionDir = path.join(routeDir, versionDirName)
     
     // 读取 manifest
     const manifestPath = path.join(versionDir, '.md5-manifest.json')
     let manifest
     try {
       manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
     } catch {
       return { available: false, reason: 'missing-manifest' }
     }
     
     // 重新计算组合 MD5
     const crypto = require('crypto')
     const hash = crypto.createHash('md5')
     for (const file of manifest.files) {
       const content = fs.readFileSync(path.join(versionDir, file))
       hash.update(content)
     }
     const calculated = hash.digest('hex')
     
     // 比对
     if (calculated !== manifest.combinedMD5) {
       console.error(`[MD5] Integrity check failed for ${routeKey}: expected ${manifest.combinedMD5}, got ${calculated}`)
       return { available: false, reason: 'integrity-check-failed' }
     }
     
     // 校验通过
     const indexExists = fs.existsSync(path.join(versionDir, 'index.html'))
     return { available: indexExists, version: versionDirName }
   })
   ```

3. **验证步骤**：
   - Step 1: 启动 demo，正常加载（MD5 校验通过）
   - Step 2: 篡改 `test-1.0.0-abcd1234/assets/app.js`（如修改 counter 自增为 `counter += 10`）
   - Step 3: 重启 demo 或切换路由，观察：
     - ✅ Console 显示 `[MD5] Integrity check failed`
     - ✅ UI 显示"Intro page not available"（`available: false`）
     - ✅ wujie 容器未渲染（因 `available: false` 被拦截）

**通过标准**：
- 篡改前正常加载
- 篡改后校验失败，返回 `available: false`
- UI 正确降级为不可用状态，无崩溃

**克制边界**：
- ❌ 不集成 Windows 凭据管理器（demo 用 `.md5-manifest.json` 文件替代）
- ✅ 仅验证 **校验失败时的拒绝逻辑**（IPC 返回 `available: false` → 容器不渲染）

---

## 📝 验证优先级总结

| # | 验证项 | 优先级 | 原因 |
|---|--------|--------|------|
| 1 | Vue provide/inject 迁移模式 | **高** | 直接影响 Hud.vue/Lte.vue 迁移可行性，文档核心声称 |
| 2 | 多文件依赖链相对路径 | 中 | Vue/React 构建产物依赖此特性，现有 demo 覆盖不足 |
| 3 | 版本切换 + wujie 缓存 | 低 | 文档已明确机制，demo 偏差（current 指针）需修正但非阻塞 |
| 4 | MD5 防篡改校验 | 低 | 安全特性，非功能阻塞；手动测试即可验证 |

**建议实施顺序**：1 → 2 → (3, 4 任选或跳过)

总代码增量预计 **< 150 行**（Vue 迁移 ~70 行 + 相对路径测试 ~30 行 + 版本扫描改造 ~30 行 + MD5 校验 ~20 行）。
