<div align="center">
  <img src="../img/logo.png" width="160" alt="JMFM logo" />

  # JMFM

  随时随地，想飞就飞 —— 禁漫天堂漫画下载器

  ![Capacitor](https://img.shields.io/badge/Capacitor-8-119eff?style=for-the-badge)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
  ![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

  **[在线文档 · 简体中文](https://adarkmaker.github.io/JMFM/)** · **[English Docs](https://adarkmaker.github.io/JMFM/en/)** · **[Releases](https://github.com/aDarkMaker/JMFM/releases)**
</div>

---

> 基于 **Capacitor + React + TypeScript**。输入专辑 ID，自动取数、解密重组、落盘成册；本地图片直读秒开，想看就看。

## 功能亮点

| | |
| --- | --- |
| **稳定取数** | 走移动端 API，动态刷新域名，网页入口封锁也不怕 |
| **原图还原** | `getNum` 条带逆序重排，碎片拼回完整画面 |
| **秒开直读** | 下载只写 `pages/`（默认 webp），阅读器直接渲染，不必等 PDF |
| **安心成库** | 多本串行排队；设置页三检元数据 / 页数格式 / 封面，一键修复重下 |
| **一键出包** | `bun run apk` 打出可安装 APK，真机即装即用 |

## 下载

[![Download APK](https://img.shields.io/badge/Download-JMFM.apk-success?style=for-the-badge&logo=android&logoColor=white)](https://github.com/aDarkMaker/JMFM/releases/latest/download/JMFM.apk)

每次推送到 `main`（应用相关改动）会自动打包，并更新 [Latest Release](https://github.com/aDarkMaker/JMFM/releases/latest) 中的 **JMFM.apk**。

点击上方按钮，或打开 [Releases](https://github.com/aDarkMaker/JMFM/releases/latest) 下载安装即可。

## 快速开始

**普通使用**

1. 下载并安装 APK  
2. 在「下载」页输入专辑 ID，开始任务  
3. 完成后到「资源」打开，图片直读浏览  

**开发者**

```bash
git clone https://github.com/aDarkMaker/JMFM.git
cd JMFM
bun install

bun run verify 1327951       # Node 端验证完整下载链路
bash scripts/dev-android.sh  # 构建并装到真机（优先）
bun run apk                  # 打包 debug APK → dist-apk/
```

网络受限时可加代理：

```bash
JMF_PROXY=http://127.0.0.1:7890 bun run verify 1327951
```

> 环境要求、架构说明与更多细节见 [完整文档](https://adarkmaker.github.io/JMFM/intro/quickstart)。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 应用壳 / UI | Capacitor 8 · React 19 · TypeScript |
| 构建 | Bun |
| 网络 | axios · CapacitorHttp（域名轮换 / 重试 / 代理） |
| 加解密 | crypto-js（MD5 · AES-256-ECB） |
| 图片 | Web Canvas（真机）· ImageMagick（Node 验证） |
| 文档 | VitePress · Mermaid |

## 文档站

```bash
cd docs && pnpm install
pnpm docs:dev      # http://localhost:5173/JMFM/
pnpm docs:build
```

推送 `docs/**` 或 `img/**` 到 `main` 后，GitHub Actions 自动发布 Pages。

## 许可证

[MIT License](../LICENSE) © 2026 aDarkMaker

---

**免责声明**：本项目仅供个人学习与研究，请勿用于商业用途，亦勿传播受版权保护的内容。
