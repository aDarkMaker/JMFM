# 快速开始

从零到第一本漫画，只需几分钟。

## 1. 准备环境

确认已安装：

- Node.js >= 22.11
- [Bun](https://bun.sh)（包管理器 + 构建器）
- ImageMagick（Node 端解码与 PDF 生成）
- JDK 17+ 与 Android SDK（真机调试）

macOS 一键安装 ImageMagick：

```bash
brew install imagemagick
```

## 2. 安装依赖

```bash
bun install
```

## 3. 验证完整链路

无需模拟器，直接下载一本真实漫画：

```bash
bun run verify 1327951
```

几分钟后，你会在 `temp/1327951/` 看到成品 PDF：

```
temp/1327951/[五月雨汉化组]实际上只是、想在一起.pdf  （50 页）
```

如果网络受限导致下载失败，可以挂代理重试：

```bash
JMF_PROXY=http://127.0.0.1:7890 bun run verify 1327951
```

## 4. 跑一遍质量检查

```bash
bun run test       # 单元测试
bun run typecheck  # 类型检查
bun run lint       # 代码规范
```

## 5. 在手机上体验

连接 Android 真机（开启 USB 调试）后一键构建运行：

```bash
bash scripts/dev-android.sh
```

或手动分步：

```bash
bun run build            # 构建 Web 产物
bunx cap sync android    # 同步到原生工程
bunx cap run android     # 构建安装启动
```
