# Architecture Overview

JMFM follows a frontend/backend split: `src/config` holds centralized configuration, `src/core` carries all business logic, and `src/web` is the React Web UI running inside the Capacitor shell.

## Directory Layout

```
src/
  config/                 # Centralized config (app-config.json + typed loader)
    app-config.json
    index.ts
  core/                   # Business core, UI-free
    api/                  # API channel (domains, token, decryption, image URLs)
    constants/            # Constants (algorithm thresholds, request params, PDF sizes)
    crypto/               # MD5 / AES-256-ECB
    model/                # Domain models (Album / Photo / ImageItem)
    net/                  # HttpClient interface + Axios / Capacitor native impls
    parser/               # HTML parsing + Base64 (fallback channel)
    pdf/                  # PDF layout (uniform width, size calculation)
    transcode/            # Strip calculation + image reassembly
    download/             # Download orchestration (DownloadService + Runtime abstraction)
    util/                 # UTF-8 / Base64 utilities
  data/                   # Settings persistence (storage interface) + mock data
  web/                    # UI layer (React DOM + CSS, runs in Capacitor shell)
    assets/               # Icons (Iconify SVG) and fonts
    components/           # Presentational components
    download/             # Download serial queue
    hooks/                # download / cover / keyboard / gesture hooks
    library/              # library insert and cover handling
    reader/               # Direct image reading (image-doc / image-reader / pdf-doc)
    screens/              # 5 screens (Home / Library / Tasks / Settings / Reader)
    stores/               # zustand stores
    styles/               # CSS style modules
    theme/                # Cirrus design tokens (CSS variables)
    generated/            # icons.ts (generated from SVG)
    App.tsx / main.tsx / index.html
scripts/
  verify-download.ts      # Node-side full pipeline verification
  node-runtime.ts         # Node runtime (ImageMagick decode + PDF)
capacitor.config.ts       # Capacitor config (appId / webDir / plugins)
android/                  # Capacitor-generated Android native project
```

## Layer Dependencies

```mermaid
flowchart LR
    cfg["config"]
    api["core/api"]
    net["core/net"]
    model["core/model"]
    trans["core/transcode"]
    dl["core/download"]
    pdf["core/pdf"]
    rnt["runtime (Capacitor/Web/Node)"]
    out["PDF file"]

    cfg --> net
    cfg --> api
    net --> api
    api --> model
    model --> dl
    dl --> trans
    dl --> pdf
    dl --> rnt
    pdf --> out
```

- **net / api / model**: data fetching and modeling.
- **transcode**: pure algorithms for image restoration.
- **download**: orchestration depending on the `DownloadRuntime` interface, never on a concrete implementation.
- **runtime**: Capacitor native (Filesystem + Canvas + pdf-lib), in-memory Web, and Node (ImageMagick) implement the same interface, so switching is seamless.

## Full Data Flow

```mermaid
flowchart LR
    id["Album ID"] --> api2["ApiClient"]
    api2 -->|"dynamic domains"| http["HttpClient"]
    api2 -->|"AlbumDetail"| svc["DownloadService"]
    svc -->|"per chapter"| ph["getPhoto"]
    svc -->|"ImageItem"| img["download image"]
    img --> num["getNum strips"]
    num --> dec["strip reassembly"]
    dec --> pages["albumDir/pages/*.jpg (kept)"]
    pages --> read["reader direct image reading (instant)"]
    dec --> pdf2["PDF generation (archive)"]
    pdf2 --> file["title.pdf"]
```

## Design Principles

- **Interface isolation**: `ContentSource` abstracts the data source; `DownloadRuntime` abstracts runtime capabilities. Business logic never touches UI or a specific runtime.
- **Pure functions first**: `getNum`, `computeStrips`, `computeUniformWidth`, `scaleSize` are pure and directly unit-testable.
- **Config-driven**: domains, secrets, request headers and PDF params all come from `app-config.json`.
- **Pluggable networking**: `HttpClient` is an interface; Web/Node use axios (`AxiosHttpClient`), the device uses the Capacitor native stack (`NativeHttpClient`, bypassing CORS), selected via `Capacitor.isNativePlatform()`.
- **Direct image reading is the primary path**: new downloads keep the `pages/` image sequence; the reader renders local images directly with progressive prefetch for instant opening. PDFs are treated as archive artifacts, rendered by pdf.js only as a fallback for legacy files.
- **Serial download queue**: `src/web/download/queue.ts` serializes multiple downloads with `MAX_CONCURRENT = 1`; when one pauses or fails the next one starts automatically, avoiding disk/decode contention.
