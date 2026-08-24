# 下载编排

`src/core/download/` 是链路编排层，通过接口抽象数据来源与运行时能力。

## DownloadService

`downloadAlbum(albumId, onEvent)` 流程：

```mermaid
flowchart TD
    start["downloadAlbum(albumId)"] --> mk["创建 albumDir / pages / .nomedia"]
    mk --> album["source.getAlbum"]
    album --> ev1["事件 album-parsed"]
    ev1 --> loop{"遍历章节"}
    loop -->|每章| ph["source.getPhoto(photoId)"]
    ph --> items["source.buildImageItems"]
    items --> chap["downloadChapter 并发下载"]
    chap --> loop
    loop -->|结束| pdf["createAlbumPdf"]
    pdf --> ev2["事件 done(pdfPath)"]
```

- 事件贯穿全程：`album-parsed` → `chapter` → `image` → `pdf-start` → `done` / `error`。
- `scrambleId` 取专辑级值（API 返回 `scramble_id`），章节缺失时回退到专辑值。
- 每张图片写入 `albumDir/pages/`（全局序号命名 `0001.jpg` …），PDF 生成后**保留**该序列供阅读器图片直读秒开。
- `albumDir/.nomedia`（空换行文件）阻止系统相册收录封面与页面。

## 并发控制

`downloadChapter` 使用 `mapWithConcurrency`：

- `calcConcurrency(total, cpuCount, override)`：默认 `min(64, cpuCount * 2, total)`，可配置覆盖。
- 每张图下载后按策略解码 / 重组，并记录实际尺寸供 PDF 使用。

## 运行时抽象

`DownloadRuntime` 接口（`src/core/download/types.ts`）定义：

- `fs.mkdir / writeFile / readFile / unlink`
- `decodeAndSave(num, encoded, ext)` → `DecodedImage`
- `createAlbumPdf(outputDir, title, imagePaths, sizes?)`

三个实现：

| 实现 | 位置 | 能力 |
|---|---|---|
| Capacitor 原生 | `src/core/download/runtime.ts` | Filesystem + Canvas 解码 + pdf-lib |
| Web 内存 | `src/core/download/runtime.ts` | Map 内存文件系统，浏览器调试用 |
| Node 运行时 | `scripts/node-runtime.ts` | Node fs + ImageMagick |

`createRuntime()` 根据 `Capacitor.isNativePlatform()` 选择原生或 Web 实现。

## 尺寸传递

重组后每页的实际宽高会随 `sizes` 传给 `createAlbumPdf`，用于统一宽度排版（详见 PDF 生成）。

## 图片直读数据流

PDF 生成后 `pages/` 序列被保留，阅读器（`src/web/reader/`）不再等待 pdf.js 解析：

```mermaid
flowchart LR
    pages["albumDir/pages/*.jpg"] --> meta["loadImageDocMeta（readdir + 排序）"]
    meta --> dom["立即渲染 DOM 占位（pageCount）"]
    dom --> uri["resolvePageSrc（按需 getUri）"]
    uri --> img["<img src> 渐进显示"]
    meta --> pre["prefetchPageSrcs 后台批量预取"]
```

- 元数据缓存（LRU 3 本）与 src 懒填充：先 `readdir` 拿到页数与文件名，首帧不阻塞；可见页附近按需 `getUri`，后台分批预取（`PREFETCH_BATCH = 6`）避免 bridge 风暴。
- 滚动模式采用窗口化渲染：只挂载当前页 ±3/+6，上下 spacer 按各页宽高比撑起总高度，滚出即卸载（对齐原生 RecyclerView 复用模型）；`onScroll` 以 rAF 节流 + 纯算术二分定位当前页。
- `saveToLibrary` 在入库时预热前 6 页，返回库后打开即见首屏。
