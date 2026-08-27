# 网络与 API 通道

数据获取优先走移动端 API 通道，而非 HTML 网页通道——后者域名频繁被 DNS 封锁。

## HttpClient 接口

`src/core/net/http.ts` 定义统一网络接口：

- **协议双保险**：每个域名同时尝试 `https://` 与 `http://`。
- **域名轮换**：传入 URL 列表，逐个尝试，直到成功。
- **重试**：每个 URL 可重试 N 次（默认 3），间隔可配。
- **二进制 / 文本**：`getBytes` 返回 `Uint8Array`，`getHtml` 返回文本。

```typescript
export interface HttpClient {
  getHtml(path, domains?, headers?): Promise<FetchResult>;
  getBytes(url, headers?): Promise<FetchResult>;
  getBytesWithUrls(urls, headers?): Promise<FetchResult>;
}
```

### FetchHttpClient（Web）

`src/core/net/fetch-http.ts` 基于浏览器 `fetch` 实现，运行时 Web 端默认使用：

```typescript
const http = new FetchHttpClient({timeoutMs: 15000, maxRetries: 2});
const resp = await http.getBytes(url, {Referer, Accept});
```

### NativeHttpClient（Capacitor 真机）

`src/core/net/native-http.ts` 基于 `CapacitorHttp`（原生网络栈）实现同一接口，请求绕过 WebView 的 CORS 限制，适合真机下载；原生栈异常时自动回退到 WebView `fetch`：

```typescript
import {createHttpClient} from '../src/core/net';

// 真机上：NativeHttpClient（原生栈，含 fetch 回退）
// Web 上：FetchHttpClient
const http = createHttpClient({timeoutMs: 15000, maxRetries: 2});
```

二进制响应（`responseType: 'arraybuffer'`）由原生层返回 Base64 字符串，`NativeHttpClient` 内部用 `base64ToBytes` 还原为 `Uint8Array`。

### 统一重试

`src/core/net/retry.ts` 的 `requestWithRetry` 收敛「域名轮换 × 单 URL 重试」双循环，Fetch 与原生实现共用；axios 客户端（`scripts/shared/axios-http.ts`）仅 Node 脚本使用。

## ApiClient

`src/core/api/client.ts` 封装 API 通道，`src/core/api/parse.ts` 提供纯解析函数。

### 动态域名刷新

域名服务器返回 AES 加密的域名列表：

1. 从 `apiDomainServers`（配置）逐个拉取。
2. 去掉非 ASCII 前缀后，用 `domainServerSecret` 做 AES-256-ECB 解密。
3. 解析 JSON 中的 `Server` 数组，作为后续请求域名。

```typescript
const domains = await api.refreshDomains();
// e.g. ['www.cdnhjk.net', 'www.cdngwc.cc', ...]
```

### token 生成

每次请求生成：

```text
token = md5(ts + APP_TOKEN_SECRET)
tokenparam = ts, appVersion
```

其中 `ts` 为当前秒级时间戳，密钥读自配置。

### 请求与解密

`/album` 与 `/chapter` 接口：

1. 拼接 `https://{domain}{path}?{query}`，携带 token 头。
2. 响应体 `{code, data}`，`data` 为 AES 加密串。
3. 解密密钥为 `md5(ts + APP_DATA_SECRET)` 的 32 字节 ASCII。
4. 解密后 JSON 解析为专辑 / 章节数据。

源站限流时可能返回 `code=200` 但 `data` 为空串/空数组或损坏密文；`req` 会重新生成 `ts`/`token` 等待 2s 后重试（最多 3 次）。

### 图片 URL 构造

图片域名按 `photoId % CDN数量` 轮换：

```text
https://{cdn[photoId % len]}/media/photos/{photoId}/{fileName}
```

## 配置项

相关配置位于 `src/config/app-config.json` 的 `domains` 与 `app` 段：HTML/API/CDN 域名、域名服务器地址、全部密钥、请求头、超时与重试。
