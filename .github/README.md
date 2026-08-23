# JMFM

> 禁漫天堂（JMComic）漫画下载器 — 一个 ID，一键直出高质量 PDF。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178c6.svg)](https://www.typescriptlang.org)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119eff.svg)](https://capacitorjs.com)

JMFM 是一款面向漫画爱好者的专属下载工具。输入禁漫天堂的专辑 ID，即可自动完成数据解析、图片解密重组，并输出**页面等宽、无白边、以标题命名**的高质量 PDF，离线也能畅快阅读。

## 特性

- **稳定获取**：移动端 API 通道 + 动态域名刷新，规避网页通道的 DNS 封锁。
- **还原原图**：条带分割算法 `getNum` 逆序重排，恢复被拆分的完整画面。
- **统一排版**：全部页面等比例缩放到统一宽度，动态取最优尺寸，无白色占位。
- **配置外置**：域名、密钥、请求参数集中在 `app-config.json`，无需改码即可维护。
- **多运行时可测**：Node 脚本可跑通完整链路，Capacitor / Web / Node 运行时共用同一接口。

## 快速开始

```bash
bun install
bun run verify 1327951
```

输出：`temp/1327951/[五月雨汉化组]实际上只是、想在一起.pdf`

> 网络受限时可设置 `JMF_PROXY=http://127.0.0.1:7890`。

## 文档

完整的项目文档（产品介绍、架构设计、开发指南）以中英双语发布，请访问：

- 中文 Wiki：[https://adarkmaker.github.io/JMFM/](https://adarkmaker.github.io/JMFM/)
- English Wiki：[https://adarkmaker.github.io/JMFM/en/](https://adarkmaker.github.io/JMFM/en/)
- 源码文档目录：[docs/](./docs/)

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 框架 | Capacitor 8 + React Web |
| 语言 | TypeScript |
| 构建 | Bun |
| 网络 | axios + CapacitorHttp（域名轮换 / 重试 / 代理） |
| 加解密 | crypto-js（MD5 / AES-256-ECB） |
| 图片解码（真机/Web） | Web Canvas |
| PDF 生成 | pdf-lib |
| 图片解码（Node） | ImageMagick |
| 存储 | Capacitor Filesystem / Preferences |
| 测试 | bun test |

## 项目结构

```
src/
  config/   # 集中配置（域名、密钥、PDF 参数）
  core/     # 业务核心（api / net / model / transcode / pdf / download）
  web/      # UI 层（React DOM + CSS，运行于 Capacitor 壳）
scripts/    # Node 端验证脚本与运行时
android/    # Capacitor 生成的 Android 原生工程
docs/       # VitePress 双语文档
```

## 开发

```bash
bun run test       # 单元测试
bun run typecheck  # 类型检查
bun run lint       # 代码规范
```

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。

---

**免责声明**：本项目仅供个人学习与研究使用，请勿用于商业用途或传播受版权保护的内容。
