# Architecture Overview

JMFM follows a frontend/backend split: `src/config` holds centralized configuration, `src/core` carries all business logic, and `src/web` is the React Web UI running inside the Capacitor shell.

## Directory Layout

```
src/
  config/                 # Centralized config (app-config.json + typed loader)
    app-config.json
    index.ts
  core/                   # Business core, UI-free
    api/                  # API channel (client auth & retry + parse pure parsing + shared domains)
    constants/            # Constants (algorithm thresholds, request params, sort & category)
    crypto/               # MD5 / AES-256-ECB
    model/                # Domain models (Album / Photo / ImageItem / blocklist / extension set)
    net/                  # HttpClient interface + Fetch / Capacitor native impls + unified retry
    fs/                   # FileSystem abstraction (atomic writes, SAF adapters)
    transcode/            # Strip math + image reassembly
    download/             # Download orchestration (shared pages + scheduler concurrency/memory + Runtime)
    update/               # In-app updates (manifest contract, multi-source fallback, multi-mirror resume, SHA-256)
    util/                 # UTF-8 / Base64 / SHA-256 / filename sanitizing
  data/                   # Unified persistence (user-storage: Preferences / localStorage; versioned reads)
  web/                    # UI layer (React DOM + CSS, runs in Capacitor shell)
    assets/               # Icons (Iconify SVG) and fonts (woff2)
    features/             # Co-located features: home / library / tasks / settings / detail / discover / search / reader / update / errors
    shared/               # Components used by ≥2 features (Poster / AlbumCard / AlbumRow / SearchBar / Skeletons / ListFooter)
    ui/                   # Base component library (32 folders, index.tsx + matching module.css)
    download/             # Runtime assembly / SAF runtime / task cleanup
    hooks/                # download / cover / keyboard / gesture / repair / update hooks
    i18n/                 # Single dictionary zh-CN.ts + t(key, params)
    library/              # insert / cover / cover cache / path resolve / repair / daily / cache / dismissed
    reader/               # direct image reading (image-doc / image-loader / image-reader / pdf-doc)
    stores/               # zustand stores
    styles/               # fonts.css + shell.css only (25 contract classes + tabbar)
    theme/                # Cirrus design tokens (CSS variables)
    generated/            # icons.ts (generated from SVG)
    App.tsx / main.tsx / index.html
__tests__/                # unit tests (28 files / 235 cases); helpers/ holds test-only code
scripts/
  check-icons.ts          # icon uniqueness / generated drift / unused references
  check-tokens.ts         # raw colors, raw px spacing, calc(var(--z-*)+N)
  check-ui.ts             # ui/ folder contract + global CSS contract-class allowlist
  check-i18n.ts           # t() key existence, unused keys, CJK literals, IconButton label
  check-debug-code.ts     # console.* / debugger / alert
  check-release.ts        # package.json / version.json / versionCode consistency
  verify-download.ts      # Node-side full download pipeline verification
  node-runtime.ts         # Node runtime (ImageMagick decode)
  bench-reader-flow.ts    # reader scroll-window desktop bench
  shared/axios-http.ts    # axios client for scripts only
capacitor.config.ts       # Capacitor config (appId / webDir / plugins)
android/                  # Capacitor-generated Android native project
```

## Layer Dependencies

```mermaid
flowchart LR
    cfg[config]
    api[core/api]
    net[core/net]
    model[core/model]
    trans[core/transcode]
    dl[core/download]
    rnt[runtime]
    pagesOut[albumDir/pages]

    cfg --> net
    cfg --> api
    net --> api
    api --> model
    model --> dl
    dl --> trans
    dl --> rnt
    rnt --> pagesOut
```

- **net / api / model**: data fetching and modeling.
- **transcode**: pure algorithms for image restoration.
- **download**: orchestration on `DownloadRuntime`; the hot path writes `pages/` only.
- **runtime**: Capacitor native (Filesystem + Canvas), SAF, in-memory Web, and Node (ImageMagick) share one interface.

## Full Data Flow

```mermaid
flowchart LR
    id[Album ID] --> api2[ApiClient]
    api2 -->|domains| http[HttpClient]
    api2 -->|AlbumDetail| svc[DownloadService]
    svc -->|chapter| ph[getPhoto]
    svc -->|ImageItem| img[download]
    img --> num[getNum]
    num --> dec[reassemble webp/jpg]
    dec --> pages[albumDir/pages]
    pages --> lib[saveToLibrary]
    lib --> read[image reader]
```

## Design Principles

- **Interface isolation**: `ContentSource` for fetch; `DownloadRuntime` for write/decode — core stays UI-free.
- **Pure functions**: `getNum`, `computeStrips` are unit-testable.
- **Config-driven**: domains, secrets, headers, concurrency, timeouts, update sources and mirrors from `app-config.json`.
- **Pluggable HttpClient**: Web uses `FetchHttpClient`; device uses `NativeHttpClient` (bypasses CORS, with fetch fallback), selected via `Capacitor.isNativePlatform()`; axios only for Node scripts (`scripts/shared/axios-http.ts`).
- **Unified retry**: `requestWithRetry` in `core/net/retry.ts` centralizes the domain-rotation × retry loop; `retryable` distinguishes 4xx/5xx; `fetchOnce` uses `AbortSignal.timeout`.
- **Domain protocol**: each domain tries `https://` first, then `http://` as fallback; `refreshDomains` is shared globally and probed at most once.
- **pages primary path**: downloads write `pages/` only (default webp) with atomic writes (`.tmp` + rename) against half-written files; reader renders local images; legacy PDFs via pdf.js.
- **Serial queue**: `src/web/download/queue.ts`, `MAX_CONCURRENT = 1`; pause/fail advances to next.
- **Download memory control**: `download/scheduler.ts` provides `MemoryGate` byte watermark and `Semaphore` decode throttling.
- **Cover preload**: `coverCache` pre-decodes cover URIs on start / library change; first 8 covers eagerly, the rest lazy.
- **Unified persistence**: `data/user-storage.ts` abstracts Preferences (native) / localStorage (web); keys centralized in `storage-keys.ts`; `readVersioned` / `writeVersioned` add a `{v, data}` envelope and bumping `STORAGE_VERSION` runs migrate.
- **Repair files**: Settings scans and backfills missing pages, covers, and metadata; path changes auto-remap.
- **Daily recommendations**: whitelist first → favorite tags → time-tiered fill (today first, then earlier days); cached per day with dismiss support.
- **In-app updates**: `version.json` contract (`version` / `versionCode` / `minVersionCode` / `apkSha256` / `apkSize` / `notes`) with four-step fallback (GitHub API + `If-None-Match` → raw `version.json` → local cache); `decideUpdate` yields `none | optional | force`; APK tries configured mirrors in order — web resumes `.part` with `Range`, native rotates mirrors — and only installs after SHA-256 matches.
- **Release consistency**: `scripts/check-release.ts` verifies `package.json` / `version.json` / derived `versionCode` agree, and CI runs it before building.
