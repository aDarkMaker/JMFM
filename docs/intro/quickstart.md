# 快速开始

## 环境要求

- Node.js >= 22.11
- [Bun](https://bun.sh)（包管理器）
- ImageMagick（Node 端图片解码与 PDF 生成，`magick` 命令）

```bash
brew install imagemagick
```

## 安装依赖

```bash
bun install
```

## 验证完整链路（Node）

无需模拟器，直接下载一个真实专辑并生成 PDF：

```bash
bun scripts/verify-download.ts 1327951
```

- 输出目录：`temp/1327951/`
- 生成文件：`temp/1327951/[五月雨汉化组]实际上只是、想在一起.pdf`（50 页）

如网络受限（域名被封锁），可配置代理：

```bash
JMF_PROXY=http://127.0.0.1:7890 bun scripts/verify-download.ts 1327951
```

## 运行测试与检查

```bash
bun run test       # Jest 单测
bun run typecheck  # tsc --noEmit
bun run lint       # ESLint
```

## 在手机上运行

UI 尚未设计，但脚手架可启动：

```bash
bun start        # Metro
bun run ios      # iOS 模拟器
bun run android  # Android 模拟器
```
