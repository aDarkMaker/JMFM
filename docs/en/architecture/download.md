# Download Orchestration

`src/core/download/` is the orchestration layer, abstracting data sources and runtime capabilities behind interfaces.

## DownloadService

`downloadAlbum(albumId, onEvent)` flow (**pages only** — no automatic PDF merge):

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
    loop -->|done| done["event done(albumDir)"]
```

- Events: `album-parsed` → `chapter` → `image` → `done` / `canceled` / `error` (`pdf-start` removed).
- `done` carries `albumDir`; the UI `saveToLibrary` writes `pagesDir` / `coverPath` / `pageCount` from it.
- `scrambleId` takes the album-level value (API `scramble_id`); chapters fall back to the album value when missing.
- Each image is written under `albumDir/pages/` (global numbering; extension from `imageFormat`, default `webp`).
- `albumDir/.nomedia` keeps the system gallery from indexing covers and pages.

## Decode format & strategy

- `DownloadDeps.imageFormat?: 'webp' | 'jpg'` (from `settings.imageFormat`, default webp).
- `decodeAndSave(..., format?)` encodes accordingly; `decideImageStrategy`:
  - `gif` / `num <= 0` → `raw`
  - `num <= 1` and not webp → `raw`
  - otherwise → `reassemble`

## Concurrency Control

`downloadChapter` uses `mapWithConcurrency`:

- `calcConcurrency(total, cpuCount, override)`: defaults to `min(64, cpuCount * 2, total)`, with an override option.
- After each download, decode / reassemble by strategy, then write to disk.

## Runtime Abstraction

The `DownloadRuntime` interface (`src/core/download/types.ts`) defines:

- `fs.mkdir / writeFile / readFile / unlink / exists?`
- `decodeAndSave(num, encoded, ext, format?)` → `DecodedImage`
- `createAlbumPdf(...)` (**optional archive**; not called on the download hot path)

Three implementations:

| Implementation | Location | Capability |
|---|---|---|
| Capacitor native | `src/core/download/runtime.ts` | Filesystem + Canvas decode (+ optional pdf-lib) |
| Web in-memory | `src/core/download/runtime.ts` | Map-backed filesystem, for browser debugging |
| Node runtime | `scripts/node-runtime.ts` | Node fs + ImageMagick |

`createRuntime()` picks native or web via `Capacitor.isNativePlatform()`.

## Direct image reading flow

After download, `pages/` is the primary artifact; the reader (`src/web/reader/`) renders it directly:

```mermaid
flowchart LR
    pages["albumDir/pages/*.{webp,jpg}"] --> meta["loadImageDocMeta (readdir + dir getUri)"]
    meta --> srcs["fill all srcs as baseSrc + filename"]
    srcs --> dom["imperative window mount (±1/+8)"]
    dom --> img["applyToImg → img.src"]
```

- Metadata cache (LRU): one parallel `readdir` + directory `getUri`; every page URI is available synchronously.
- Scroll mode: fixed slot heights, window current ±1/+8, node pool reuse; `image-loader.applyToImg` binds `src` directly.
- Paged mode: three-slide track with one-page gesture flips.
- `saveToLibrary` preloads `ImageDocMeta` on insert so opening from the library hits the cache.
