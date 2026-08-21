# JMFM 重构路线图

> 版本：v1（2026-08-21）
> 用途：分阶段逐步重构的执行计划。每阶段独立可编译、可验证，避免一次性大爆炸。
> 相关文档：[PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md)（现状与缺陷）、[CORE_DESIGN.md](CORE_DESIGN.md)（核心逻辑设计）

---

## 原则

- **逐步推进**：每阶段结束必须可编译、可运行，不破坏当前功能。
- **核心算法先行**：解密/重组（`getNum` / `decodeAndSave`）是最大风险点，最先移植并用同一输入对比验证。
- **行为对齐**：以当前 Java 行为为基线，任何差异（含历史 bug）先记录再决定是否修正。
- **不引入新依赖**：除 Kotlin 插件 + stdlib 外，暂不加新库（协程、DI 等按阶段需要再讨论）。

---

## 阶段总览

| 阶段 | 名称 | 产出 | 可验证 |
|---|---|---|---|
| 0 | 构建基座 | Kotlin 插件 + stdlib，移除 jetifier | `assembleDebug` 通过 |
| 1 | 核心算法移植 | ImageTranscoder（getNum / 重组 / 格式策略） | 单测 + 同图对比 |
| 2 | 解析模块 | Parser（jsoup + Base64 + URL 构造） | 单测（抓包样本） |
| 3 | 下载模块 | Downloader + HttpClient（轮询/代理/重试/并发） | 单测 + 实网冒烟 |
| 4 | PDF 模块 | PdfBuilder | 同 albumId 对比新旧 PDF |
| 5 | 设置生效 | SettingsProvider + 全部偏好接入 | 手测各开关 |
| 6 | 领域编排 | DownloadUseCase + 协程 Flow 进度 | 端到端冒烟 |
| 7 | UI 重构 | MVVM 化 Home / 列表 / 预览 / 设置 | 全功能回归 |
| 8 | 清理收尾 | 删死代码 / 模板资源 / 未用依赖 | 编译 + 全回归 |

---

## 阶段 0：构建基座

- `gradle/libs.versions.toml`：新增 `[versions] kotlin` 与 `[plugins] kotlin-android`（版本用当前稳定版）。
- `app/build.gradle.kts`：应用 `kotlin("android")`，加 `implementation(kotlin("stdlib"))`。
- `gradle.properties`：移除 `android.enableJetifier=true`。
- 验收：`./gradlew :app:assembleDebug` 通过（Java 代码原样可编译）。

## 阶段 1：核心算法移植（最高优先，先做风险最大的）

- 在 `core/transcode/` 新建 Kotlin `ImageTranscoder`：
  - `getNum(scrambleId, aid, fileName)`：逐字移植（268850 / 421926 魔法数、MD5 末字符取模）。
  - `decodeAndSave(num, bitmap, outFile, ext)`：条带重组（`over = h % num`、`base = floor(h/num)`、逆序交错）。
  - 格式策略：gif 直存 / webp→PNG / `num==0` 直存原始字节。
- 新增 `app/src/test` Kotlin 单测，用已知输入验证 `getNum` 输出与 Python 参考实现一致。
- 旧 Java 侧暂不接线，仅平行存在。

## 阶段 2：解析模块

- `core/parser/` 新建 Kotlin `AlbumParser` / `PhotoParser`（jsoup）：
  - 专辑页：Base64 解码检测 → albumId / name / scrambleId / 章节列表。
  - 章节页：photoId / seriesId / pageArr / cdnBaseUrl / totalPics，三级图片 URL 构造。
- 单测用 `sampledata` 与真实抓包 HTML 样本断言字段提取。

## 阶段 3：下载模块

- `core/network/` 新建 `HttpClient`（统一 HttpURLConnection：代理/UA/Referer/超时/重定向）与 `Downloader`（域名轮询、重试、并发池）。
- 消除旧实现重复请求（章节页仅请求一次）与每章新建线程池的问题。

## 阶段 4：PDF 模块

- `core/pdf/` 新建 `PdfBuilder`：A4 595×842、等比居中、大图降采样防 OOM、文件名净化。
- 验收：同一 albumId 新旧 PDF 页数一致、图片内容一致。

## 阶段 5：设置生效

- `core/config/` 新建 `SettingsProvider`：封装全部偏好读取（路径/重试/并发/格式/代理）。
- 各默认值与当前行为一致；`preferences.xml` 中占位项（clear_cache 等）补齐或移除。

## 阶段 6：领域编排

- `core/DownloadUseCase`（Kotlin）：编排解析→下载→转码→PDF，用协程结构化并发 + `Flow<DownloadEvent>` 上报进度/错误。
- 保持对 UI 暴露稳定接口，UI 侧可先用回调包装，后续切 Flow。

## 阶段 7：UI 重构（MVVM）

- Home 下载页、PDF 列表/预览、设置页逐步迁移 Kotlin；生命周期安全（协程作用域绑定）。
- 此阶段可对照 `.skills/design.skills.md`（Cirrus 风格）讨论是否统一视觉（单独议题）。

## 阶段 8：清理收尾

- 删除：死代码类（Gallery*/HomeViewModel/PdfListAdapter）、模板资源（§3 清单）、未使用依赖（navigation-fragment/ui、itextpdf、mediarouter）。
- 处理 `documentfile` 反射改为直接引用；`sampledata` 参考实现移出 app 目录（至 `tools/` 或移除，单独确认）。
- 全量回归：下载 → 合并 → 预览 → 列表 → 设置全链路。

---

## 决策点（后续逐个确认，不阻塞先行阶段）

1. `minSdk 35` 是否下调（影响可用设备范围）。
2. `sampledata` 参考实现去留。
3. UI 是否引入 Compose / 是否采用 Cirrus 风格。
4. 是否补移动端 API 通道（CORE_DESIGN.md §7）作为 HTML 失效备用。
5. release 签名与 minify 配置。
