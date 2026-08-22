# 环境准备

## 工具链

| 工具 | 版本要求 | 说明 |
|---|---|---|
| Node.js | >= 22.11 | RN 0.87 要求 |
| Bun | 任意近期版本 | 包管理器，替换 npm/yarn |
| ImageMagick | 任意 | Node 端图片解码与 PDF 生成（`magick` 命令） |
| Xcode | 对应 RN 版本 | 仅 iOS 构建需要 |
| Android Studio | 对应 RN 版本 | 仅 Android 构建需要 |

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
bun start        # 启动 Metro
bun run ios      # iOS
bun run android  # Android
bun run test     # Jest 单测
bun run typecheck
bun run lint
bun scripts/verify-download.ts <albumId>   # Node 端链路验证
```
