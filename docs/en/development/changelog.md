# Changelog

## 2026-08-27

### Project structure cleanup & optimization

- **Comments & docs**: all Chinese comments translated to English; README / VitePress docs (zh/en) synced (new daily recommendations & content filtering sections; directory layout and layer dependencies updated).
- **Lean main bundle**: `core/parser` moved to `__tests__/helpers/parser`; `AxiosHttpClient` moved to `scripts/shared/axios-http.ts` — runtime uses Fetch / CapacitorHttp only; removed unreferenced dead exports (`buildImageUrls`, `buildImageItemsFromPhoto`, unused constants, `prefetch*`, `clearImageLoaderCache`, `swapCanvases` export, etc.).
- **Decoupling**: `blocklist` moved into `core/model`; `DecodedImage/DecodeFormat` moved into `core/model`; new `core/fs/types.ts` holds `FileSystem`, removing the pdf → download reverse dependency.
- **Store convergence**: `daily` store parameterized (caller injects blacklist / favorite tags / proxy config); `saveToLibrary` store writes are injected.
- **Duplication removal**: `web/library/uid.ts` unifies `uid()`; `useDownloadTask.enqueueAlbum` converges the "addBatch + find + startDownload" flow across Home / Tasks / Settings.
- **Unified net retry**: new `requestWithRetry` shared by Fetch and native clients.
- **API split**: `core/api` split into `client.ts` (auth & retry) + `parse.ts` (pure parsing) + barrel.
- **SettingsScreen split**: repair orchestration extracted to a `useLibraryRepair` hook; `usePlatformBack` renamed `reader-lifecycle`.
- **Performance**: library persistence now debounced 400ms batch write with `beforeunload` flush; App warms covers only on items change; screen map hoisted to a module constant.
- Regression: `bun test` 70 cases / typecheck / lint all green.

## 2026-08-25

### Pages-only download (default webp)

- `DownloadService` no longer calls `createAlbumPdf`; `done` carries `albumDir`.
- `imageFormat` (webp/jpg) flows into decode; `decideImageStrategy`: `num<=1` and non-webp → `raw`.
- verify / Node runtime / tests updated.

### Reader: simpler image binding

- Added `image-loader.applyToImg`; scroll window ±1/+8 with page-node pooling; removed the complex decode queue.

### Library repair + confirm dialog

- `repairLibrary` three checks: metadata / format+count / cover; Settings deletes dirs and re-queues.
- New `ConfirmDialog` for library delete and repair confirms.

### Cover preload + task cards

- `coverCache` + App subscription warm-up to stop tab-switch cover layout jump.
- Task cards drop the check icon; leave anim uses GSAP height collapse; auto-remove timer is one-shot.

### Reader: instant direct image reading

- **Direct image reading as the primary path**: downloads keep `albumDir/pages/`; pdf.js is legacy-only.
- **One-shot directory URI resolve**: `loadImageDocMeta` fills all `srcs` as `baseSrc + filename`.
- **Imperative windowed scroll**: no React state during scroll; fixed slot heights; Map-tracked nodes.
- **Paged one-page-at-a-time**: three-slide track; at most one page on release.
- **Long-album bench (1214052)**: 243 pages / ~792KB avg; images ~154s.

### Cirrus palette

- `src/web/theme/index.css` maps Cirrus design tokens; hardcoded colors replaced with CSS variables.

### Download and merge optimizations

- **Serial download queue**: `src/web/download/queue.ts` (`MAX_CONCURRENT = 1`).
- **Batched PDF merge** (optional archive path): 16 chunks per `appendFile`.

### Cleanup

- Comments kept English-only for blocks; dead CSS removed.

## 2026-08-23

### Capacitor Full-Pipeline Migration

- **Architecture switch**: dropped React Native + Metro for a Capacitor architecture (React Web + Bun build + Capacitor shell).
- **Dependency cleanup**: removed the whole RN ecosystem (react-native, metro, babel, @react-navigation, react-native-*, etc.) and the iOS project.
- **New dependencies**: `@capacitor/*` (core / cli / android / filesystem / preferences), `pdf-lib`, `react-dom`.
- **Runtime rewrites**:
  - `transcode/decode.ts`: Skia → Web Canvas (`createImageBitmap` + `drawImage` strip reassembly).
  - `pdf/index.ts`: images-to-pdf → pdf-lib (`embedPng/Jpg` + uniform-width pages).
  - `download/runtime.ts`: blob-util → Capacitor Filesystem, plus an in-memory Web implementation.
  - `data/settings.ts`: AsyncStorage → Capacitor Preferences (native) + localStorage (Web).
- **Networking**: `HttpClient` is now an interface; `AxiosHttpClient` (Web/Node) + `NativeHttpClient` (CapacitorHttp native stack, bypassing CORS).
- **UI layer**: `src/app/` (RN) → `src/web/` (React DOM + CSS), lightweight tab switching replaces React Navigation, inline SVG replaces react-native-svg, styles fully externalized to CSS.
- **Build & run**: `bun build` → `dist/` → `cap sync/run android`; `scripts/dev-android.sh` now prefers physical devices.
- **Tests**: Jest → `bun test` (50 cases green), typecheck / lint / build pass, Android APK builds successfully.
- **Smoke test**: real download of 1327951 produced a complete PDF (50 pages, uniform 960px width, no padding).

## 2026-08-22

### PDF Collage Fix

- **Problem**: generated PDFs showed tiny images + large white placeholders and wrong page sizes.
- **Root cause**: ImageMagick left virtual-page metadata after strip cropping; after `-append` the virtual page stayed at the first strip's height, so the PDF MediaBox was set to that wrong height and full images were squeezed into short pages.
- **Fix**: added `+repage` after `-append` in `decodeWithMagick`, and `+repage` on the inputs before assembly in `createPdfWithMagick`.
- **Verified**: pages all 960pt wide with full image sizes (670~1386pt), no white placeholders.

### Uniform PDF Page Width

- Added `src/core/pdf/layout.ts`: `computeUniformWidth` (target width = min(max source width, 1190)) and `scaleSize` (proportional scaling).
- Node runtime: `identify` all widths then one `-resize`.
- The download orchestrator records each decoded page's size; `buildPdfPages(imagePaths, sizes?)` builds pages at actual dimensions with `imageFit: 'fill'`.
- Mixed-width test: 200x300 + 400x600 unified to 400x600 with no padding.

### Pipeline Completed

- `DownloadService` uses `ApiClient` as `ContentSource`, with fallback for single-chapter empty series.
- Extracted the `DownloadRuntime` interface to `src/core/download/types.ts`.
- `scripts/node-runtime.ts`: ImageMagick decode + PDF generation.
- Full verification of album 1327951 (50-page PDF).

### Config Externalized

- Added `src/config/app-config.json` centralizing domains, secrets, request headers, download concurrency and PDF params.
- All core modules read from config; hardcoded values removed.

## 2026-08-21

### API Channel Working

- Implemented `ApiClient`: dynamic domain refresh (AES-decrypted domain list), token generation, response decryption, image URL construction.
- Fixed AES-256-ECB key derivation: 32-byte ASCII of `md5(secret + ts)` as the key, matching the Python jmcomic library.
- Pure-TS Base64 / UTF-8 decoding replaced Node-only APIs.
- Conclusion: the HTML channel is DNS-blocked in the current network; the API channel works.

### Project Rewrite

- Rewrote the Android (Java) project from scratch in TypeScript.
- Cleaned up the legacy Gradle project; pure TS (no `.js` files).
- Removed the stale internal npm mirror config in `~/.npmrc`.
