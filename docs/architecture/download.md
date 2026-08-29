# 下载编排

`src/core/download/` 是链路编排层，通过接口抽象数据来源与运行时能力。

## DownloadService

`downloadAlbum(albumId, onEvent)` 流程（**仅落盘图片**，不再自动合成 PDF）：

```mermaid
flowchart TD
    start["downloadAlbum(albumId)"] --> mk["创建 albumDir / pages / .nomedia"]
    mk --> album["source.getAlbum"]
    album --> ev1["事件 album-parsed"]
    ev1 --> loop{"遍历章节"}
    loop -->|每章| ph["source.getPhoto(photoId)"]
    ph --> items["source.buildImageItems"]
    items --> chap["downloadPages 并发下载"]
    chap --> loop
    loop -->|结束| done["事件 done(albumDir)"]
```

- 事件贯穿全程：`album-parsed` → `chapter` → `image` → `done` / `canceled` / `error`（已移除 `pdf-start`）。
- `done` 载荷为 `albumDir`；UI 侧 `saveToLibrary` 据此写入 `pagesDir` / `coverPath` / `pageCount`。
- `scrambleId` 取专辑级值（API 返回 `scramble_id`），章节缺失时回退到专辑值。
- 每张图片写入 `albumDir/pages/`（全局序号，扩展名由 `imageFormat` 决定，默认 `webp`）。
- `albumDir/.nomedia`（空换行文件）阻止系统相册收录封面与页面。

## 共享页面下载（src/core/download/pages.ts）

`DownloadService` 与「修复文件」共用同一套页面能力：

- `collectAlbumPages(source, albumId)`：拉取专辑全部章节并展开为有序的 `ImageItem[]`。
- `downloadPages(ctx, items, pagesDir, offset, controller?, onProgress?, opts?)`：
  - 并发下载（`calcConcurrency` 限流），已存在的页自动跳过，**断点续传 / 补页天然支持**。
  - `opts.preferredExt` 指定期望格式：格式不符的旧文件会被删除后重下（用于格式修复）。
  - 每张图按 `decideImageStrategy` 选择 raw 直写或 `decodeAndSave` 重组。
  - 原生响应直接携带 base64 直写（`ImageBytes`），避免解码再编码的双放大。
- `fetchImageBytes` / `findExisting`：单页下载（3 次重试）与多扩展名探测（`MIN_FILE_BYTES` 防半文件）。
- 取消：`controller.paused` 置位后抛 `CanceledError`，`isCanceledError` 识别。

## 解码格式与策略

- `DownloadDeps.imageFormat?: 'webp' | 'jpg'`（设置项 `settings.imageFormat`，默认 webp）。
- `decodeAndSave(..., format?)` 按格式输出；`decideImageStrategy`：
  - `gif` / `num <= 0` → `raw`
  - `num <= 1` 且非 webp → `raw`
  - 其余 → `reassemble`

## 并发与内存控制（src/core/download/scheduler.ts）

`downloadPages` 使用 `mapWithConcurrency`：

- `calcConcurrency(total, cpuCount, override)`：默认 `min(64, cpuCount * 2, total)`，可配置覆盖。
- `calcDecodeConcurrency(cpuCount)`：解码并发显著低于网络并发（解码放大内存），用 `Semaphore` 限流。
- `MemoryGate(MEMORY_WATERMARK_BYTES = 256MB)`：已抓取未落盘的累计字节超过水位时阻塞下载，防止并发把内存打满。

## 运行时抽象

`DownloadRuntime` 接口（`src/core/download/types.ts`）定义：

- `fs.mkdir / writeFile / appendFile / readFile / unlink / exists / rename / size`
- `writeFile / appendFile` 的 `data` 可为 `Uint8Array` 或 base64 字符串（原生/SAF 直写）
- `decodeAndSave(num, encoded, ext, format?)` → `DecodedImage`

四个实现：

| 实现 | 位置 | 能力 |
|---|---|---|
| Capacitor 原生 | `src/core/download/runtime.ts` | Filesystem + Canvas 解码 |
| SAF（用户授权目录） | `src/web/download/safRuntime.ts` | 经 SAF 插件读写用户选定目录 |
| Web 内存 | `src/core/download/runtime.ts` | Map 内存文件系统，浏览器调试用 |
| Node 运行时 | `scripts/node-runtime.ts` | Node fs + ImageMagick |

`createDownloadRuntime(settings)` 根据设置选择实现：设置 `downloadTreeUri` 时走 SAF，否则按 `Capacitor.isNativePlatform()` 选择原生或 Web。所有实现共用 `atomicWrite`（写 `.tmp` → rename）与 `MIN_FILE_BYTES` 防半文件。

## 图片直读数据流

下载完成后 `pages/` 即主产物，阅读器（`src/web/reader/`）直接渲染：

```mermaid
flowchart LR
    pages[albumDir/pages] --> meta[loadImageDocMeta]
    meta --> srcs[fill srcs]
    srcs --> dom[window mount]
    dom --> img[applyToImg]
```

- 元数据缓存（LRU，3 项）+ inflight 去重：`readdir` 与目录 `getUri` 并行一次完成，本地路径下全部页面 URI 同步可得。
- SAF 路径：仅解析前 8 个 URI，滚动时按需惰性解析（`resolveImageSrcLazy`），避免一次拉全部 bridge 调用。
- 滚动模式：固定槽位高度，窗口当前页 ±1/+3，节点池复用；`image-loader.applyToImg` 直接绑 `src`。
- 横向翻页为三页轨道手势逐页；首帧后预取第 3 页。
- `saveToLibrary` 入库时预加载 `ImageDocMeta`，打开阅读器时命中缓存。

## 修复文件

设置 → 修复文件：扫描漫画库，补齐缺失页面、封面与元数据；仅整本缺失时重新下载。

| 情况 | 处理 |
|---|---|
| 路径变更 | 自动重定位到当前下载目录 |
| 缺页 / 格式不符 | 只下载缺失或错误格式的页 |
| 缺封面 | 重新下载封面 |
| 元数据缺失 | 刷新标题、作者、标签 |
| 整本缺失 | 加入下载队列 |
