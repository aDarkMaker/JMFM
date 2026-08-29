# Environment Setup

## Toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 22.11 | Bun runtime dependency |
| Bun | any recent | package manager + bundler, replaces npm/yarn |
| ImageMagick | any | Node-side image decode (verify script) |
| JDK | 21+ | required by Capacitor 8 (`brew install openjdk@21`) |
| Android SDK | API 36 | Android builds |

## Install ImageMagick

```bash
brew install imagemagick
```

## Install dependencies

```bash
bun install
```

## Environment variables

| Variable | Purpose |
|---|---|
| `JMF_PROXY` | optional, e.g. `http://127.0.0.1:7890`, for restricted networks |

## Common scripts

```bash
bun run build            # build web assets to dist/
bunx cap sync android    # sync into the Android native project
bunx cap run android     # build + install + launch (device/emulator)
bash scripts/dev-android.sh   # one-shot dev: build → sync → run (device first)
bun run apk              # one-shot debug APK → dist-apk/jmfmobile-debug.apk
bun run apk:release      # one-shot release APK → dist-apk/jmfmobile-release.apk
# pushes to main (app changes) auto-update GitHub Releases JMFM.apk
bun run test             # bun test unit tests
bun run typecheck
bun run lint
bun run verify           # Node-side full download pipeline (pages + cover)
```

## Version & updates

- Version source: `version.json` (synced with `package.json`)
- Optional version bump via git hook before pushing to `main`
- CI publishes `JMFM.apk` + `version.json` (with `apkSha256`) to GitHub Latest Release
- In-app: Settings → Check for updates (Android)

## APK signing

| Context | Keystore |
|---|---|
| Local release | `~/.jmf/jmf.keystore` (auto-created on first `apk:release`) |
| CI | Repository secrets: `JMF_KEYSTORE_B64`, `JMF_KEYSTORE_PASS` |
