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

A few minutes later you'll see the finished PDF in `temp/1327951/`:

```
temp/1327951/[五月雨汉化组]实际上只是、想在一起.pdf  （50 pages）
```

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

Or step by step:

```bash
bun run build            # build web assets
bunx cap sync android    # sync into the native project
bunx cap run android     # build, install and launch
```
