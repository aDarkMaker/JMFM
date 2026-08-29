# Verification & Testing

## Unit tests

`bun test` covers the core modules (currently 20 test files, 149 cases):

| Module | Coverage |
|---|---|
| `transcode` | getNum strip calculation, computeStrips reverse reorder |
| `crypto` | MD5, AES-256-ECB key derivation and decryption |
| `parser` | Base64 decode, HTML parsing |
| `model` | image URL construction, ImageItem creation |
| `net` | domain rotation, URL construction, retryable classification, requestWithRetry |
| `download-service` | end-to-end orchestration (mocked network and runtime), atomic writes |
| `scheduler` | concurrency math, Semaphore, MemoryGate watermark |
| `sha256` / `download-apk` | incremental SHA-256 reference vectors, APK streaming download & verify |
| `update-http` | version-check / APK-download request and response handling |
| `safPaths` | SAF relative paths, delete protection |
| `resolveLibraryPaths` | library path resolution and remapping |
| `discoverLibrary` / `filterTags` | local library discovery, tag filtering |
| `daily` | daily recommendations (whitelist / favorites / time-tiered fill) |
| `download-store` | task state machine: albumId dedupe, status transitions, pause/resume, throttled progress flush |
| `settings` / `constants` / `semver` | config, constants, version comparison |
| `formatTaskError` | task error message formatting |

Run:

```bash
bun run test
```

## Node-side real verification

`scripts/verify-download.ts` runs the full download pipeline in Node (no emulator):

```bash
bun run verify 1327951
```

It will:

1. Refresh dynamic domains (shared global cache, probed once).
2. Fetch album and chapters via `ApiClient`.
3. Download all images into `temp/<title>/pages/` (sequence kept, atomic writes).
4. Download the cover to `temp/<albumId>_cover.jpg`.
5. Print stage timings and a page-size summary.

Verified against albums 1327951 (50 pages) and 1214052 (243 pages): `pages/` fully preserved, extensions and formats correct.

`scripts/verify-pages.ts` runs four chains: home / tags / library / task state machine.

```bash
bun scripts/verify-pages.ts [detail count, default 2]
```

It will:

1. **Home**: pull the recent 3-page pool by `mr_t`, apply the blacklist filter, pick 6 with `buildRecommendations`, and fetch each detail for chapters/tags; fails when fewer than 6 picks remain.
2. **Tags**: serially collect tags from several albums and count distinct ones (1.2s spacing to avoid source rate limiting); fails when every sampled album has no tags.
3. **Library**: run `discoverLibraryFromDisk` + `mergeDiscovered` against the Node filesystem scanner and report albums found under `temp/`.
4. **Task machine**: drive add → running → pause → resume → done and assert each stage.

Use `JMF_BLACKLIST=tag1,tag2` to inject a blacklist and `JMF_PROXY` to go through a proxy.

## Reader desktop bench

After download, simulate open → scroll-to-end on `pages/` and compare window / prewarm strategies:

```bash
bun scripts/bench-reader-flow.ts 1214052
```

Writes `temp/bench-reader-1214052.json` (first paint, first scroll, full scroll, decode p50/p95, recommended params).

## Static checks

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run build       # bun build output (--minify --splitting)
```
