<div align="center">
  <img src="https://raw.githubusercontent.com/aDarkMaker/JMFM/main/img/logo.png" width="160" alt="JMFM logo" />

  # JMFM

  随时随地，想飞就飞 —— 禁漫天堂漫画下载器

  ![Capacitor](https://img.shields.io/badge/Capacitor-8-119eff?style=for-the-badge)
  ![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
  ![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

  **[在线文档 · 简体中文](https://adarkmaker.github.io/JMFM/)** · **[English Docs](https://adarkmaker.github.io/JMFM/en/)** · **[Releases](https://github.com/aDarkMaker/JMFM/releases)**
</div>

---

Capacitor + React + TypeScript。输入专辑 ID，API 取数、条带重组、写入 pages/；阅读器直读本地图片。

## 功能

| | |
| --- | --- |
| **每日推荐** | 首页按收藏偏爱标签推荐当日漫画，按日缓存自动过期 |
| **内容过滤** | 标题或标签含 AI 的漫画硬屏蔽 + 自定义黑名单标签 |
| **API 取数** | 动态域名刷新、token 鉴权，不依赖 HTML 入口 |
| **条带重组** | getNum 算切分，裁剪逆序拼接 |
| **pages 直读** | 下载只写 `pages/`（默认 webp），阅读器渲染本地图片 |
| **串行队列** | 多本排队，暂停/失败自动切下一本 |
| **资源修复** | 设置页三检元数据 / 页数格式 / 封面，不合格重下 |
| **APK 打包** | `bun run apk` 打出可安装包 |

## 下载

[![Download APK](https://img.shields.io/badge/Download-JMFM.apk-success?style=for-the-badge&logo=android&logoColor=white)](https://github.com/aDarkMaker/JMFM/releases/latest/download/JMFM.apk)

推送到 `main`（应用相关改动）会自动打包，更新 [Latest Release](https://github.com/aDarkMaker/JMFM/releases/latest) 中的 **JMFM.apk**。

## 快速开始

**使用**

1. 安装 APK
2. 「首页」查看每日推荐，或「下载」页输入专辑 ID
3. 「资源」页打开，阅读 pages/

**开发**

```bash
git clone https://github.com/aDarkMaker/JMFM.git
cd JMFM
bun install

bun run verify 1327951       # Node 端验证下载链路
bash scripts/dev-android.sh  # 构建并装到真机
bun run apk                  # 打包 debug APK → dist-apk/
```

网络受限：

```bash
JMF_PROXY=http://127.0.0.1:7890 bun run verify 1327951
```

环境要求与架构说明见 [完整文档](https://adarkmaker.github.io/JMFM/intro/quickstart)。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 应用壳 / UI | Capacitor 8 · React 19 · TypeScript |
| 构建 | Bun |
| 网络 | Fetch / CapacitorHttp（域名轮换 / 重试 / 代理）；axios 仅 Node 脚本用 |
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
