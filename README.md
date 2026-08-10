# wujie-electron-protocal-demo

验证 wujie 微前端框架加载 Electron 自定义协议（`magiintro://`）指向的本地 HTML 资源的 Demo。

## 快速启动

```bash
# 1. 安装依赖（已安装可跳过）
npm install

# 2. 启动开发环境（Vite + Electron 自动联动）
npm run dev
```

启动后会自动弹出 Electron 窗口，DevTools 也会同时打开。

## 验证点

Electron 窗口打开后，页面应自动加载 `magiintro://test/index.html`，你需要看到：

1. **URL 模式（默认）** — wujie 通过 `url` 参数直接加载自定义协议
2. **Status 显示 "Loaded ✓"** — 表示协议处理正常
3. **Message Log 有成功日志** — 协议请求日志 + wujie 挂载成功
4. **测试页渲染** — 看到 Test Intro Page 的绿色 ✓ 标记

## 项目结构

```
electron/
  main.ts          # 主进程：注册 magiintro:// 协议 + IPC 处理
  preload.ts       # 预加载脚本：暴露白名单 API 给渲染进程
src/
  main.ts          # Vue 入口
  App.vue          # wujie 容器组件（URL / HTML 双模式切换）
resources/intro-pages/test/
  current          # 版本指针文件
  1.0.0-abcd1234/  # 版本目录（模拟解压后的 ZIP ）
    index.html     # 入口 HTML
    assets/
      style.css    # 样式（外链，验证协议加载 CSS）
      app.js       # 脚本（外链，验证协议加载 JS + wujie props 通信）
      logo.svg     # 图片（验证协议加载 SVG 资源）
      pattern.svg  # CSS 背景图（验证协议在 CSS 中加载资源）
```

## 核心原理

### 自定义协议

`magiintro://` 协议映射到本地文件系统结构：

```
magiintro://<routeKey>/<relativePath>
           ↓
resources/intro-pages/<routeKey>/<version>-<sha256[:8]>/<relativePath>
```

其中 `<version>-<sha256[:8]>` 由 `current` 指针文件决定，模拟设计文档中的版本管理机制。

### URL 模式 vs HTML 模式

| 模式 | 实现方式 | 用途 |
|------|---------|------|
| URL 模式 | `<WujieVue url="magiintro://test/index.html" />` | 主方案，wujie 自动 fetch HTML 并重写资源路径 |
| HTML 模式 | `fetch(url)` → `<WujieVue html="..." url="..." />` | 退路方案，wujie 对自定义协议支持不足时使用 |

点击页面上的按钮可切换两种模式。

### 安全设计

- **路径穿越防护** — `isPathSafe()` 确保请求不会跳出版本目录
- **白名单 API** — `window.api` 仅暴露 `getIntroPageStatus` / `openExternal`
- **沙箱隔离** — 通过 wujie `plugins.jsBeforeLoaders` 注入 parent shield 脚本

  **问题**：wujie 的 bounded iframe 与主应用同源，子应用默认可通过 `window.parent.api` 访问主应用 API（LEAK）。

  **修复**：用 `jsBeforeLoaders` 在子应用代码执行**之前**注入脚本，把 `window.parent` / `window.top` 重定向到 iframe 自身：

  ```js
  const wujiePlugins = [{
    jsBeforeLoaders: [{
      content: `
        Object.defineProperty(window, 'parent', { get: () => window, configurable: false });
        Object.defineProperty(window, 'top',    { get: () => window, configurable: false });
      `
    }]
  }]
  ```

  这样 `window.parent.api` 变成 `window.api`（iframe 自身的，不存在），子应用只能通过 `window.$wujie.props` 与主应用通信。

  > **为什么不用 `<iframe sandbox>`**：直接给 wujie iframe 加 `sandbox="allow-scripts"` 会导致子资源（CSS/JS/图片）加载失败——sandboxed iframe 的 origin 变为 null，浏览器阻止跨 origin 请求。`jsBeforeLoaders` 方案不影响资源加载。

## 常见问题

**Q: 启动后看不到页面？**
A: 打开 DevTools Console 查看错误。如果出现 `net::ERR_UNKNOWN_URL_SCHEME`，说明协议注册时机有问题——确保 `registerSchemesAsPrivileged` 在 `app.whenReady()` 之前调用。

**Q: 页面空白？**
A: 检查终端日志中是否有 `[magiintro]` 前缀的输出。如果没有，说明协议 handler 未被触发。如果有 404，检查 `resources/intro-pages/test/current` 文件内容是否为 `1.0.0-abcd1234`。

**Q: 想添加新的测试页面？**
A: 在 `resources/intro-pages/` 下创建新目录（如 `hud/`），放 `current` 指针和版本目录，然后在 `App.vue` 中修改 `protocolUrl` 为 `magiintro://hud/index.html`。
