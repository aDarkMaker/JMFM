# Changelog

## 2026-08-25

### Reader: instant direct image reading

- **Direct image reading as the primary path**: downloads keep the `albumDir/pages/` image sequence; the reader renders local images directly with progressive prefetch (`loadImageDocMeta` → on-demand `getUri` → batched background prefetch). pdf.js is only a fallback for legacy files.
- **Instant opening**: `setMeta` no longer waits for the prefetch; the first frame renders placeholders immediately plus the first screen's srcs; `saveToLibrary` pre-warms the first 6 pages, so opening from the library shows the first screen instantly.
- **Windowed scroll rendering** (mirroring the native RecyclerView model): scroll mode mounts only the current page ±3/+6, with spacers sized by each page's aspect ratio carrying the total height; pages leaving the window unmount. `onScroll` now uses rAF throttling plus pure arithmetic binary search instead of per-frame `querySelectorAll` and forced layout reads.
- **Paged mode initial size fix**: fit-to-width is now width-driven instead of `transform: scale`, with a `ResizeObserver`; flipped pages fit the screen width without being cropped.
- **Performance details**: `decoding="async"`, `PREFETCH_BATCH` reduced from 20 to 6 to avoid a bridge storm, `PREFETCH_AHEAD` narrowed to 8, and img node refs cached instead of re-querying.

### Task card layout fix

- `.task-head` now uses CSS Grid: icon 10% / title 60% / badge 30% (title 70% / badge 30% without an icon); the badge is right-aligned, icon and title stay on the same visual baseline, and long titles ellipsize.

### Cirrus palette

- `src/web/theme/index.css` maps Cirrus design tokens; hardcoded component colors were replaced with CSS variables.

### Download and merge optimizations

- **Serial download queue**: new `src/web/download/queue.ts` (`MAX_CONCURRENT = 1`); when one download pauses or fails the next starts automatically, avoiding disk/decode contention.
- **Batched PDF merge**: `createWorkerPdf` batches on the main thread and appends 16 chunks per `appendFile`, cutting bridge calls roughly 15×.

### Cleanup

- Chinese comments translated to English, keeping English block comments; `ReaderScreen` reuses `ImageReaderHandle` instead of an inline ref type; dead CSS rules removed.

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
