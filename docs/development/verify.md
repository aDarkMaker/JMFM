# 验证与测试

## 单测

`bun test` 覆盖核心模块（当前 20 个测试文件、149 个用例）：

| 模块 | 覆盖点 |
|---|---|
| `transcode` | getNum 条带计算、computeStrips 逆序重排 |
| `crypto` | MD5、AES-256-ECB 密钥派生与解密 |
| `parser` | Base64 解码、HTML 解析 |
| `model` | 图片 URL 构造、ImageItem 创建 |
| `net` | 域名轮换、URL 构造、retryable 重试分类、requestWithRetry |
| `download-service` | 端到端编排（mock 网络与运行时）、原子写入 |
| `scheduler` | 并发计算、Semaphore、内存水位 MemoryGate |
| `sha256` / `download-apk` | 增量 SHA-256 参考向量、APK 流式下载与校验 |
| `update-http` | 版本检查 / APK 下载的请求与响应处理 |
| `safPaths` | SAF 相对路径、删除保护 |
| `resolveLibraryPaths` | 库路径解析与重定位 |
| `discoverLibrary` / `filterTags` | 本地库发现、标签过滤 |
| `daily` | 每日推荐（白名单/偏爱/时间梯度补齐） |
| `download-store` | 任务状态机：albumId 去重、状态流转、pause/resume、进度节流 flush |
| `settings` / `constants` / `semver` | 配置、常量、版本比较 |
| `formatTaskError` | 任务错误信息格式化 |

运行：

```bash
bun run test
```

## Node 端真实验证

`scripts/verify-download.ts` 在 Node 环境跑通完整下载链路（不走模拟器）：

```bash
bun run verify 1327951
```

它会：

1. 刷新动态域名（全局共享缓存，一次探测）。
2. `ApiClient` 拉取专辑与章节。
3. 并发下载全部图片到 `temp/<标题>/pages/`（保留序列、原子写入）。
4. 下载封面到 `temp/<专辑ID>_cover.jpg`。
5. 打印各阶段耗时与页体积摘要。

已用专辑 1327951（50 页）与 1214052（243 页）验证：`pages/` 完整保留、扩展名与格式正确。

`scripts/verify-pages.ts` 跑通首页 / tag / 书库 / 任务状态机四条链路：

```bash
bun scripts/verify-pages.ts [详情条数，默认 2]
```

它会：

1. **首页**：按 `mr_t` 拉取最近 3 页池，应用黑名单过滤后用 `buildRecommendations` 选出 6 本，逐本拉详情核对章节与 tags；不足 6 本即失败。
2. **tag**：串行采集若干专辑的 tags 去重统计（间隔 1.2s 规避源站限流），全部无 tags 即失败。
3. **书库**：用 Node 文件扫描器跑 `discoverLibraryFromDisk` + `mergeDiscovered`，报告 `temp/` 下已发现专辑。
4. **任务状态机**：走一遍 add → running → pause → resume → done，核对各阶段状态。

可用 `JMF_BLACKLIST=tag1,tag2` 注入黑名单、`JMF_PROXY` 走代理。

## 阅读器桌面基准

下载完成后，对 `pages/` 模拟「打开 → 滚完全部」并对比窗口/预热策略：

```bash
bun scripts/bench-reader-flow.ts 1214052
```

输出：`temp/bench-reader-1214052.json`（首屏、首次滑动、滚完、解码 p50/p95、推荐参数）。

## 静态检查

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run build       # bun build 产物（--minify --splitting）
```
