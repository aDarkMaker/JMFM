# 快速开始

## 1. 准备环境

- Node.js >= 22.11
- [Bun](https://bun.sh)
- ImageMagick（Node 端解码）
- JDK 21+ 与 Android SDK（真机调试）

macOS：

```bash
brew install imagemagick
```

## 2. 安装依赖

```bash
bun install
```

## 3. 验证下载链路

```bash
bun run verify 1327951
```

产物在 `temp/<标题>/pages/`（图片序列）与 `temp/<专辑ID>_cover.jpg`。

网络受限时挂代理：

```bash
JMF_PROXY=http://127.0.0.1:7890 bun run verify 1327951
```

## 4. 质量检查

```bash
bun run test       # 单元测试
bun run typecheck  # 类型检查
bun run lint       # 代码规范
```

## 5. 真机运行

连接 Android 真机（USB 调试）：

```bash
bash scripts/dev-android.sh
```

或直接打 APK：

```bash
bun run apk            # → dist-apk/jmfmobile-debug.apk
bun run apk:release    # → dist-apk/jmfmobile-release.apk
```
