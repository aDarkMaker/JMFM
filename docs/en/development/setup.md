# Setup

## Toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 22.11 | required by RN 0.87 |
| Bun | any recent | package manager, replaces npm/yarn |
| ImageMagick | any | Node-side image decode and PDF generation (`magick` command) |
| Xcode | RN-compatible | iOS builds only |
| Android Studio | RN-compatible | Android builds only |

## Install ImageMagick

```bash
brew install imagemagick
```

## Install Dependencies

```bash
bun install
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `JMF_PROXY` | Optional. e.g. `http://127.0.0.1:7890`, useful on restricted networks |

## Common Scripts

```bash
bun start        # start Metro
bun run ios      # iOS
bun run android  # Android
bun run test     # unit tests
bun run typecheck
bun run lint
bun scripts/verify-download.ts <albumId>   # Node pipeline verification
```
