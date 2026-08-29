# 开发日志

## 2026-08-28（五）

### 全链路优化与翻新

- **数据安全**：页面/封面/元数据统一原子写入（`.tmp` + rename）；`MIN_FILE_BYTES` 防半文件；SAF unlink 删除保护（禁止删除下载根目录）；下载失败回滚空目录；SAF 修复路径重定位修正。
- **下载性能**：`FileSystem` 直写 base64（原生/SAF 免二次编解码）；`scheduler.ts` 新增 `MemoryGate` 内存水位与 `Semaphore` 解码限流；`downloadPages` 原子写页。
- **APK 更新**：流式分块下载（原生切片解码 base64 / web 走 reader），增量 `Sha256` 边收边算，校验失败自动清理重下。
- **UI 渲染**：Home 窄订阅（`useShallow` 只订阅 albumId）、`AlbumCard` memo 配稳定引用、封面懒加载（预载前 8 张）；`ReaderScreen` 改 `React.lazy`。
- **阅读器**：`loadImageDocMeta` inflight 去重；SAF 仅预解析前 8 个 URI、滚动按需惰性解析；滚动窗口收敛 ±1/+3；paged 首帧预取第 3 页。
- **网络层**：`fetchOnce` 用 `AbortSignal.timeout` 超时；`FetchResult.retryable` 区分 4xx/5xx/429；`refreshDomains` 结果全局共享只探测一次。
- **构建产物**：`bun build --minify --splitting`；nagino 4.3MB otf 转 1.7MB woff2、删冗余 ttf；pdf.js 与 ReaderScreen 拆独立 chunk，入口 0.52MB。
- **代码去臃肿**：删除 PDF 生成全部死代码与 `pdf-lib` 依赖；重试/sleep/扩展名/文件名清洗/base64 重复合并；`config.app.version` 改名 `apiTokenVersion`；CSS 去重。
- **模块解耦**：SAF 基础下沉 `core/fs/saf`；`cacheRegistry` 统一缓存失效；HTTP 统一（去 `getHtml`）；axios/node-html-parser 归 devDependencies；`STORAGE_KEYS` 集中存储键。
- 回归：`bun test` 138 用例 / 19 文件、typecheck / lint / build / verify 全绿。

## 2026-08-27（二）

### 安全加固、修复文件与推荐优化

- **签名与更新**：keystore 移出仓库；CI 从 Secret 注入；`version.json` 绑定 `apkSha256`；按 release tag 下载并校验后安装。
- **修复文件**：设置页「修复文件」改为缺什么补什么（补页 / 补封面 / 刷新元数据 / 路径重定位），移除「元数据同步」入口。
- **下载层**：`core/download/pages.ts` 共享页面下载，整本下载与修复复用。
- **推荐与持久化**：白名单优先、语种 tag 过滤、dismiss/刷新；library/daily/dismissed 统一 `user-storage`。
- **网络**：域名先 HTTPS、HTTP 回退。
- 文档与注释同步（中英文 architecture / setup）。

## 2026-08-27

### 项目结构整理与优化

- **注释与文档**：中文注释全部转英文；README / VitePress 中英文文档同步（新增每日推荐、内容过滤章节，目录结构与分层依赖更新）。
- **主包最简**：`core/parser` 移至 `__tests__/helpers/parser`；`AxiosHttpClient` 移至 `scripts/shared/axios-http.ts`，运行时仅 Fetch / CapacitorHttp；删除无引用的死代码导出（`buildImageUrls`、`buildImageItemsFromPhoto`、部分 constants、`prefetch*`、`clearImageLoaderCache`、`swapCanvases` 等导出等）。
- **架构解耦**：`blocklist` 移入 `core/model`；`DecodedImage/DecodeFormat` 移入 `core/model`；新增 `core/fs/types.ts` 承载 `FileSystem`，消除 pdf → download 反向依赖。
- **store 收敛**：`daily` store 参数化（调用方注入黑名单 / 偏爱标签 / 代理配置）；`saveToLibrary` store 写入改为注入。
- **重复提取**：`web/library/uid.ts` 统一 `uid()`；`useDownloadTask.enqueueAlbum` 收敛「addBatch + find + startDownload」时序（Home / Tasks / Settings 三处）。
- **net 重试去重**：新增 `requestWithRetry`，Fetch / 原生实现共用。
- **api 拆分**：`core/api` 拆为 `client.ts`（请求鉴权重试）+ `parse.ts`（纯解析）+ barrel。
- **SettingsScreen 拆分**：资源修复编排提取至 `useLibraryRepair` hook；`usePlatformBack` 重命名 `reader-lifecycle`。
- **性能**：library 持久化 400ms 防抖批量写 + `beforeunload` flush；App 订阅仅 items 变更才预热封面，屏幕映射提为模块级常量。
- 回归：`bun test` 70 用例 / typecheck / lint 全绿。

## 2026-08-25

### 下载改为仅落盘 pages（默认 webp）

- `DownloadService` 移除自动 `createAlbumPdf`；`done` 事件改为 `albumDir`。
- `imageFormat`（webp/jpg）贯通 decode；`decideImageStrategy`：`num<=1` 且非 webp → `raw`。
- verify / Node runtime / 单测同步。

### 阅读器简化绑图

- 新增 `image-loader.applyToImg`；滚动窗口 ±1/+8，页节点池复用；去掉复杂预解码队列。

### 资源修复 + 确认框

- `repairLibrary` 三检：元数据 / 格式+页数 / 封面；设置页一键删目录并重入队。
- 新增 `ConfirmDialog`，库删除与修复确认统一。

### 封面预加载 + 任务卡片

- `coverCache` + App 订阅预热，消除切 Tab 封面加载高度跳变。
- 任务卡去掉对号；完成离场改 GSAP 高度折叠；自动移除计时器不再被进度重置。

### 阅读器图片直读秒开改造

- **图片直读主路径**：下载保留 `albumDir/pages/` 图片序列，阅读器直接渲染本地图片；PDF.js 仅作旧文件回退。
- **目录级 URI 一次解析**：`loadImageDocMeta` 并行 `readdir` + 目录 `getUri`，用 `baseSrc + filename` 同步填满全部 `srcs`，消除逐页 bridge。
- **命令式窗口化滚动**：滚动过程不走 React 状态；固定槽位高度；页节点 Map 增量增删。
- **横向逐页**：三页轨道 + 手势只翻一页（跟手拖动、松手最多进一页），无惯性连跳与残影。
- **长篇实测（1214052）**：243 页 / 均约 792KB；下载图片约 154s。

### Cirrus 配色接入

- `src/web/theme/index.css` 映射 Cirrus 设计 token，组件级硬编码色替换为 CSS 变量。

### 下载与合并优化

- **多漫画串行队列**：新增 `src/web/download/queue.ts`（`MAX_CONCURRENT = 1`），暂停/失败自动执行下一本，避免磁盘与解码竞争卡顿。
- **PDF 合并批处理**（可选归档路径）：`createWorkerPdf` 主线程攒批，每 16 个 chunk 合并为一次 `appendFile`。

### 清理

- 中文注释转英文，保留英文区块注释；删除死 CSS 规则。

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
