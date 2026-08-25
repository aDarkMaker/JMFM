# UI 架构

JMFM 的 UI 层位于 `src/web`（React DOM + CSS），运行在 Capacitor 壳的 WebView 内，与业务核心 `src/core` 完全分离。UI 层仅通过 `ApiClient`、`DownloadService`、`Settings` 三个入口消费业务能力，不直接触碰网络、加解密与文件逻辑。

## 分层框架

```mermaid
flowchart TB
    subgraph ui [UI 层 src/web]
        app["App (tab 切换)"]
        screens["Screens"]
        stores["Stores (zustand)"]
        components["Components"]
        styles["Styles (CSS)"]
        assets["Assets"]
        app --> screens
        screens --> stores
        screens --> components
        screens --> styles
        components --> styles
        components --> assets
    end

    subgraph core [业务核心 src/core]
        api["ApiClient"]
        dl["DownloadService"]
        settings["data/settings"]
    end

    stores --> settings
    screens --> api
    screens --> dl
    stores --> api
```

- **App**：轻量 state tab 切换，承载 4 个主页面（无路由库）。
- **Screens**：页面级组件，只负责组合与事件分发，无业务实现。
- **Stores**：zustand 状态库，页面通过 store 读写 UI 状态，并桥接 `core` 的服务。
- **Components**：无业务语义的展示组件。
- **Styles**：全部样式为独立 CSS 文件，置于 `src/web/styles/`，tsx 内不写内联样式表。
- **Assets**：图标（Iconify SVG）与字体（Alimama / BebasNeue）统一存放。

## 导航结构

```mermaid
flowchart LR
    root["App"]
    root --> home["Home 每日推荐"]
    root --> lib["漫画库"]
    root --> tasks["下载"]
    root --> settings["设置"]
    lib -.-> reader["Reader 阅读器"]
```

### 页面表

| 名称 | 组件 | 说明 |
| --- | --- | --- |
| `Home` | `HomeScreen` | 每日推荐列表 |
| `Library` | `LibraryScreen` | 本地漫画库 + 搜索 + 分类筛选（全部/收藏/已下载/常看） |
| `Tasks` | `TasksScreen` | 下载任务与进度（串行排队） |
| `Settings` | `SettingsScreen` | 应用设置 |
| `Reader` | `ReaderScreen` | 阅读器：图片直读（新下载）或 pdf.js 回退（旧 PDF） |

## 页面职责

- **Home**：展示每日推荐卡片（封面、标题、作者、标签、章节数），点击进入详情。当前以 mock 数据驱动，后续接入推荐 API。
- **Library**：展示已下载漫画，支持搜索与四分类筛选（全部/收藏/已下载/常看），支持收藏、删除、打开阅读；删除使用 `ConfirmDialog`。
- **Tasks**：展示下载队列与实时进度，支持暂停/继续/删除；多本经 `queue.ts` 串行；完成 3s 后 GSAP 高度折叠离场；卡片为标题左对齐 + 状态徽章（无对号图标）。
- **Reader**：`ReaderTarget.pagesDir` 存在且为原生平台时走图片直读（`image-reader.tsx` + `image-loader.ts`）：纵向窗口 ±1/+8，横向三页轨道；否则回退 pdf.js。
- **Settings**：下载路径、重试、并发、图片格式、代理；「通用 → 资源修复」扫描并重下不合格条目。

## 封面预加载

```mermaid
flowchart LR
    app["App mount"] --> sub["subscribe library.items"]
    sub --> preload["preloadCovers(coverPath[])"]
    preload --> uri["resolveCoverSrc → URI cache"]
    uri --> decode["Image() 预解码"]
    decode --> hook["useCoverSrc peek 同步命中"]
    hook --> card["AlbumCard img eager"]
```

- `src/web/library/coverCache.ts`：URI 缓存 + inflight 去重 + `preloadCovers`。
- App 启动与库变更时预热；入库后立即预热单本封面，切 Tab 不再因封面加载跳变。

## 资源修复

```mermaid
flowchart TD
    scan["scanLibraryRepair"] --> c1{"元数据：pagesDir / 非 PDF / pageCount"}
    c1 -->|不合格| need["needsRepair"]
    c1 -->|通过| c2{"pages 存在且数量=pageCount 且扩展名=imageFormat"}
    c2 -->|不合格| need
    c2 -->|通过| c3{"coverPath 存在且文件在盘"}
    c3 -->|不合格| need
    c3 -->|通过| ok["compliant"]
    need --> del["repairLibraryItems 删目录"]
    del --> queue["加入下载队列重下"]
```

## 状态管理

| Store | 职责 |
| --- | --- |
| `useSettingsStore` | 包装 `data/settings` 的读取与持久化（Capacitor Preferences / localStorage） |
| `useDownloadStore` | 下载任务集合与进度（pending / running / paused / done / error） |
| `useLibraryStore` | 本地已下载漫画（`LibraryItem`，含 `pagesDir` / `coverPath`），支持收藏 / 常看 / 删除 |

## 样式体系

基于 `src/web/theme/index.css` 的 Cirrus 设计 token（CSS 变量：surface / ink / accent / radii / shadow / spacing / typography / easing）。

- 页面与组件样式分别置于 `src/web/styles/` 下对应 CSS 文件，tsx 不内联样式。
- 主题色：`ink` 主文本、`accent-primary` 主操作、`accent-success` 成功、`accent-danger` 危险、`surface` 表面、`shadow-1/2` 双层阴影、`ease-spring` 弹性动效。

## 资产规范

### 图标

- 来源：[Iconify Material Symbols](https://icon-sets.iconify.design/material-symbols/)，仅存 SVG 矢量文件到 `src/web/assets/icons/`。
- `scripts/gen-icons.ts` 生成 `src/web/generated/icons.ts`（SVG 字符串映射）。
- 组件 `Icon` 用 `dangerouslySetInnerHTML` 内联渲染 `<svg>`，图标使用 `currentColor`，颜色由外层 CSS 控制。
- Tab 图标：`home`、`auto-stories`、`download`、`settings`。

### 字体

| 文件 | fontFamily | 用途 |
| --- | --- | --- |
| `AlimamaShuHeiTi-Bold.woff2/.ttf` | `Alimama ShuHeiTi` | 中文标题、品牌字 |
| `BebasNeue.woff2` | `Bebas Neue` | 英文与数字、装饰字 |

- 字体源文件存放 `src/web/assets/fonts/`。
- `src/web/styles/fonts.css` 通过 `@font-face` 注册，Bun build 自动打包（小体积字体内联为 data URI）。

## 目录结构

```
src/web/
  assets/
    fonts/                # Alimama / BebasNeue / Nagino
    icons/                # Iconify SVG
  components/             # Icon / AlbumCard / ConfirmDialog / SearchBar / ...
  download/               # 下载串行队列（queue.ts）
  generated/              # icons.ts（脚本生成）
  hooks/                  # useDownloadTask / useCoverSrc / useKeyboardVisibility / ...
  library/                # saveToLibrary / coverCache / repairLibrary
  reader/                 # image-doc / image-loader / image-reader / pdf-doc
  screens/                # Home / Library / Tasks / Settings / Reader
  stores/                 # zustand stores
  styles/                 # CSS 样式模块
  theme/                  # Cirrus tokens（CSS 变量）
  App.tsx                 # tab 切换 + 封面预热 + Reader 全屏挂载
  main.tsx                # ReactDOM.createRoot 入口
  index.html              # WebView 宿主页
```

## 构建与运行

```bash
bun run build            # bun build → dist/
bunx cap sync android    # 同步 web 产物到原生工程
bunx cap run android     # 构建并运行到已连接设备
bash scripts/dev-android.sh   # 一键：build → sync → 真机优先运行
```
