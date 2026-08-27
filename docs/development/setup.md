# 环境准备

## 工具链

| 工具 | 版本要求 | 说明 |
|---|---|---|
| Node.js | >= 22.11 | Bun 运行时依赖 |
| Bun | 任意近期版本 | 包管理器 + 构建器，替换 npm/yarn |
| ImageMagick | 任意 | Node 端图片解码与 PDF 生成（`magick` 命令） |
| JDK | 17+（建议 21） | Android 构建 |
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
bash scripts/install-git-hooks.sh  # 首次 clone：启用 push 前版本 bump 交互
bun run build            # 构建 Web 产物到 dist/
bunx cap sync android    # 同步到 Android 原生工程
bunx cap run android     # 构建 + 安装 + 启动（真机/模拟器）
bash scripts/dev-android.sh   # 一键开发：build → sync → 真机优先运行
bun run apk              # 一键打 debug APK → dist-apk/jmfmobile-debug.apk
bun run apk:release      # 一键打 release APK → dist-apk/jmfmobile-release.apk
# 推送到 main（应用改动）会自动更新 GitHub Releases 的 JMFM.apk
bun run test             # bun test 单测
bun run typecheck
bun run lint
bun run verify           # Node 端完整链路验证（生成真实 PDF）
```

## 版本与更新

- 版本号维护在仓库根目录 `version.json`（同步 `package.json` 的 `version` 字段）
- `scripts/bump-version.ts minor|major` 手动 bump；推荐通过 `install-git-hooks.sh` 在 push `main` 前交互选择
- `versionCode = major * 10000 + minor * 100 + patch`（Android 单调递增）
- CI 发布 `JMFM.apk` + `version.json` 到 GitHub Latest Release
- 应用内：设置 → 检查更新（仅 Android 支持下载安装）
