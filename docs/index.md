---
layout: home

hero:
  name: JMFM
  text: 禁漫天堂漫画下载器
  tagline: 输入专辑 ID，一键解析、解密重组并输出高质量 PDF，完整链路基于 React Native + TypeScript。
  actions:
    - theme: brand
      text: 快速开始
      link: /intro/quickstart
    - theme: alt
      text: 架构总览
      link: /architecture/overview

features:
  - icon:
    title: API 通道
    details: 动态域名刷新 + token 鉴权 + AES 解密，绕过 HTML 通道的 DNS 封锁，稳定获取专辑与章节数据。
  - icon:
    title: 图片解密重组
    details: 条带分割算法 getNum + 逐条裁剪重排，还原被拆分的漫画原图。
  - icon:
    title: 高质量 PDF
    details: 所有页面等比例缩放到统一宽度，无白边无占位，文件名直接使用漫画标题。
  - icon:
    title: 配置外置
    details: 域名、密钥、请求头、PDF 参数全部集中在 JSON 配置，修改无需改代码。
  - icon:
    title: 前后端分离
    details: 业务层 src/core 不依赖 UI，可独立测试与验证，UI 层后续单独设计。
  - icon:
    title: 双端可测
    details: Node 脚本可跑完整链路，49+ 单测覆盖核心算法，RN 运行时与 Node 运行时并存。
---
