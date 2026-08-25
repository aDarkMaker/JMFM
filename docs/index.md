---
layout: home

hero:
  name: JMFM
  text: 禁漫天堂漫画下载器
  tagline: 随时随地，想飞就飞。输入专辑 ID，一键下载、解密重组，本地图片直读秒开。
  image:
    src: /img/logo.png
    alt: JMFM
  actions:
    - theme: brand
      text: 快速开始
      link: /intro/quickstart
    - theme: alt
      text: 下载
      link: https://github.com/aDarkMaker/JMFM/releases
    - theme: alt
      text: 了解更多
      link: /intro/product

features:
  - icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    title: API 通道稳定取数
    details: 动态域名刷新 + token 鉴权 + AES 解密，绕过 HTML 通道的 DNS 封锁，稳定获取专辑与章节。
  - icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
    title: 条带解密重组
    details: getNum 计算切分数，按源图位置裁剪逆序拼接，把碎片还原成完整画面。
  - icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    title: 图片直读秒开
    details: 下载只落 pages/（默认 webp），阅读器直接渲染本地图片；PDF 为可选归档，旧文件可回退。
  - icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    title: 串行下载队列
    details: 多本漫画排队下载，暂停失败自动续下一本，避免磁盘与解码竞争卡顿。
  - icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
    title: 资源修复
    details: 设置页三检元数据、格式与页数、封面；不合格项一键删目录并重入下载队列。
  - icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
    title: Capacitor 真机
    details: React Web 跑在 Android 壳内；bun run apk 一键打出可安装包。
---
