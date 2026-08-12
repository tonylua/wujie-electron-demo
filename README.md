# wujie-electron-protocal-demo

验证 wujie 微前端框架加载 Electron 自定义协议（`magiintro://`）指向的本地 HTML 资源的 Demo。

## 快速启动

```bash
npm install   # 首次
npm run dev
```

## 验证点

### 1. 多页面切换
顶部有 2 个页面按钮：`test`、`alpha`。点击切换 wujie 容器加载不同介绍页。

### 2. URL 模式加载
wujie 通过 `url` 属性加载 `magiintro://<routeKey>/index.html`，自动解析 HTML 并重写相对路径为 `magiintro://` 绝对路径。HTML 模式（`html` 属性传字符串）也已验证通过，本 Demo 默认使用 URL 模式。

### 3. 主题/语言响应式同步
- 切换 Theme：wujie `bus.$on('theme-change')` 实时响应
- 切换 Locale：父界面文本 + 子应用 bus 同步

### 4. preloadApp 预加载
启动后所有页面通过 `wujie.preloadApp({ exec: true, fiber: true })` 预加载，切换零白屏。

### 5. 沙箱隔离（parent shield）
wujie bounded iframe 与主应用同源，子应用可通过 `window.parent.api` 访问主应用 API。通过 `plugins.jsBeforeLoaders` 注入脚本，将 `window.parent`/`window.top` 重定向到 iframe 自身，阻断访问。

### 6. Props 双向通信
- 子应用通过 `window.$wujie.props.onMessage()` 向主应用发消息
- 主应用通过 `wujieProps` 回调接收并显示在 Message Log

### 7. Bus 事件
主应用 `bus.$emit()` ↔ 子应用 `bus.$on()` 实时通信。

## 项目结构

```
electron/
  main.ts          # 协议注册 + IPC
  preload.ts       # contextBridge 白名单 API
src/
  App.vue          # wujie 容器组件
resources/intro-pages/
  test/            # 测试页（含 SVG 图片、计数器、隔离测试）
    current → 1.0.0-abcd1234
    1.0.0-abcd1234/index.html + assets/
  alpha/           # Alpha 模块页（紫色渐变主题）
    current → 1.0.0-alpha1
    1.0.0-alpha1/index.html + assets/
```

## 核心原理

### 自定义协议 → 文件系统映射

```
magiintro://<routeKey>/<relativePath>
           ↓
resources/intro-pages/<routeKey>/<version>/<relativePath>
```

`version` 由 `current` 指针文件决定。

### privileged scheme 配置

```js
protocol.registerSchemesAsPrivileged([{
  scheme: 'magiintro',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  }
}])
```

`registerSchemesAsPrivileged` 必须在 `app.whenReady()` 之前调用。

### Parent Shield（沙箱隔离）

```js
plugins: [{
  jsBeforeLoaders: [{
    content: `Object.defineProperty(window,'parent',{get:()=>window,configurable:false})`
  }]
}]
```

在子应用代码执行前注入，**不能用 `<iframe sandbox>`**——会导致子资源加载失败。

## IPC API

| IPC 通道 | 功能 |
|----------|------|
| `intro-page-get-status` | 查询页面可用状态 |
| `intro-page-list` | 列出所有可用页面 |
| `open-external` | 打开外部 URL |

## 常见问题

**Q: Status 一直 Loading？**
A: 检查 DevTools Console。如果有 `net::ERR_UNKNOWN_URL_SCHEME`，说明协议注册时机有误。如果有 404，检查对应 routeKey 的 `current` 文件和版本目录。

**Q: 页面空白？**
A: 看终端 `[magiintro]` 日志。如果没有，协议 handler 未触发。如果有，检查资源路径是否正确。

**Q: Bus 事件不触发？**
A: Bus 需要在 wujie 挂载后（`$wujie` 注入后）才能发送。
