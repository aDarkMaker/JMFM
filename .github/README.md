<p align="center">
  <img src="../img/logo.png" alt="JMFM" width="128" />
</p>

# JMFM

基于 Capacitor + React Web + TypeScript 的禁漫天堂漫画下载器

![Capacitor](https://img.shields.io/badge/Capacitor-8-119eff?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**[简体中文文档](https://adarkmaker.github.io/JMFM/)** · **[English Docs](https://adarkmaker.github.io/JMFM/en/)**

---

> 完整文档见 [在线 Wiki](https://adarkmaker.github.io/JMFM/)。简要说明如下。

## 功能特性

- **稳定获取**：移动端 API 通道 + 动态域名刷新，规避网页通道的 DNS 封锁
- **还原原图**：条带分割算法 `getNum` 逆序重排，恢复被拆分的完整画面
- **图片直读秒开**：下载只落 `pages/`（默认 webp），阅读器直接渲染本地图片
- **串行下载 / 资源修复**：多本排队；设置页三检后一键重下
- **一键 APK**：`bun run apk` 打出可安装包

## 下载

[![GitHub Releases](https://img.shields.io/badge/Releases-Latest-success?style=flat-square)](https://github.com/aDarkMaker/JMFM/releases)

## 快速开始

```bash
bun install
bun run verify 1327951          # Node 端验证下载链路
bash scripts/dev-android.sh     # 真机优先运行
bun run apk                     # 打包 debug APK → dist-apk/
```

> 网络受限时可设置 `JMF_PROXY=http://127.0.0.1:7890`。

## 文档开发

```bash
cd docs
pnpm install
pnpm docs:dev      # http://localhost:5173/JMFM/
pnpm docs:build    # 输出 docs/.vitepress/dist
```

推送到 `main` 且改动 `docs/**` / `img/**` 时，GitHub Actions 会自动部署到 Pages。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 壳 / UI | Capacitor 8 · React 19 · TypeScript |
| 构建 | Bun |
| 网络 | axios · CapacitorHttp |
| 加解密 | crypto-js（MD5 / AES-256-ECB） |
| 图片 | Web Canvas · ImageMagick（Node） |
| 文档 | VitePress · Mermaid |

## 许可证

[MIT License](../LICENSE) © 2026 aDarkMaker

---

**免责声明**：本项目仅供个人学习与研究使用，请勿用于商业用途或传播受版权保护的内容。
