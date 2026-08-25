# 产品介绍

JMFM 是禁漫天堂的漫画下载器。Capacitor + React Web + TypeScript，输入专辑 ID 即可走完整下载链路。

## 为什么要做 JMFM

源站图片被切成打乱顺序的条带，直接保存无法阅读；网页入口常被 DNS 封锁；页面宽度不一，PDF 排版参差。JMFM 用 API 通道取数，条带算法重组，输出统一格式的本地 pages/。

## 它如何工作

1. **取数** — 移动端 API，启动时刷新可用域名。
2. **重组** — getNum 算切分数，裁剪条带、逆序拼接。
3. **落盘** — 写入 `albumDir/pages/`（默认 webp）；阅读器直读本地图片。PDF 为可选归档。

## 技术选型

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Capacitor 8 + React Web | Web UI 跑在原生壳内 |
| 语言 | TypeScript | |
| 构建 | Bun | |
| 网络 | axios + CapacitorHttp | 域名轮换、重试、代理；真机走原生栈 |
| 加解密 | crypto-js | MD5、AES-256-ECB |
| 图片解码（真机/Web） | Web Canvas | 条带重组 |
| PDF 生成 | pdf-lib | 可选归档，统一宽度 |
| 图片解码（Node） | ImageMagick | verify 脚本验证链路 |
| 存储 | Capacitor Filesystem / Preferences | |
| 测试 | bun test | 核心算法单测 |

## 当前状态

下载 pages、本地阅读、资源库、串行队列、资源修复均已可用。`bun run apk` 可打包 Android 安装包。
