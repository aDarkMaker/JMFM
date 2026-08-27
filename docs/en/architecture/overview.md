# Architecture Overview

JMFM follows a frontend/backend split: `src/config` holds centralized configuration, `src/core` carries all business logic, and `src/web` is the React Web UI running inside the Capacitor shell.

## Directory Layout

```
src/
  config/                 # Centralized config (app-config.json + typed loader)
    app-config.json
    index.ts
  core/                   # Business core, UI-free
    api/                  # API 通道（client 请求鉴权重试 + parse 纯解析）
    constants/            # 常量（算法阈值、请求参数、PDF 尺寸）
    crypto/               # MD5 / AES-256-ECB
    model/                # 领域模型（Album / Photo / ImageItem / blocklist）
    net/                  # HttpClient 接口 + Fetch / Capacitor 原生实现 + 重试
    fs/                   # 文件系统接口抽象
    pdf/                  # PDF 布局（统一宽度、尺寸计算）
    transcode/            # 条带计算 + 图片重组
    download/             # 下载编排（DownloadService + pages.ts 共享页面下载 + Runtime 抽象）
    util/                 # UTF-8 / Base64 / SHA-256 工具
  data/                   # 统一持久化（user-storage：Preferences / localStorage）
  web/                    # UI layer (React DOM + CSS, runs in Capacitor shell)
    assets/               # Icons (Iconify SVG) and fonts
    components/           # Presentational components
    download/             # Download serial queue
    hooks/                # download / cover / keyboard / gesture / repair hooks
    library/              # insert / cover / cover cache / path remap / incremental repair / daily / cache / dismissed
    reader/               # direct image reading (image-doc / image-loader / image-reader / pdf-doc)
    screens/              # 5 screens (Home / Library / Tasks / Settings / Reader)
    stores/               # zustand stores
    styles/               # CSS style modules
    theme/                # Cirrus design tokens (CSS variables)
    generated/            # icons.ts (generated from SVG)
    App.tsx / main.tsx / index.html
__tests__/                # unit tests; helpers/ holds test-only code
scripts/
  verify-download.ts      # Node-side full pipeline verification
  node-runtime.ts         # Node runtime (ImageMagick decode + PDF)
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
    pdf[core/pdf]
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
    pdf -.->|optional archive| rnt
```

- **net / api / model**: data fetching and modeling.
- **transcode**: pure algorithms for image restoration.
- **download**: orchestration on `DownloadRuntime`; the hot path writes `pages/` only.
- **runtime**: Capacitor native (Filesystem + Canvas), in-memory Web, and Node (ImageMagick) share one interface; `createAlbumPdf` remains for optional archives.

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
    pages -.-> pdf2[createAlbumPdf optional]
```

## Design Principles

- **Interface isolation**: `ContentSource` for fetch; `DownloadRuntime` for write/decode — core stays UI-free.
- **Pure functions**: `getNum`, `computeStrips`, `computeUniformWidth`, `scaleSize` are unit-testable.
- **Config-driven**: domains, secrets, headers, PDF params from `app-config.json`.
- **Pluggable HttpClient**: Web uses `FetchHttpClient`; device uses `NativeHttpClient` (bypasses CORS, with fetch fallback), selected via `Capacitor.isNativePlatform()`; axios only for Node scripts (`scripts/shared/axios-http.ts`).
- **Unified retry**: `requestWithRetry` in `core/net/retry.ts` centralizes the domain-rotation × retry loop shared by Fetch and native impls.
- **Domain protocol**: each domain tries `https://` first, then `http://` as fallback.
- **pages primary path**: downloads write `pages/` only (default webp); reader renders local images; PDF optional, legacy PDFs via pdf.js.
- **Serial queue**: `src/web/download/queue.ts`, `MAX_CONCURRENT = 1`; pause/fail advances to next.
- **Cover preload**: `coverCache` pre-decodes cover URIs on start / library change to reduce tab-switch layout jump.
- **Unified persistence**: `data/user-storage.ts` abstracts Preferences (native) / localStorage (web).
- **Repair files**: Settings scans the library and backfills missing pages, covers, and metadata.
- **Daily recommendations**: whitelist first → favorite tags → shuffled fill; cached per day with dismiss support.
