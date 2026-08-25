# Quick Start

## 1. Prepare the environment

- Node.js >= 22.11
- [Bun](https://bun.sh)
- ImageMagick (Node-side decode and PDF)
- JDK 17+ and Android SDK (device debugging)

macOS:

```bash
brew install imagemagick
```

## 2. Install dependencies

```bash
bun install
```

## 3. Verify the download pipeline

```bash
bun run verify 1327951
```

Output under `temp/1327951/` (including the `pages/` image sequence).

On a restricted network, use a proxy:

```bash
JMF_PROXY=http://127.0.0.1:7890 bun run verify 1327951
```

## 4. Quality checks

```bash
bun run test       # unit tests
bun run typecheck  # type checking
bun run lint       # linting
```

## 5. Run on device

Connect an Android device (USB debugging enabled):

```bash
bash scripts/dev-android.sh
```

Or build an APK:

```bash
bun run apk            # → dist-apk/jmfmobile-debug.apk
bun run apk:release    # → dist-apk/jmfmobile-release.apk
```
