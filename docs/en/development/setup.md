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
bash scripts/install-git-hooks.sh  # first clone: pre-commit gates + pre-push version bump
bun run dev:web          # browser-only: Bun HTML server (HMR off for CSS Modules), page logs piped to the terminal
bun run dev:android      # device → LAN dev server: cap run android -l (skips build)
bun run dev:android:usb  # USB debugging: adb reverse tcp:3000 + localhost address
bun run dev:apk          # debug APK with a LAN dev server baked in, no cable needed
bun run build            # build web assets to dist/
bunx cap sync android    # sync into the Android native project
bunx cap run android     # build + install + launch (device/emulator)
bash scripts/dev-android.sh   # one-shot dev: build → sync → run (device first)
bun run apk              # one-shot debug APK → dist-apk/jmfmobile-debug.apk
bun run apk:release      # one-shot release APK → dist-apk/jmfmobile-release.apk
# pushes to main (app changes) auto-update GitHub Releases JMFM.apk
bun run test             # bun test unit tests (28 files / 235 cases)
bun run typecheck
bun run lint
bun run check            # five gates: icons / tokens / ui / i18n / debug + release consistency
bun run verify           # Node-side full download pipeline (pages + cover)
```

## Code gates

| Script | Enforcement |
| --- | --- |
| `check:icons` | icon uniqueness, generated drift, unused references |
| `check:tokens` | no raw hex/rgba, no non-token padding/margin/gap, no `calc(var(--z-*) ± N)` |
| `check:ui` | every `ui/` folder needs `index.tsx` + matching `.module.css`; `shell.css` only contract classes |
| `check:i18n` | `t()` key existence, unused keys, CJK literals, `IconButton` without `label` |
| `check:debug` | production code forbids `console.log/info/debug`, `debugger`, `alert` |
| `check:release` | `package.json` / `version.json` / derived `versionCode` consistency |

Both `.githooks/pre-commit` and `release-apk.yml` run `bun run check` before building.

## Version & updates

- Version source: `version.json` (synced with `package.json`)
- Optional version bump via git hook before pushing to `main`
- CI publishes `JMFM.apk` + `version.json` (with `apkSha256` / `apkSize`) to GitHub Latest Release
- In-app: Settings → Check for updates (Android); multi-source fallback + multi-mirror resume with an optional forced-update threshold

## Commit, package, release

### Commit

`.githooks/pre-commit` runs `lint` → `typecheck` → `check` and aborts the commit on any failure. Enable the hooks once per clone:

```bash
bash scripts/install-git-hooks.sh   # core.hooksPath=.githooks + alias.jmfpush
```

Push `main` through `jmfpush` (a bare `git push` does not offer the version bump):

```bash
git add <files you changed>
git commit -m "type(scope): subject"
git jmfpush origin main             # choose 1 minor / 2 major / 3 skip
```

`jmfpush` bumps `version.json` + `package.json`, commits that on its own, then pushes. Non-interactive runs read `JMFM_VERSION_BUMP=minor|major|skip`.

### Local packaging

```bash
bun run build          # web assets only → dist/
bun run apk            # debug APK → dist-apk/jmfmobile-debug.apk
bun run apk:release    # release APK → dist-apk/jmfmobile-release.apk
```

`apk:release` signs with `~/.jmf/jmf.keystore` (generated on first run, password from `JMF_KEYSTORE_PASS`, default `jmf123456`); `versionCode` / `versionName` are injected into Gradle from `version.json`. Carry the keystore to a new machine, otherwise builds cannot install over the existing app.

### Publishing an update

Pushing `main` makes `release-apk.yml` run: gates → read `version.json` → restore the keystore from secrets → `apk:release` → compute `apkSha256` / `apkSize` → overwrite the two assets of the `latest` release:

| Asset | Purpose |
| --- | --- |
| `JMFM.apk` | installer; the app verifies its SHA-256 before installing |
| `version.json` | `version` / `versionCode` / `minVersionCode` / `apkSha256` / `apkSize` / `notes` |

In-app update compares `versionCode`; clients below `minVersionCode` must update. Changing a `version.json` field requires updating `scripts/read-version.ts`, `scripts/bump-version.ts` and the workflow together, otherwise `check-release` fails.

## APK signing

| Context | Keystore |
|---|---|
| Local release | `~/.jmf/jmf.keystore` (auto-created on first `apk:release`) |
| CI | Repository secrets: `JMF_KEYSTORE_B64`, `JMF_KEYSTORE_PASS` |
