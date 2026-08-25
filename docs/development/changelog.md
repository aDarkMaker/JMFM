# 开发日志

## 2026-08-25

### 阅读器图片直读秒开改造

- **图片直读主路径**：下载保留 `albumDir/pages/` 图片序列，阅读器直接渲染本地图片；PDF.js 仅作旧文件回退。
- **目录级 URI 一次解析**：`loadImageDocMeta` 并行 `readdir` + 目录 `getUri`，用 `baseSrc + filename` 同步填满全部 `srcs`，消除逐页 bridge。
- **命令式窗口化滚动**：滚动过程不走 React 状态；固定槽位高度；只挂载当前页 ±1/+3；页节点 Map 增量增删；工具栏页码 250ms 节流。
- **限流预解码 + idle 预热**：解码队列并发 2，可见页优先；前方预热 4 页；打开后 `requestIdleCallback` 预热前 12 页（不阻塞首屏）。
- **横向逐页**：三页轨道 + 手势只翻一页（跟手拖动、松手最多进一页），无惯性连跳与残影。
- **任务卡片**：标题列约束省略号，避免与标签重叠。
- **长篇实测（1214052）**：243 页 / 均约 792KB；下载图片约 154s、PDF 约 17s；`scripts/bench-reader-flow.ts` 三策略对比后选用 prewarm12 窗口模型。

### Cirrus 配色接入

- `src/web/theme/index.css` 映射 Cirrus 设计 token，组件级硬编码色替换为 CSS 变量。

### 下载与合并优化

- **多漫画串行队列**：新增 `src/web/download/queue.ts`（`MAX_CONCURRENT = 1`），暂停/失败自动执行下一本，避免磁盘与解码竞争卡顿。
- **PDF 合并批处理**：`createWorkerPdf` 主线程攒批，每 16 个 chunk 合并为一次 `appendFile`，bridge 调用约降 15 倍。

### 清理

- 中文注释转英文，保留英文区块注释；`ReaderScreen` 内联 ref 类型复用 `ImageReaderHandle`；删除死 CSS 规则。

## 2026-08-23

### Capacitor 全链路迁移

- **架构切换**：弃用 React Native + Metro，迁移为 Capacitor 架构（React Web + Bun build + Capacitor 壳）。
- **依赖清理**：移除全部 RN 生态（react-native、metro、babel、@react-navigation、react-native-* 等）及 iOS 工程。
- **新增依赖**：`@capacitor/*`（core / cli / android / filesystem / preferences）、`pdf-lib`、`react-dom`。
- **运行时重写**：
  - `transcode/decode.ts`：Skia → Web Canvas（`createImageBitmap` + `drawImage` 条带重组）。
  - `pdf/index.ts`：images-to-pdf → pdf-lib（`embedPng/Jpg` + 统一宽度页面）。
  - `download/runtime.ts`：blob-util → Capacitor Filesystem，新增 Web 内存实现。
  - `data/settings.ts`：AsyncStorage → Capacitor Preferences（原生）+ localStorage（Web）。
- **网络层**：`HttpClient` 抽象为接口；`AxiosHttpClient`（Web/Node）+ `NativeHttpClient`（CapacitorHttp 原生栈，绕过 CORS）。
- **UI 层**：`src/app/`（RN）→ `src/web/`（React DOM + CSS），轻量 tab 切换替代 React Navigation，内联 SVG 替代 react-native-svg，样式全部外置 CSS。
- **构建运行**：`bun build` → `dist/` → `cap sync/run android`，`scripts/dev-android.sh` 改为真机优先。
- **测试**：Jest → `bun test`（50 个用例全绿），typecheck / lint / build 通过，Android APK 构建成功。
- **冒烟**：真实下载 1327951 生成完整 PDF（50 页、统一宽度 960、无白边）。

## 2026-08-22

### PDF 拼贴修复

- **问题**：生成的 PDF 出现小图 + 大量白色占位，页面尺寸错误。
- **根因**：ImageMagick 条带裁剪后遗留虚拟页面元数据，`-append` 拼接后虚拟页面停留在第一条带高度，转 PDF 时 MediaBox 被设置为该错误高度，完整图片被压入矮页面。
- **修复**：`decodeWithMagick` 的 `-append` 后加 `+repage`；`createPdfWithMagick` 拼装前对输入加 `+repage`。
- **验证**：页面全部等宽 960pt、完整图片尺寸（670~1386pt）、无白色占位。

### 统一 PDF 页面宽度

- 新增 `src/core/pdf/layout.ts`：`computeUniformWidth`（目标宽度 = min(最大源图宽, 1190)）、`scaleSize`（等比缩放）。
- Node 运行时：`identify` 全部宽度后统一 `-resize`。
- 下载编排记录每页解码后尺寸，`buildPdfPages(imagePaths, sizes?)` 按实际尺寸生成页面，`imageFit: 'fill'`。
- 混合宽度实测：200x300 与 400x600 两图统一为 400x600，无白边。

### 链路打通

- `DownloadService` 改用 `ApiClient` 作为 `ContentSource`，处理单章空 series 回退。
- 抽离 `DownloadRuntime` 接口至 `src/core/download/types.ts`。
- `scripts/node-runtime.ts`：ImageMagick 解码 + PDF 生成。
- 真实专辑 1327951 全量验证通过（50 页 PDF）。

### 配置外置

- 新增 `src/config/app-config.json`，集中域名、密钥、请求头、下载并发、PDF 参数。
- 各核心模块从配置读取，移除硬编码。

## 2026-08-21

### API 通道打通

- 实现 `ApiClient`：动态域名刷新（AES 解密域名列表）、token 生成、响应解密、图片 URL 构造。
- 修正 AES-256-ECB 密钥派生：`md5(secret + ts)` 的 32 字节 ASCII 作为 key，与 Python jmcomic 对齐。
- 用纯 TS 自实现 Base64 / UTF-8 解码，替代 Node 专用 API。
- 结论：当前网络环境下 HTML 通道被 DNS 封锁，API 通道可用。

### 项目重写

- 由 Android (Java) 全量重写为 TypeScript 工程。
- 清理旧 Gradle 工程，纯 TS（无 `.js` 文件）。
- 移除离职遗留的 `~/.npmrc` 内网镜像配置。
