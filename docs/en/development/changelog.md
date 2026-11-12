# Changelog

## 2026-11-12 (Thu)

### 3.7.0 blank-screen fix on device

- **Root cause**: 3.7.0's `--define require=undefined` is a global text substitution, so React's CJS entry `require("./cjs/react.production.js")` also became `(void 0)("./cjs/react.production.js")`. The WebView threw `TypeError: (void 0) is not a function` during the first import and stayed on a blank frame.
- **Fix**: `build` / `build:dev` in `package.json` now call `scripts/build-web.ts` (`Bun.build`). A `crypto` `onResolve` + `onLoad` pair answers with `globalThis.crypto`, so `crypto-js`'s `require('crypto')` branch gets Web Crypto instead of the Node polyfill; `--define` is limited to `__APP_VERSION__` and `process.env.NODE_ENV` and no longer touches `require`. `scripts/version-define.sh` deleted.
- **Size**: entry JS 216KB → 130KB (the 660KB Node crypto polyfill is gone; remaining chunks only carry MD5/AES-ECB), APK 2.40MB → 2.37MB. Verified on an emulator: the release build boots and all four tabs plus lazy chunks work.
- Lesson: `--define` is textual, so never use it to DCE cross-module names like `require`; rewrite module resolution with a plugin instead.

## 2026-11-11 (Wed)

### Bundle diet and runtime performance

- **Build chain fix**: `--define:KEY=VAL` (colon form) is silently ignored by bun 1.3.14, so every release shipped the React development build (515 `jsxDEV` sites). Switched to the space form and added `--define require=undefined` so `crypto-js`'s `require('crypto')` branch is DCE'd (crypto chunk 683KB → 58KB); removed the stale `[define]` in `bunfig.toml` that overrode the version, and updated `scripts/version-define.sh`. Entry 594KB → 216KB.
- **pdf.js fallback removed**: downloads always write `pagesDir`, so `isImageMode` is always true and the PDF path was dead code. Deleted `reader/pdf-doc.ts`, `paged-viewer.ts`, `scroll-viewer.ts`, `useTouchGestures.ts`, the `pdfjs-dist` dependency, the worker copy step and the bench `benchPdf`; `ReaderScreen` now only renders `ImageReader` + toolbar/status, and `reader.pdfError` became `reader.openError`. Saves ~540KB.
- **Font subsetting**: added `scripts/subset-fonts.ts` (`bun run fonts:subset`, needs the system `pyftsubset`, not part of the gates): `nagino` is trimmed to ASCII + punctuation + kana + JIS X 0208 level 1 (1.65MB → 0.70MB) and `Alimama` to ASCII + punctuation + GB2312 level 1 (580KB → 307KB); untouched originals stay in `fonts/source/` and missing glyphs fall back to `--font-body`.
- **Android R8**: release now uses `minifyEnabled` + `shrinkResources` + `proguard-android-optimize.txt`, and `proguard-rules.pro` keeps `SafStoragePlugin`, `Plugin` subclasses, `@PluginMethod` / permission callbacks and Cordova plugins. `classes.dex` 2.5MB → 0.98MB, APK 7.15MB → 2.40MB.
- **Pull-to-refresh**: the whole `.app-screen` is no longer translated (a `transform` creates a containing block and breaks `position: sticky` on the search bar); only `.app-screen.is-pulling > :not(.sticky-chrome)` moves. `touchmove` writes are rAF-coalesced, the listener goes non-passive only while a pull is tracked and calls `preventDefault`, and the full-screen `will-change` is gone.
- **Runtime performance**: dropped `gsap` (tab bounce → Web Animations, discover fade-in → CSS keyframes + `nth-child` delays, task collapse → `el.animate()`); `Discover` / `Search` / `AlbumDetail` are now `React.lazy`; home card callbacks are stable `useCallback`s and `AlbumListSection` forwards `onPress` / `onDownload` directly, so `AlbumRow` memo survives; `albumCard` gained `content-visibility: auto`, `Poster`'s `<img>` gained `loading="lazy"`, and the `hasJapanese` cache is capped at 1000 entries.

### Release-notes rendering and a reworked content filter

- **Release notes**: added `features/update/notes.ts` (`parseNotes` flattens Markdown into heading / bullet / text blocks) and `ReleaseNotes.tsx` (a `--surface-sunken` panel with an "update notes" caption and dotted bullets, capped at `32vh` with its own scroll). `UpdatePrompt` and the settings "check for updates" dialog share it, and the dialog splits into a version line, a metadata row (size / cache / mirror switch) and the notes panel. `ConfirmDialog.message` is now a `ReactNode` and no longer forces `white-space: pre-wrap`.
- **Copy keys**: `update.newVersionPrompt` / `update.newVersionNote` drop the `{notes}` placeholder — notes are no longer inlined into a single line — and `update.notesTitle` is added.
- **Content filter**: black/white lists became one list where each row carries a mode pill (tap to swap) and the composer has a target toggle on the left; `setFilterTag` / `removeFilterTag` own the mutual-exclusion invariant, and clearing asks for confirmation.
- **Detail top offset**: the root cause was cascade order — the global `.nav-scroll` (`padding: 0 …`) is emitted after `detail.module.css`, so at equal specificity it zeroed the scroller's top padding. The inset therefore lives as `padding-top: --space-4` on `.hero` / `.detailHero` (cover and skeleton land on the same Y) while `.heroBg` still fills the whole hero block flush against the bar — no `margin-top`, and no upward bleed that the `overflow-y: auto` scroller would clip into a hard band.
- **Nav icon centring**: `IconButton`'s inner `span` is now `inline-flex` with `line-height: 1`, removing the ~3px rise caused by the line box descent; the back arrow, the title text and the 40×40 button now share one centre line.
- **Gates**: `check-icons` walks `src/` in pure Bun and no longer shells out to `rg`, so the pre-commit hook's restricted PATH still passes.

## 2026-11-10 (Tue)

### Grouped settings cards and a single input source

- **Grouped cards**: added `ui/ListGroup` (a `--surface-card` card with `1px` hairline separators between children, a `--text-xs` caption and an optional `hint`); `ListTile` gains `variant="plain"` so rows inside a card drop their own shadow and use `--surface-sunken` for the pressed state. All five settings groups (display / download / network / content filter / general) now use the card structure, and `ConfirmDialog` moved outside the card so `overflow: hidden` cannot clip it.
- **One input base**: `ui/Input` gains a `flat` variant (sunken pill at `--control-xl`), forwards its ref to the native input, and exposes a `focusRing` switch; `shared/SearchBar` now composes `ui/Input` instead of owning `.bar/.input/.clear` metrics, keeping only host layout and the home expanded outline.
- **Page parity**: the library search field and the tasks ID field are both capsule (`--control-2xl` height, same inset) and sit `--space-3` below their header; tasks shake / invalid behaviour is unchanged.
- **Docs**: UI architecture documents both the grouped-card pattern and the single input source; setup gains a commit / package / release runbook.

## 2026-11-09 (Mon)

### Full standardization refactor

- **Contract & lint**: added `AGENTS.md` and `.cursor/rules/jmfm-conventions.mdc`; ESLint enables `react-hooks/recommended`, `no-console` (warn/error allowed), `consistent-type-imports`, `no-restricted-imports` (no `core → web` reverse dependency, no deep relative imports); every `src/web` relative import became `@/`; `bunfig.toml` injects `__APP_VERSION__`.
- **Dev loop**: added `dev:web` / `dev:android` / `dev:android:usb` / `dev:apk`; the debug manifest allows cleartext only for `localhost`, `127.0.0.1`, `192.168.*`; `dev:web` runs with HMR off (Bun CSS Modules bug oven-sh/bun#18258 — refresh to pick up edits).
- **Design tokens**: `theme/index.css` gains `--control-*`, `--tap-min`, `--z-*` (incl. `--z-fab`), `--grad-metal-*`, `--mask-to-right-fade`, `--shadow-nav`; `app.css` + `navScreen.css` merged into `styles/shell.css`, keeping only the 25 JS-touched contract classes + tabbar; `main.tsx` entry consolidated.
- **Component kit**: new `src/web/ui/` with 32 primitives (each directory `index.tsx` + matching `*.module.css`, barrel-exported), `IconButton` requires `label`; all pages and components migrated, styles moved into colocated modules, legacy global CSS deleted.
- **Structure**: `src/web` co-locates by feature (home / library / tasks / settings / detail / discover / search / reader / update / errors); `SettingsScreen` split into 5 sections + `useLibraryRepair`, `ReaderScreen` split toolbar and status; only ≥2 consumers rise to `shared/`; `DiscoverSections.tsx` and its orphan CSS removed.
- **i18n**: single `zh-CN.ts` dictionary with `t(key, params)` and a typed `MessageKey`, 293 literals extracted; `document.documentElement.lang` set at runtime.
- **Updates & downloads**: `version.json` expands to `version` / `versionCode` / `minVersionCode` / `apkSha256` / `apkSize` / `notes`; `core/update/source.ts` falls back across API (`If-None-Match`) → raw manifest → TTL cache; `decideUpdate` yields `none | optional | force`; APK candidates across mirrors, web `.part` + `Range` resume (206 append / 200 rewrite), native mirror rotation, streaming SHA-256 required before install; `UpdatePrompt` cannot be dismissed when forced.
- **State robustness**: `user-storage` adds `readVersioned` / `writeVersioned` (`{v, data}` envelope + legacy migration), adopted by library / history / settings; failed writes surface "save failed" asynchronously; new `AppErrorBoundary` (render errors + global `error` / `unhandledrejection`) wraps `<App />`.
- **Code gates**: `check-tokens` / `check-ui` / `check-i18n` / `check-debug-code` / `check-release` added; `bun run check` aggregates them and is wired into `.githooks/pre-commit` and CI.
- Regression: `bun test` 235 cases / 28 files, typecheck / lint / build / check all green.

## 2026-08-28 (Fri)

### Full-pipeline optimization & renovation

- **Data safety**: atomic writes for pages/covers/metadata (`.tmp` + rename); `MIN_FILE_BYTES` guards half-written files; SAF unlink delete protection (download root cannot be deleted); failed downloads roll back empty dirs; SAF repair path remap fixed.
- **Download perf**: `FileSystem` writes base64 directly (native/SAF, no double encode); `scheduler.ts` adds `MemoryGate` byte watermark and `Semaphore` decode throttling; `downloadPages` writes pages atomically.
- **APK updates**: streaming chunked download (native slices CapacitorHttp base64 / web streams via reader) with incremental `Sha256` computed on the fly; mismatches clean up and re-download.
- **UI rendering**: Home narrow subscription (`useShallow` on albumIds), `AlbumCard` memo with stable props, lazy covers (first 8 preloaded); `ReaderScreen` is `React.lazy`.
- **Reader**: `loadImageDocMeta` inflight dedupe; SAF resolves only the first 8 URIs and lazily fills on scroll; scroll window narrowed to ±1/+3; paged prefetches page 3 after first paint.
- **Network**: `fetchOnce` times out via `AbortSignal.timeout`; `FetchResult.retryable` distinguishes 4xx/5xx/429; `refreshDomains` is shared globally and probed once.
- **Bundle**: `bun build --minify --splitting`; nagino 4.3MB otf → 1.7MB woff2, redundant ttf removed; pdf.js and ReaderScreen split into separate chunks (entry 0.52MB).
- **Declutter**: all PDF-generation dead code and `pdf-lib` removed; retry/sleep/extensions/filename/base64 duplication merged; `config.app.version` renamed `apiTokenVersion`; CSS dedup.
- **Decoupling**: SAF infra moved to `core/fs/saf`; `cacheRegistry` centralizes cache invalidation; HTTP unified (no `getHtml`); axios/node-html-parser moved to devDependencies; `STORAGE_KEYS` centralizes storage keys.
- Regression: `bun test` 138 cases / 19 files, typecheck / lint / build / verify all green.

## 2026-08-27 (2)

### Security, repair files & recommendations

- **Signing & updates**: keystore out of repo; CI injects secrets; `version.json` carries `apkSha256`; download by release tag with hash check before install.
- **Repair files**: Settings action backfills missing pages, covers, and metadata; removed separate metadata-sync entry.
- **Download layer**: shared page engine in `core/download/pages.ts` for full downloads and repair.
- **Recommendations & persistence**: whitelist tier, language-tag filter, dismiss/refresh; unified `user-storage` for library/daily/dismissed.
- **Network**: HTTPS first, HTTP fallback per domain.
- Docs and comments synced (zh/en architecture / setup).

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
