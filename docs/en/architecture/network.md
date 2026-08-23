# Networking & API Channel

Data fetching favors the mobile API channel over the HTML channel, because the latter's domains are frequently blocked by DNS.

## HttpClient Interface

`src/core/net/http.ts` defines the uniform networking interface:

- **Dual protocol**: every domain is tried over both `https://` and `http://`.
- **Domain rotation**: accepts a URL list and tries each in turn until one succeeds.
- **Retry**: each URL can be retried N times (default 3) with a configurable interval.
- **Binary / text**: `getBytes` returns `Uint8Array`; `getHtml` returns text.

```typescript
export interface HttpClient {
  getHtml(path, domains?, headers?): Promise<FetchResult>;
  getBytes(url, headers?): Promise<FetchResult>;
  getBytesWithUrls(urls, headers?): Promise<FetchResult>;
}
```

### AxiosHttpClient (Web / Node)

`AxiosHttpClient` is the axios implementation, with proxy support:

```typescript
const http = new AxiosHttpClient({proxy: 'http://127.0.0.1:7890'});
const resp = await http.getBytes(url, {Referer, Accept});
```

### NativeHttpClient (Capacitor device)

`src/core/net/native-http.ts` implements the same interface on `CapacitorHttp` (the native networking stack), bypassing WebView CORS for on-device downloads:

```typescript
import {NativeHttpClient} from '../src/core/net';

// On device: native CapacitorHttp stack
// Web/Node: axios stack
const http = Capacitor.isNativePlatform()
  ? new NativeHttpClient({timeoutMs: 15000, maxRetries: 2})
  : new AxiosHttpClient({timeoutMs: 15000, maxRetries: 2});
```

Binary responses (`responseType: 'arraybuffer'`) are returned as Base64 strings by the native layer; `NativeHttpClient` converts them back to `Uint8Array` with `base64ToBytes`.

## ApiClient

`src/core/api/index.ts` wraps the API channel and handles auth and decryption end to end.

### Dynamic Domain Refresh

The domain server returns an AES-encrypted list of domains:

1. Fetch from each entry of `apiDomainServers` (from config).
2. Strip the non-ASCII prefix, then decrypt with `domainServerSecret` using AES-256-ECB.
3. Parse the `Server` array from the JSON and use it for subsequent requests.

```typescript
const domains = await api.refreshDomains();
// e.g. ['www.cdnhjk.net', 'www.cdngwc.cc', ...]
```

### Token Generation

Every request generates:

```text
token = md5(ts + APP_TOKEN_SECRET)
tokenparam = ts, appVersion
```

`ts` is the current second-level timestamp; secrets come from config.

### Request & Decryption

The `/album` and `/chapter` endpoints:

1. Build `https://{domain}{path}?{query}` and attach token headers.
2. The response is `{code, data}`, where `data` is an AES-encrypted string.
3. The decryption key is the 32-byte ASCII of `md5(ts + APP_DATA_SECRET)`.
4. Parse the decrypted JSON into album / chapter data.

### Image URL Construction

CDN domains rotate by `photoId % CDN count`:

```text
https://{cdn[photoId % len]}/media/photos/{photoId}/{fileName}
```

## Configuration

Relevant settings live in the `domains` and `app` sections of `src/config/app-config.json`: HTML/API/CDN domains, domain server URLs, all secrets, request headers, timeouts and retries.
