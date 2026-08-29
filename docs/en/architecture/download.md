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
    items --> chap["downloadPages concurrent"]
    chap --> loop
    loop -->|done| done["event done(albumDir)"]
```

- Events: `album-parsed` → `chapter` → `image` → `done` / `canceled` / `error` (`pdf-start` removed).
- `done` carries `albumDir`; the UI `saveToLibrary` writes `pagesDir` / `coverPath` / `pageCount` from it.
- `scrambleId` takes the album-level value (API `scramble_id`); chapters fall back to the album value when missing.
- Each image is written under `albumDir/pages/` (global numbering; extension from `imageFormat`, default `webp`).
- `albumDir/.nomedia` keeps the system gallery from indexing covers and pages.

## Shared page download (src/core/download/pages.ts)

`DownloadService` and the "repair files" flow share one page engine:

- `collectAlbumPages(source, albumId)`: expands every chapter into an ordered `ImageItem[]`.
- `downloadPages(ctx, items, pagesDir, offset, controller?, onProgress?, opts?)`:
  - Concurrent download (`calcConcurrency`), skipping files that already exist — resume / backfill for free.
  - `opts.preferredExt` forces a target format: mismatched files are deleted and re-fetched (format repair).
  - Each page goes through `decideImageStrategy`: `raw` write or `decodeAndSave` reassembly.
  - Native responses carry base64 directly for write-through (`ImageBytes`), avoiding decode-then-re-encode.
- `fetchImageBytes` / `findExisting`: per-page fetch (3 retries) and multi-extension probing (`MIN_FILE_BYTES` guards half-written files).
- Cancellation: setting `controller.paused` throws `CanceledError`; detected via `isCanceledError`.

## Decode format & strategy

- `DownloadDeps.imageFormat?: 'webp' | 'jpg'` (from `settings.imageFormat`, default webp).
- `decodeAndSave(..., format?)` encodes accordingly; `decideImageStrategy`:
  - `gif` / `num <= 0` → `raw`
  - `num <= 1` and not webp → `raw`
  - otherwise → `reassemble`

## Concurrency & memory control (src/core/download/scheduler.ts)

`downloadPages` uses `mapWithConcurrency`:

- `calcConcurrency(total, cpuCount, override)`: defaults to `min(64, cpuCount * 2, total)`, with an override option.
- `calcDecodeConcurrency(cpuCount)`: decode concurrency stays well below the network one (decode amplifies memory), throttled by a `Semaphore`.
- `MemoryGate(MEMORY_WATERMARK_BYTES = 256MB)`: blocks fetching once fetched-but-unwritten bytes exceed the watermark, bounding memory.

## Runtime Abstraction

The `DownloadRuntime` interface (`src/core/download/types.ts`) defines:

- `fs.mkdir / writeFile / appendFile / readFile / unlink / exists / rename / size`
- `writeFile / appendFile` accept `Uint8Array` or base64 strings (native/SAF direct-write)
- `decodeAndSave(num, encoded, ext, format?)` → `DecodedImage`

Four implementations:

| Implementation | Location | Capability |
|---|---|---|
| Capacitor native | `src/core/download/runtime.ts` | Filesystem + Canvas decode |
| SAF (user-picked directory) | `src/web/download/safRuntime.ts` | read/write a user-selected directory via the SAF plugin |
| Web in-memory | `src/core/download/runtime.ts` | Map-backed filesystem, for browser debugging |
| Node runtime | `scripts/node-runtime.ts` | Node fs + ImageMagick |

`createDownloadRuntime(settings)` picks by settings: SAF when `downloadTreeUri` is set, otherwise native vs web via `Capacitor.isNativePlatform()`. All implementations share `atomicWrite` (`.tmp` + rename) and `MIN_FILE_BYTES` against half-written files.

## Direct image reading flow

After download, `pages/` is the primary artifact; the reader (`src/web/reader/`) renders it directly:

```mermaid
flowchart LR
    pages[albumDir/pages] --> meta[loadImageDocMeta]
    meta --> srcs[fill srcs]
    srcs --> dom[window mount]
    dom --> img[applyToImg]
```

- Metadata cache (LRU, 3 entries) with inflight dedupe: one parallel `readdir` + directory `getUri`; local-path pages resolve synchronously.
- SAF path: only the first 8 URIs resolve up front; the rest resolve lazily on scroll (`resolveImageSrcLazy`), avoiding a burst of bridge calls.
- Scroll mode: fixed slot heights, window current ±1/+3, node pool reuse; `image-loader.applyToImg` binds `src` directly.
- Paged mode: three-slide track with one-page gesture flips; page 3 is prefetched after first paint.
- `saveToLibrary` preloads `ImageDocMeta` on insert so opening from the library hits the cache.

## Repair files

Settings → Repair files: scan the library and backfill missing pages, covers, and metadata. Full re-download only when an album is entirely missing.

| Case | Action |
|---|---|
| Path changed | Remap to the current download directory |
| Missing / wrong-format pages | Download only what's missing |
| Missing cover | Re-download cover |
| Missing metadata | Refresh title, author, tags |
| Album gone | Queue for download |
