# 网络与 API 通道

数据获取优先走移动端 API 通道，而非 HTML 网页通道——后者域名频繁被 DNS 封锁。

## HttpClient 接口

`src/core/net/http.ts` 定义统一网络接口：

- **域名轮换**：每个域名先 `https://`，失败再试 `http://`。
- **URL 列表**：传入 URL 列表，逐个尝试，直到成功。
- **重试**：每个 URL 可重试 N 次（默认 3），间隔可配；`retryable` 标记区分 4xx（不重试）与 5xx/429（重试）。
- **二进制 / 文本**：`getBytes` / `getBytesWithUrls` 返回 `FetchResult`（`bytes` 或原生直传的 `base64`），`bytesOf` 惰性解码。

```typescript
export interface HttpClient {
  getBytes(url, headers?): Promise<FetchResult>;
  getBytesWithUrls(urls, headers?): Promise<FetchResult>;
}
```

### FetchHttpClient（Web）

`src/core/net/fetch-http.ts` 基于浏览器 `fetch` 实现，运行时 Web 端默认使用；单次请求用 `AbortSignal.timeout` 超时：

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

二进制响应（`responseType: 'arraybuffer'`）由原生层返回 Base64 字符串，直接存入 `FetchResult.base64` 供落盘直写（不先行解码再二次编码）。

### 统一重试

`src/core/net/retry.ts` 的 `requestWithRetry` 收敛「URL 列表 × 单 URL 重试」双循环，Fetch 与原生实现共用；axios 客户端（`scripts/shared/axios-http.ts`）仅 Node 脚本使用。

## ApiClient

`src/core/api/client.ts` 封装 API 通道，`src/core/api/parse.ts` 提供纯解析函数。

### 动态域名刷新

域名服务器返回 AES 加密的域名列表：

1. 从 `apiDomainServers`（配置）逐个拉取。
2. 去掉非 ASCII 前缀后，用 `domainServerSecret` 做 AES-256-ECB 解密。
3. 解析 JSON 中的 `Server` 数组，作为后续请求域名。

探测结果在模块级全局共享（`sharedDomains`），多个 `ApiClient` 实例只探测一次，并以内联 Promise 去重并发触发。

```typescript
const domains = await api.refreshDomains();
// e.g. ['www.cdnhjk.net', 'www.cdngwc.cc', ...]
```

### token 生成

每次请求生成：

```text
token = md5(ts + APP_TOKEN_SECRET)
tokenparam = ts, apiTokenVersion
```

其中 `ts` 为当前秒级时间戳，密钥读自配置；`apiTokenVersion` 为 API 协议版本（区别于应用版本号）。

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

## 应用内更新

`src/core/update/` 负责版本检查与 APK 安装：

- 按 GitHub Release tag 下载 `version.json` 与 `JMFM.apk`
- APK 流式分块下载（原生路径切片解码 CapacitorHttp 的整包 base64，web 路径走 response reader），边收边算增量 SHA-256，落盘后校验 `version.json.apkSha256`，不匹配自动清理重下
- 签名密钥见 `docs/development/setup.md`
