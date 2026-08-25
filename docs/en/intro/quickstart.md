# Quick Start

From zero to your first comic in a few minutes.

## 1. Prepare the environment

Make sure you have:

- Node.js >= 22.11
- [Bun](https://bun.sh) (package manager + bundler)
- ImageMagick (Node-side decode and PDF generation)
- JDK 17+ and Android SDK (for device debugging)

Install ImageMagick on macOS in one shot:

```bash
brew install imagemagick
```

## 2. Install dependencies

```bash
bun install
```

## 3. Verify the full pipeline

No emulator needed — download a real comic directly:

```bash
bun run verify 1327951
```

A few minutes later you'll see download artifacts under `temp/1327951/` (including the `pages/` image sequence).

If downloads fail on a restricted network, retry with a proxy:

```bash
JMF_PROXY=http://127.0.0.1:7890 bun run verify 1327951
```

## 4. Run the quality checks

```bash
bun run test       # unit tests
bun run typecheck  # type checking
bun run lint       # linting
```

## 5. Try it on your phone

Connect an Android device (USB debugging enabled) and run in one shot:

```bash
bash scripts/dev-android.sh
```

Or build an APK directly:

```bash
bun run apk            # → dist-apk/jmfmobile-debug.apk
bun run apk:release    # → dist-apk/jmfmobile-release.apk
```
