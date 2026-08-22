# 网络与 API 通道

数据获取优先走移动端 API 通道，而非 HTML 网页通道——后者域名频繁被 DNS 封锁。

## HttpClient

`src/core/net/http.ts` 提供基础网络能力：

- **协议双保险**：每个域名同时尝试 `https://` 与 `http://`。
- **域名轮换**：传入 URL 列表，逐个尝试，直到成功。
- **重试**：每个 URL 可重试 N 次（默认 3），间隔可配。
- **代理支持**：构造时传 `proxy` 即可（如 `http://127.0.0.1:7890`）。
- **二进制 / 文本**：`getBytes` 返回 `Uint8Array`，`getHtml` 返回文本。

```typescript
const http = new HttpClient({proxy: 'http://127.0.0.1:7890'});
const resp = await http.getBytes(url, {Referer, Accept});
```

## ApiClient

`src/core/api/index.ts` 封装 API 通道，完整处理鉴权与解密。

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

### 图片 URL 构造

图片域名按 `photoId % CDN数量` 轮换：

```text
https://{cdn[photoId % len]}/media/photos/{photoId}/{fileName}
```

## 配置项

相关配置位于 `src/config/app-config.json` 的 `domains` 与 `app` 段：HTML/API/CDN 域名、域名服务器地址、全部密钥、请求头、超时与重试。
