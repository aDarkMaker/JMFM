# AGENTS.md

JMFM 的工程契约。任何改动都要先满足本文件，再谈实现。

## 0. 项目定位

- Capacitor 8 + React 19 + Bun 的**纯单机** Android 应用。无账号、无服务端、无 OTA。
- **禁止**引入后端/服务端代码、账号体系、远程配置中心、第三方 UI/CSS 框架。
- **禁止**未经确认新增运行时依赖。热更新调试用 Bun 内置 dev server，CSS 用 Bun 内置 CSS Modules。

## 1. 包管理与命令

只用 `bun`（`bun install` / `bunx`），不要 npm / yarn / pnpm。

```bash
bun run dev:web          # 浏览器调试 + 页面 console 回流（CSS Modules 需关 HMR）
bun run dev:android      # 真机连局域网 dev server（同 WiFi）
bun run dev:android:usb  # 真机连 localhost（USB + adb reverse）
bun run dev:apk          # 指向局域网 dev server 的 debug 包，免数据线
bun run build            # 产物构建
bun run apk:release      # 签名 APK
bun run lint && bun run typecheck && bun test && bun run check
```

`bun run check` 是门禁总入口，包含 icons / tokens / ui / i18n / debug-code 五项检查。

## 2. 目录分层

```
src/core/        纯逻辑（api、net、download、update、model、fs），不得 import src/web
src/data/        持久化（user-storage、storage-keys、settings）
src/web/         UI（App、screens、components、hooks、stores、styles、ui）
src/web/ui/      基础组件库，全局唯一来源
src/web/features/<feature>/   业务功能，含 components/hooks/utils
src/web/shared/  ≥2 个 feature 消费的复合组件
scripts/         构建与门禁脚本
```

- `src/core` **不得** import `src/web`（eslint 强制）。
- `src/web` 只能经 `src/core/api`、`src/core/download`、`src/core/update`、`src/data/*` 消费下层。
- 单消费者资源共置在所有者目录；**≥2 消费者才提升**到 `shared/` 或 `features/<f>/`。

## 3. 导入

- 跨目录一律用 `@/` 别名（`@/web/...`、`@/core/...`、`@/data/...`），禁止 `../../` 深度 ≥2 的相对导入。
- 纯类型导入用 `import type`。
- 禁止页面直连 `api.github.com` 等外部地址，更新只允许走 `src/core/update`。

## 4. 样式

- 颜色 / 间距 / 控件尺寸 / 层级 / 动效**一律**走 `src/web/theme/index.css` 的 token，禁止裸 `#hex`、`rgba()`、裸 `px` 间距。
- 缺 token 时先补 token 再用，不许在业务 CSS 里临时写死。
- 组件样式用 `*.module.css`；`composes` 只能写在单类选择器上，且必须在其它声明之前。
- 全局 CSS 只允许 `src/web/styles/shell.css`，且只放 JS 通过 `classList` / `querySelector` 触达的契约类：
  `.app`、`.app-screen`、`.sticky-chrome`、`.tab-pane`、`.nav-layer`、`.chrome-hidden`、`.is-pulling`、`.is-search-locked`、`.keyboard-open`。
- 契约类由 `scripts/check-tokens.ts` 与 `scripts/check-ui.ts` 双向校验，新增前必须同时改脚本。

## 5. 组件

- 基础件（按钮、输入、开关、弹层、Toast、骨架屏等）**只能**放在 `src/web/ui/`，每个一件一个目录：`index.tsx` + 同名 `.module.css`，并由 `src/web/ui/index.ts` 统一导出。
- 业务组件放 `src/web/features/<feature>/`，不读全局 store 的展示件优先。
- icon-only 控件必须带 `aria-label`，图标本身 `aria-hidden`。
- 图标只用 `src/web/assets/icons/*.svg`，经 `bun scripts/gen-icons.ts` 生成，禁止手改 `src/web/generated/icons.ts`。

## 6. 文案

- 用户可见文案一律走 `t('域:语义')`，字典在 `src/web/i18n/zh-CN.ts`。
- 只有 zh-CN 一种语言，但 key 类型化，新增语言不改调用点。
- `docs/`、注释、日志不受此限制。

## 7. 状态与持久化

- 只有需要持久化的状态才进 store；纯 UI 状态用 `useState`。
- 持久化键集中在 `src/data/storage-keys.ts`，读写走 `src/data/user-storage.ts`。
- 读写必须处理 `Promise` 拒绝，禁止 `try { void p } catch {}` 这种抓不到异步错误的写法。
- 结构性变更必须提升 `STORAGE_VERSION` 并写 `migrate`。

## 8. 调试

- 调试只用 `bun run dev:web` / `dev:android` / `dev:android:usb` / `dev:apk`。
- **禁止**为了调试改 `capacitor.config.ts` 的 `server.url` 或提交明文放行到 Release 清单。
- 提交前不得残留 `console.log` / `debugger` / `alert`（`console.warn` / `console.error` 允许）。

## 9. 更新

- 更新只能走 `src/core/update`：`source.ts`（多入口回退）→ `manifest.ts`（契约与强制更新判定）→ `download-apk.ts`（多镜像 + 续传）。
- `version.json` 字段变更必须同步 `scripts/read-version.ts`、`scripts/bump-version.ts` 与 `.github/workflows/release-apk.yml`。

## 10. 提交

- 提交前必须全绿：`bun run lint && bun run typecheck && bun test && bun run check`。
- 每个 `.ts` / `.tsx` 文件头部写一行 `/** 文件用途 */` 注释。
- 注释只写「为什么」，不复述代码在做什么。
