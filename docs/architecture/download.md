# 下载编排

`src/core/download/` 是链路编排层，通过接口抽象数据来源与运行时能力。

## DownloadService

`downloadAlbum(albumId, onEvent)` 流程：

```mermaid
flowchart TD
    start["downloadAlbum(albumId)"] --> mk["创建 albumDir / .tmp"]
    mk --> album["source.getAlbum"]
    album --> ev1["事件 album-parsed"]
    ev1 --> loop{"遍历章节"}
    loop -->|每章| ph["source.getPhoto(photoId)"]
    ph --> items["source.buildImageItems"]
    items --> chap["downloadChapter 并发下载"]
    chap --> loop
    loop -->|结束| pdf["createAlbumPdf"]
    pdf --> ev2["事件 done(pdfPath)"]
    pdf --> clean["清理 .tmp"]
```

- 事件贯穿全程：`album-parsed` → `chapter` → `image` → `pdf-start` → `done` / `error`。
- `scrambleId` 取专辑级值（API 返回 `scramble_id`），章节缺失时回退到专辑值。

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
