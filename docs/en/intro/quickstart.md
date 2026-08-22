# Quick Start

From zero to your first comic in a few minutes.

## 1. Prepare the Environment

Make sure you have:

- Node.js >= 22.11
- [Bun](https://bun.sh) (package manager)
- ImageMagick (Node-side decoding and PDF generation)

Install ImageMagick on macOS:

```bash
brew install imagemagick
```

## 2. Install Dependencies

```bash
bun install
```

## 3. Verify the Full Pipeline

No emulator needed — download a real comic directly:

```bash
bun scripts/verify-download.ts 1327951
```

In a few minutes you will find the finished PDF under `temp/1327951/`:

```
temp/1327951/[五月雨汉化组]实际上只是、想在一起.pdf  (50 pages)
```

If downloads fail due to a restricted network, retry through a proxy:

```bash
JMF_PROXY=http://127.0.0.1:7890 bun scripts/verify-download.ts 1327951
```

## 4. Run Quality Checks

```bash
bun run test       # unit tests
bun run typecheck  # type checking
bun run lint       # linting
```

## 5. Try It On Device

The UI is still in design, but the scaffold already boots:

```bash
bun start        # Metro
bun run ios      # iOS simulator
bun run android  # Android emulator
```
