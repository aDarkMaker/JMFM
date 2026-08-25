# Download Orchestration

`src/core/download/` is the orchestration layer, abstracting data sources and runtime capabilities behind interfaces.

## DownloadService

`downloadAlbum(albumId, onEvent)` flow:

```mermaid
flowchart TD
    start["downloadAlbum(albumId)"] --> mk["create albumDir / pages / .nomedia"]
    mk --> album["source.getAlbum"]
    album --> ev1["event album-parsed"]
    ev1 --> loop{"for each chapter"}
    loop -->|each| ph["source.getPhoto(photoId)"]
    ph --> items["source.buildImageItems"]
    items --> chap["downloadChapter concurrent"]
    chap --> loop
    loop -->|done| pdf["createAlbumPdf"]
    pdf --> ev2["event done(pdfPath)"]
```

- Events run through the whole flow: `album-parsed` → `chapter` → `image` → `pdf-start` → `done` / `error`.
- `scrambleId` takes the album-level value (the API returns `scramble_id`); when a chapter is missing it, it falls back to the album value.
- Each image is written to `albumDir/pages/` (globally numbered `0001.jpg` …). The sequence is **kept** after PDF generation so the reader can show images instantly without pdf.js.
- `albumDir/.nomedia` (an empty newline file) keeps the system photo gallery from indexing covers and pages.

## Concurrency Control

`downloadChapter` uses `mapWithConcurrency`:

- `calcConcurrency(total, cpuCount, override)`: defaults to `min(64, cpuCount * 2, total)`, with an override option.
- After each image is downloaded, it is decoded / reassembled by strategy, and the actual size is recorded for PDF layout.

## Runtime Abstraction

The `DownloadRuntime` interface (`src/core/download/types.ts`) defines:

- `fs.mkdir / writeFile / readFile / unlink`
- `decodeAndSave(num, encoded, ext)` → `DecodedImage`
- `createAlbumPdf(outputDir, title, imagePaths, sizes?)`

Three implementations:

| Implementation | Location | Capability |
|---|---|---|
| Capacitor native | `src/core/download/runtime.ts` | Filesystem + Canvas decode + pdf-lib |
| Web in-memory | `src/core/download/runtime.ts` | Map-backed filesystem, for browser debugging |
| Node runtime | `scripts/node-runtime.ts` | Node fs + ImageMagick |

`createRuntime()` picks native or web implementation via `Capacitor.isNativePlatform()`.

## Size Propagation

The actual width and height of each reassembled page are passed to `createAlbumPdf` via `sizes` for uniform-width layout (see PDF Generation).

## Direct image reading flow

After PDF generation the `pages/` sequence is kept, so the reader (`src/web/reader/`) does not wait for pdf.js parsing:

```mermaid
flowchart LR
    pages["albumDir/pages/*.jpg"] --> meta["loadImageDocMeta (readdir + dir getUri)"]
    meta --> srcs["fill all srcs as baseSrc + filename"]
    srcs --> dom["imperative window mount (±1/+3)"]
    dom --> img["<img> + throttled decode (concurrency 2)"]
```

- Metadata is cached (LRU 3 albums): `readdir` and directory `getUri` run once in parallel; every page URI is available synchronously with no per-page bridge calls.
- Scroll mode uses imperative windowed rendering: fixed slot heights, only the current page ±1/+3 stays mounted, nodes tracked in a Map; decode queue concurrency 2 prioritizes visible pages and warms 4 ahead; after open, `requestIdleCallback` prewarms the first 12 pages (measured to remove first-scroll jank).
- Paged mode uses a three-slide track with gesture-driven one-page flips.
- `saveToLibrary` preloads `ImageDocMeta` on insert so opening from the library hits the cache.
- **Bench (album 1214052, 243 pages, ~792KB/page avg)**: desktop `bench-reader-flow` shows decode is the bottleneck (p50 ≈ 33ms/page @400px), disk IO is negligible; winner is `prewarm12 + ±1/+3 + concurrency 2` (`firstScroll ≈ 0`, full scroll ≈ 7.8s).
