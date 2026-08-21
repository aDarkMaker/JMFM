# JMFM 项目现状分析

> 版本：v1（2026-08-21）
> 用途：重构前的代码体检，作为路线图（REFACTOR_ROADMAP.md）的事实依据。
> 相关文档：[CORE_DESIGN.md](CORE_DESIGN.md)（核心逻辑设计）

---

## 1. 项目概览

| 项 | 值 |
|---|---|
| 项目名 | JMFMobile（`JMFM` 根目录） |
| 构建 | Gradle + Kotlin DSL（`build.gradle.kts`） |
| 语言 | 纯 Java（14 个源文件，约 2500 行） |
| compileSdk / targetSdk | 36 |
| minSdk | 35（偏高，见缺陷 §8） |
| 依赖体系 | `gradle/libs.versions.toml` 版本目录 |
| 参考实现 | `app/sampledata/`（Electron + Python jmcomic，8773 行，打入 app 目录） |

功能：输入本子 ID → 镜像站抓取章节图片（webp 解码、条带解密重组）→ 合并导出单个 PDF → 本地预览 / 列表浏览 / 设置页（代理、并发等）。

---

## 2. 代码结构清单

包根：`app/src/main/java/com/example/jmfmobile/`

| 文件 | 行数 | 状态 | 职责 |
|---|---|---|---|
| `core/JMcomicDownloader.java` | 713 | 在用（God Class） | 网络/解析/解密/PDF/存储/线程池全合一 |
| `ui/home/HomeFragment.java` | 538 | 在用 | 下载 UI + SAF 目录 + DocumentFile 反射 + 日志 |
| `ui/home/PdfListAdapter.java` | 56 | **死代码** | 从未被引用 |
| `ui/home/HomeViewModel.java` | 18 | **死代码** | 模板残留 |
| `ui/gallery/GalleryFragment.java` | 36 | **死代码** | 模板残留 |
| `ui/gallery/GalleryViewModel.java` | 18 | **死代码** | 模板残留 |
| `MainActivity.java` | 22 | 在用 | 仅承载 HomeFragment |
| `PDFViewerActivity.java` | 280 | 在用 | PDF 预览（file/uri/http 三通道） |
| `ui/viewer/PdfListActivity.java` | 210 | 在用 | PDF 列表页（ArrayAdapter） |
| `ui/viewer/BookViewerActivity.java` | 165 | 半死 | Manifest 已注册，无启动入口 |
| `ui/viewer/ErrorActivity.java` | 63 | 半死 | Manifest 已注册，无启动入口 |
| `ui/settings/SettingsActivity.java` | 108 | 在用 | 设置页（Preferences） |

---

## 3. 资源清单（模板残留）

| 资源 | 状态 | 说明 |
|---|---|---|
| `layout/activity_main.xml`、`app_bar_main.xml`、`content_main.xml`、`nav_header_main.xml` | **残留** | Navigation 模板，`MainActivity` 实际用 `activity_main_simple.xml` |
| `layout/fragment_gallery.xml`、`fragment_slideshow.xml` | **残留** | 对应死代码 Fragment |
| `navigation/mobile_navigation.xml` | **残留** | 未被使用 |
| `menu/activity_main_drawer.xml`、`menu/main.xml` | **残留** | 未被使用 |
| `drawable/side_nav_bar.xml`、`ic_menu_camera/gallery/slideshow.xml` | **残留** | 模板图标 |
| `layout/activity_pdf_list.xml`、`item_pdf_list.xml`、`activity_book_viewer.xml` 等 | 在用 | 预览/列表相关 |
| `font/aaguxilazhangguankeaideshen_2.ttf` | 在用 | 自定义字体 |

---

## 4. 依赖分析（`app/build.gradle.kts`）

| 依赖 | 实际使用 | 建议 |
|---|---|---|
| appcompat / material / constraintlayout | 在用 | 保留 |
| lifecycle-livedata/viewmodel-ktx | ViewModel 仅死代码在用 | 重写后视需要保留 |
| navigation-fragment / navigation-ui | **未使用**（Navigation 已废弃） | 移除 |
| com.github.barteksc:android-pdf-viewer | 在用（两个 Viewer） | 保留 |
| androidx.preference:preference | 在用 | 保留 |
| androidx.documentfile:documentfile | **用反射调用** | 重写后直接引用 |
| org.jsoup:jsoup | **已声明未使用**（正则解析） | 重写时启用 |
| com.itextpdf:itextpdf | **未使用** | 移除 |
| androidx.mediarouter:mediarouter | **未使用** | 移除 |

---

## 5. 构建配置问题

- `android.enableJetifier=true`（gradle.properties）：无旧 support 库依赖，已过时，应移除。
- `compileOptions` Java 11；无 Kotlin 插件（`kotlin("android")` 未应用）。
- release 构建 `isMinifyEnabled=false`、无签名配置。
- 仓库含 aliyun 镜像（`settings.gradle.kts`），可拉取 mavenCentral/ google 依赖。

---

## 6. 核心逻辑现状（详见 CORE_DESIGN.md）

- HTML 通道为主，无移动端 API 通道。
- 专辑页 HTML 未做 Base64 解码（参考实现 `base64DecodeUtf8` 缺失）。
- 章节页被重复请求：`getImageUrls` 与 `getScrambleIdFromChapter` 各发一次请求，后者带空回调。
- 图片下载每章新建固定线程池，资源管理不当。

---

## 7. 设置项生效情况（preferences.xml）

| key | 读取方 | 状态 |
|---|---|---|
| `enable_proxy` / `proxy_address` | `JMcomicDownloader` 构造时读取 | 生效 |
| `download_path` | 无 | **未生效** |
| `retry_times` | 无（硬编码 3） | **未生效** |
| `image_threads` | 无（按 CPU 推导） | **未生效** |
| `image_quality` / `image_format` | 无 | **未生效** |
| `auto_open_dir` / `use_custom_font` / `enable_log` / `enable_cache` / `clear_cache` / `reset_settings` | 无 | 未生效或占位 |

---

## 8. 缺陷清单（重写必须规避）

1. `JMcomicDownloader.java` 713 行 God Class：网络/解析/解密/PDF/存储/线程全混。
2. `HomeFragment.java` 538 行承载 UI + 业务 + 反射 + 剪贴板回退等。
3. 脆弱正则解析 HTML；专辑页 Base64 解码缺失。
4. 章节页重复请求；每章新建线程池。
5. 回调经 `uiHandler.post` 回 UI，Fragment 销毁后 `binding=null` 有 NPE 风险。
6. 设置项半数以上形同虚设（§7）。
7. 死代码类 ×4、模板资源一批、未使用依赖 ×3（§2/§3/§4）。
8. `minSdk 35` 过高；`enableJetifier` 过时。
9. 文件名标题用 `"漫画_{id}"` 占位，未用真实书名。
10. `documentfile` 用反射调用，脆弱且不必要。
