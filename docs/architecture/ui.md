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

- **Home**：展示每日推荐卡片（封面、标题、作者、标签、章节数），点击下载。数据来自 `useDailyStore` + `buildRecommendations`：白名单优先 → 偏爱标签 → 按时间梯度（今天更新优先、不足按 `mr_t` 顺序往前推进）补齐至 6 本，按日缓存，支持 dismiss / 刷新。
- **Library**：展示已下载漫画，支持搜索与四分类筛选（全部/收藏/已下载/常看），支持收藏、删除、打开阅读；删除使用 `ConfirmDialog`。
- **Tasks**：展示下载队列与实时进度，支持暂停/继续/删除；多本经 `queue.ts` 串行；完成 3s 后 GSAP 高度折叠离场；卡片为标题左对齐 + 状态徽章（无对号图标）。
- **Reader**：`ReaderTarget.pagesDir` 存在时走图片直读（`image-reader.tsx` + `image-loader.ts`）：纵向窗口 ±1/+3，横向三页轨道；否则回退 pdf.js。`ReaderScreen` 由 `App` 用 `React.lazy` 懒加载，pdf.js 仅 PDF 模式动态 import。
- **Settings**：主题、阅读方式、下载路径（支持 SAF 目录授权）、启用代理；「通用 → 修复文件」扫描并补齐缺失页面与封面，扫描进度条与入队提示常驻（跨 Tab 不中断）；「检查更新」下载进度由 `useUpdateStore` 承载，切页后回设置页仍可见。

## 封面预加载

```mermaid
flowchart LR
    app[App mount] --> sub[subscribe library]
    sub --> preload[preloadCovers]
    preload --> uri[resolveCoverSrc cache]
    uri --> decode[Image decode]
    decode --> hook[useCoverSrc peek]
    hook --> card[AlbumCard]
```

- `src/web/library/coverCache.ts`：URI 缓存 + inflight 去重 + `preloadCovers`。
- App 启动与库变更时预热前 8 张封面（其余懒加载）；入库后立即预热单本封面，切 Tab 不再因封面加载跳变。

## 资源修复

```mermaid
flowchart TD
    scan[scanLibraryRepair] --> c1{metadata ok}
    c1 -->|no| need[needsRepair]
    c1 -->|yes| c2{pages count and format}
    c2 -->|no| need
    c2 -->|yes| c3{cover on disk}
    c3 -->|no| need
    c3 -->|yes| ok[compliant]
    need --> del[delete dirs]
    del --> queue[re-queue download]
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
| `AlimamaShuHeiTi-Bold.woff2` | `Alimama ShuHeiTi` | 中文标题、品牌字 |
| `Nagino.woff2` | `Nagino` | 日文标题 |
| `BebasNeue.woff2` | `Bebas Neue` | 英文与数字、装饰字 |

- 字体源文件存放 `src/web/assets/fonts/`（均为 woff2，由 otf/ttf 转换瘦身）。
- `src/web/styles/fonts.css` 通过 `@font-face` 注册，Bun build 自动打包。

## 目录结构

```
src/web/
  assets/
    fonts/                # Alimama / BebasNeue / Nagino（woff2）
    icons/                # Iconify SVG
  components/             # Icon / AlbumCard / ConfirmDialog / SearchBar / ...
  download/               # createDownloadRuntime / safRuntime / taskCleanup
  generated/              # icons.ts（脚本生成）
  hooks/                  # useDownloadTask / useCoverSrc / useKeyboardVisibility / ...
  library/                # saveToLibrary / coverCache / repairLibrary / discoverLibrary / daily / tags / uid
  reader/                 # image-doc / image-loader / image-reader / pdf-doc / paged-viewer / scroll-viewer
  screens/                # Home / Library / Tasks / Settings / Reader
  stores/                 # zustand stores
  styles/                 # CSS 样式模块
  theme/                  # Cirrus tokens（CSS 变量）
  util/                   # cacheRegistry（缓存失效注册）
  App.tsx                 # tab 切换 + 封面预热 + Reader 懒加载挂载
  main.tsx                # ReactDOM.createRoot 入口
  index.html              # WebView 宿主页
```

## 构建与运行

```bash
bun run build            # bun build → dist/
bunx cap sync android    # 同步 web 产物到原生工程
bunx cap run android     # 构建并运行到已连接设备
bash scripts/dev-android.sh   # 一键：build → sync → 真机优先运行
bun run apk              # 一键打 debug APK → dist-apk/
```
