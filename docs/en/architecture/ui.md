# UI Architecture

The JMFM UI layer lives in `src/web` (React DOM + CSS) inside the Capacitor WebView, fully separated from the business core `src/core`. The UI consumes business capabilities through three entry points only: `ApiClient`, `DownloadService` and `Settings`. It never touches networking, crypto or file logic directly.

## Layering

```mermaid
flowchart TB
    subgraph ui [UI Layer src/web]
        app["App (tab switching)"]
        screens["Screens"]
        stores["Stores (zustand)"]
        components["Components"]
        styles["Styles (CSS)"]
        assets["Assets"]
        app --> screens
        screens --> stores
        screens --> components
        screens --> styles
        components --> styles
        components --> assets
    end

    subgraph core [Business Core src/core]
        api["ApiClient"]
        dl["DownloadService"]
        settings["data/settings"]
    end

    stores --> settings
    screens --> api
    screens --> dl
    stores --> api
```

- **App**: lightweight state-based tab switching hosting the 4 main screens (no routing library).
- **Screens**: page-level components responsible only for composition and event dispatch, with no business implementation.
- **Stores**: zustand stores for UI state, bridging the core services.
- **Components**: presentational components without business semantics.
- **Styles**: all styles are separate CSS files under `src/web/styles/`; tsx files contain no inline style sheets.
- **Assets**: icons (Iconify SVG) and fonts (Alimama / BebasNeue) are stored centrally.

## Navigation

```mermaid
flowchart LR
    root["App"]
    root --> home["Home Daily"]
    root --> lib["Library"]
    root --> tasks["Tasks"]
    root --> settings["Settings"]
    lib -.-> reader["Reader"]
```

### Page table

| Name | Component | Description |
| --- | --- | --- |
| `Home` | `HomeScreen` | daily recommendation feed |
| `Library` | `LibraryScreen` | local library + search + category filters (all / favorite / downloaded / recent) |
| `Tasks` | `TasksScreen` | download queue and progress (serialized) |
| `Settings` | `SettingsScreen` | app settings |
| `Reader` | `ReaderScreen` | reader: direct image reading (new downloads) or pdf.js fallback (legacy PDFs) |

## Screen responsibilities

- **Home**: shows daily recommendation cards (cover, title, author, tags, chapter count). Currently mock-driven; a recommendation API will be wired later.
- **Library**: lists downloaded albums with search and four category filters (all / favorite / downloaded / recent); supports favorite, delete and open.
- **Tasks**: shows the download queue with live progress, supports pause / resume / delete. Multiple albums are serialized through `src/web/download/queue.ts` (`MAX_CONCURRENT = 1`); queued ones show "waiting".
- **Reader**: when `ReaderTarget.pagesDir` exists on a native platform it uses direct image reading (`src/web/reader/image-reader.tsx`): imperative windowed scroll vertically, and a three-slide gesture track for one-page horizontal flips; otherwise it falls back to pdf.js rendering.
- **Settings**: download path, retry count, concurrency, image format, proxy; reads and writes `data/settings`.

## State management

| Store | Responsibility |
| --- | --- |
| `useSettingsStore` | wraps `data/settings` load and persistence (Capacitor Preferences / localStorage) |
| `useDownloadStore` | download task set and progress (pending / running / paused / done / error) |
| `useLibraryStore` | locally downloaded albums (`LibraryItem`, with `pagesDir`), favorite / recent / delete |

## Style system

Built on the Cirrus design tokens in `src/web/theme/index.css` (CSS variables: surface / ink / accent / radii / shadow / spacing / typography / easing).

- Page and component styles live in separate CSS files under `src/web/styles/`; tsx files contain no inline styles.
- Palette: `ink` primary text, `accent-primary` primary action, `accent-success` success, `accent-danger` danger, `surface` surfaces, `shadow-1/2` layered elevation, `ease-spring` springy motion.

## Asset conventions

### Icons

- Source: [Iconify Material Symbols](https://icon-sets.iconify.design/material-symbols/), stored as SVG files in `src/web/assets/icons/`.
- `scripts/gen-icons.ts` generates `src/web/generated/icons.ts` (an SVG string map).
- The `Icon` component renders them inline with `dangerouslySetInnerHTML`; icons use `currentColor`, so the color comes from surrounding CSS.
- Tab icons: `home`, `auto-stories`, `download`, `settings`.

### Fonts

| File | fontFamily | Usage |
| --- | --- | --- |
| `AlimamaShuHeiTi-Bold.woff2/.ttf` | `Alimama ShuHeiTi` | Chinese titles, branding |
| `BebasNeue.woff2` | `Bebas Neue` | Latin and numerals, display type |

- Source fonts are stored in `src/web/assets/fonts/`.
- `src/web/styles/fonts.css` registers them via `@font-face`; Bun build bundles them automatically (small fonts are inlined as data URIs).

## Directory layout

```
src/web/
  assets/
    fonts/                # Alimama / BebasNeue / Nagino
    icons/                # Iconify SVG
  components/             # Icon / AlbumCard / SearchBar / ...
  download/               # download serial queue (queue.ts)
  generated/              # icons.ts (generated)
  hooks/                  # useDownloadTask / useCoverSrc / useKeyboardVisibility / ...
  library/                # library insert and cover handling (saveToLibrary.ts)
  reader/                 # direct image reading (image-doc / image-reader / pdf-doc / paged / scroll)
  screens/                # Home / Library / Tasks / Settings / Reader
  stores/                 # zustand stores
  styles/                 # CSS style modules
  theme/                  # Cirrus tokens (CSS variables)
  App.tsx                 # tab switching + full-screen Reader mount
  main.tsx                # ReactDOM.createRoot entry
  index.html              # WebView host page
```

## Build & run

```bash
bun run build            # bun build → dist/
bunx cap sync android    # sync web assets into the native project
bunx cap run android     # build and run on a connected device
bash scripts/dev-android.sh   # one shot: build → sync → run (device first)
```
