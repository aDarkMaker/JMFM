# 架构总览

JMFM 采用前后端分离的分层结构：`src/config` 提供集中配置，`src/core` 承载全部业务逻辑，`src/web` 为 Capacitor 壳内的 React Web UI 层。

## 目录结构

```
src/
  config/                 # 集中配置（app-config.json + 类型加载器）
    app-config.json
    index.ts
  core/                   # 业务核心，不依赖 UI
    api/                  # API 通道（域名刷新、token、解密、图片 URL）
    constants/            # 常量（算法阈值、请求参数、PDF 尺寸）
    crypto/               # MD5 / AES-256-ECB
    model/                # 领域模型（Album / Photo / ImageItem）
    net/                  # HttpClient 接口 + Axios / Capacitor 原生实现
    parser/               # HTML 解析 + Base64（备用通道）
    pdf/                  # PDF 页面布局（统一宽度、尺寸计算）
    transcode/            # 条带计算 + 图片重组
    download/             # 下载编排（DownloadService + Runtime 抽象）
    util/                 # UTF-8 / Base64 等工具
  data/                   # 设置持久化（storage 接口）与 mock 数据
  web/                    # UI 层（React DOM + CSS，运行于 Capacitor 壳）
    assets/               # 图标（Iconify SVG）与字体
    components/           # 展示组件
    screens/              # 4 个主页面
    stores/               # zustand 状态库
    styles/               # CSS 样式模块
    theme/                # Cirrus 设计 token（CSS 变量）
    generated/            # icons.ts（由 SVG 生成）
    App.tsx / main.tsx / index.html
scripts/
  verify-download.ts      # Node 端完整链路验证脚本
  node-runtime.ts         # Node 运行时（ImageMagick 解码 + PDF）
capacitor.config.ts       # Capacitor 配置（appId / webDir / 插件）
android/                  # Capacitor 生成的 Android 原生工程
```

## 分层依赖

```mermaid
flowchart LR
    cfg["config"]
    api["core/api"]
    net["core/net"]
    model["core/model"]
    trans["core/transcode"]
    dl["core/download"]
    pdf["core/pdf"]
    rnt["runtime (Capacitor/Web/Node)"]
    out["PDF 文件"]

    cfg --> net
    cfg --> api
    net --> api
    api --> model
    model --> dl
    dl --> trans
    dl --> pdf
    dl --> rnt
    pdf --> out
```

- **net / api / model**：数据获取与建模。
- **transcode**：图片解密重组的纯算法。
- **download**：编排层，依赖 `DownloadRuntime` 接口而非具体实现。
- **runtime**：Capacitor 原生（Filesystem + Canvas + pdf-lib）、Web 内存版与 Node（ImageMagick）实现同一接口，可无缝切换。

## 完整数据流

```mermaid
flowchart LR
    id["专辑 ID"] --> api2["ApiClient"]
    api2 -->|"动态域名"| http["HttpClient"]
    api2 -->|"AlbumDetail"| svc["DownloadService"]
    svc -->|"每章"| ph["getPhoto"]
    svc -->|"ImageItem"| img["下载图片"]
    img --> num["getNum 计算条带"]
    num --> dec["条带重组"]
    dec --> pdf2["PDF 生成"]
    pdf2 --> file["标题.pdf"]
```

## 设计要点

- **接口隔离**：`ContentSource` 抽象数据来源，`DownloadRuntime` 抽象运行时能力，业务层不感知 UI 与具体运行时。
- **纯函数优先**：`getNum`、`computeStrips`、`computeUniformWidth`、`scaleSize` 均为纯函数，可直接单测。
- **配置驱动**：域名、密钥、请求头、PDF 参数全部读自 `app-config.json`。
- **网络可插拔**：`HttpClient` 是接口，Web/Node 走 axios（`AxiosHttpClient`），真机走 Capacitor 原生栈（`NativeHttpClient`，绕过 CORS），按 `Capacitor.isNativePlatform()` 选择。
