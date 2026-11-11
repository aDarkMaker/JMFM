# 环境准备

## 工具链

| 工具 | 版本要求 | 说明 |
|---|---|---|
| Node.js | >= 22.11 | Bun 运行时依赖 |
| Bun | 任意近期版本 | 包管理器 + 构建器，替换 npm/yarn |
| ImageMagick | 任意 | Node 端图片解码（verify 脚本） |
| JDK | 21+ | Capacitor 8 要求（`brew install openjdk@21`） |
| Android SDK | API 36 | Android 构建 |

## 安装 ImageMagick

```bash
brew install imagemagick
```

## 安装依赖

```bash
bun install
```

## 环境变量

| 变量 | 用途 |
|---|---|
| `JMF_PROXY` | 可选。如 `http://127.0.0.1:7890`，网络受限时使用 |

## 常用脚本

```bash
bash scripts/install-git-hooks.sh  # 首次 clone：启用 pre-commit 门禁与 push 前版本 bump 交互
bun run dev:web          # 纯浏览器调试：Bun HTML server（HMR 关闭，刷新取改），终端回流页面日志
bun run dev:android      # 真机连局域网 dev server：cap run android -l（跳过 build）
bun run dev:android:usb  # USB 调试：adb reverse tcp:3000 + localhost 地址
bun run dev:apk          # debug APK 内置局域网 dev server，装机免数据线
bun run build            # 构建 Web 产物到 dist/
bunx cap sync android    # 同步到 Android 原生工程
bunx cap run android     # 构建 + 安装 + 启动（真机/模拟器）
bash scripts/dev-android.sh   # 一键开发：build → sync → 真机优先运行
bun run apk              # 一键打 debug APK → dist-apk/jmfmobile-debug.apk
bun run apk:release      # 一键打 release APK → dist-apk/jmfmobile-release.apk
# 推送到 main（应用改动）会自动更新 GitHub Releases 的 JMFM.apk
bun run test             # bun test 单测（28 文件 / 235 用例）
bun run typecheck
bun run lint
bun run check            # 五道门禁：icons / tokens / ui / i18n / debug + release 一致性
bun run verify           # Node 端完整下载链路验证（pages + 封面）
```

## 代码门禁

| 脚本 | 约束 |
| --- | --- |
| `check:icons` | 图标唯一性、生成物漂移、零引用 |
| `check:tokens` | 禁裸 hex/rgba、禁非 token 的 padding/margin/gap、禁 `calc(var(--z-*) ± N)` |
| `check:ui` | `ui/` 每目录 `index.tsx` + 同名 `.module.css`；`shell.css` 只允许契约类 |
| `check:i18n` | `t()` key 存在性、未使用 key、CJK 字面量、`IconButton` 缺 `label` |
| `check:debug` | 生产代码禁 `console.log/info/debug`、`debugger`、`alert` |
| `check:release` | `package.json` / `version.json` / 派生 `versionCode` 一致 |

`.githooks/pre-commit` 与 `release-apk.yml` 均会在构建前执行 `bun run check`。

## 版本与更新

- 版本号：`version.json`（与 `package.json` 同步）
- push `main` 前可通过 git hook 选择 bump 版本
- CI 发布 `JMFM.apk` + `version.json`（含 `apkSha256` / `apkSize`）到 GitHub Latest Release
- 应用内：设置 → 检查更新（Android）；多源回退 + 多镜像续传，可配置强制更新阈值

## 提交 · 打包 · 发布

### 提交

`.githooks/pre-commit` 会跑 `lint` → `typecheck` → `check`，任一失败即中断提交。首次 clone 需启用：

```bash
bash scripts/install-git-hooks.sh   # core.hooksPath=.githooks + alias.jmfpush
```

推 `main` 用 `jmfpush`（裸 `git push` 不会触发版本 bump）：

```bash
git add <你改的文件>
git commit -m "type(scope): subject"
git jmfpush origin main             # 交互选 1 minor / 2 major / 3 skip
```

`jmfpush` 会先 bump `version.json` + `package.json` 并单独提交，再推；非交互环境用 `JMFM_VERSION_BUMP=minor|major|skip`。

### 本地打包

```bash
bun run build          # 只出 Web 产物到 dist/
bun run apk            # debug APK → dist-apk/jmfmobile-debug.apk
bun run apk:release    # release APK → dist-apk/jmfmobile-release.apk
```

`apk:release` 的签名密钥在 `~/.jmf/jmf.keystore`（首次自动生成，口令 `JMF_KEYSTORE_PASS`，缺省 `jmf123456`）；`versionCode` / `versionName` 由 `version.json` 注入 Gradle。换机后需把 keystore 带过去，否则新包无法覆盖安装。

### 发布更新

push `main` 后 `release-apk.yml` 自动执行：门禁 → 读 `version.json` → 还原 Secret 里的 keystore → `apk:release` → 计算 `apkSha256` / `apkSize` → 覆盖 `latest` Release 的两个资产：

| 资产 | 用途 |
| --- | --- |
| `JMFM.apk` | 安装包，应用内下载后校验 SHA-256 再安装 |
| `version.json` | `version` / `versionCode` / `minVersionCode` / `apkSha256` / `apkSize` / `notes` |

应用内「检查更新」按 `versionCode` 比较，`minVersionCode` 低于当前值的客户端被强制更新。改 `version.json` 字段必须同步 `scripts/read-version.ts`、`scripts/bump-version.ts` 与 workflow，否则 `check-release` 会拦下。

## APK 签名

| 场景 | 密钥位置 |
|---|---|
| 本地 release | `~/.jmf/jmf.keystore`（首次 `apk:release` 自动生成） |
| CI | 仓库 Secret：`JMF_KEYSTORE_B64`、`JMF_KEYSTORE_PASS` |
