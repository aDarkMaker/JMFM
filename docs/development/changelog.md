# 开发日志

## 2026-08-22

### PDF 拼贴修复

- **问题**：生成的 PDF 出现小图 + 大量白色占位，页面尺寸错误。
- **根因**：ImageMagick 条带裁剪后遗留虚拟页面元数据，`-append` 拼接后虚拟页面停留在第一条带高度，转 PDF 时 MediaBox 被设置为该错误高度，完整图片被压入矮页面。
- **修复**：`decodeWithMagick` 的 `-append` 后加 `+repage`；`createPdfWithMagick` 拼装前对输入加 `+repage`。
- **验证**：页面全部等宽 960pt、完整图片尺寸（670~1386pt）、无白色占位。

### 统一 PDF 页面宽度

- 新增 `src/core/pdf/layout.ts`：`computeUniformWidth`（目标宽度 = min(最大源图宽, 1190)）、`scaleSize`（等比缩放）。
- Node 运行时：`identify` 全部宽度后统一 `-resize`。
- RN 运行时：`buildPdfPages(imagePaths, sizes?)` 按实际尺寸生成页面，`imageFit: 'fill'`；下载编排记录每页解码后尺寸。
- 混合宽度实测：200x300 与 400x600 两图统一为 400x600，无白边。

### 链路打通

- `DownloadService` 改用 `ApiClient` 作为 `ContentSource`，处理单章空 series 回退。
- 抽离 `DownloadRuntime` 接口至 `src/core/download/types.ts`，RN 与 Node 运行时共用。
- `scripts/node-runtime.ts`：ImageMagick 解码 + PDF 生成。
- 真实专辑 1327951 全量验证通过（50 页 PDF）。

### 配置外置

- 新增 `src/config/app-config.json`，集中域名、密钥、请求头、下载并发、PDF 参数。
- 各核心模块从配置读取，移除硬编码。

## 2026-08-21

### API 通道打通

- 实现 `ApiClient`：动态域名刷新（AES 解密域名列表）、token 生成、响应解密、图片 URL 构造。
- 修正 AES-256-ECB 密钥派生：`md5(secret + ts)` 的 32 字节 ASCII 作为 key，与 Python jmcomic 对齐。
- 用纯 TS 自实现 Base64 / UTF-8 解码，替代 Node 专用 API（RN 兼容）。
- 结论：当前网络环境下 HTML 通道被 DNS 封锁，API 通道可用。

### 项目重写

- 由 Android (Java) 全量重写为 React Native + TypeScript。
- 清理旧 Gradle 工程，脚手架纯 TS（无 `.js` 文件）。
- 移除离职遗留的 `~/.npmrc` 内网镜像配置。
