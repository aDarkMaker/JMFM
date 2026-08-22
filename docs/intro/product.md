# 产品介绍

JMFM 是一个禁漫天堂（JMComic）漫画下载器，以 React Native + TypeScript 构建。输入专辑 ID 即可完成从数据拉取、图片解密重组到 PDF 输出的完整链路。

## 解决什么问题

禁漫天堂的漫画图片并非原图直出：

- 图片被按条带分割并打乱顺序，直接拼接无法阅读。
- HTML 网页通道域名频繁被 DNS 封锁，常规抓取不稳定。
- 不同图片宽度不同，直接转 PDF 会出现页面宽度不一、阅读体验差。

JMFM 针对这些问题提供端到端方案。

## 核心能力

- **数据拉取**：走移动端 API 通道，动态刷新可用域名，token 鉴权 + AES-256-ECB 解密响应。
- **图片还原**：根据专辑 scrambleId 与图片序号计算条带数量，按源图条带位置裁剪、逆序重排，得到完整原图。
- **PDF 输出**：全部页面等比例缩放到统一宽度（动态取最大宽度且不超过上限），每页即一张图，无白色占位。
- **配置外置**：域名、密钥、请求头、并发数、PDF 参数全部集中在 `src/config/app-config.json`。

## 技术栈

| 领域 | 选型 |
|---|---|
| 框架 | React Native 0.87 |
| 语言 | TypeScript |
| 网络 | axios（域名轮换 / 重试 / 代理） |
| 加解密 | crypto-js（MD5 / AES-256-ECB） |
| 图片解码（RN） | @shopify/react-native-skia |
| PDF（RN） | react-native-images-to-pdf |
| 图片解码（Node） | ImageMagick |
| 测试 | Jest |

## 状态

业务链路已跑通并通过真实专辑验证（专辑 ID 1327951，50 页）。UI 层尚未设计，为后续独立迭代项。
