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

### FetchHttpClient (Web)

`src/core/net/fetch-http.ts` is built on the browser `fetch` API and is the default at runtime on Web:

```typescript
const http = new FetchHttpClient({timeoutMs: 15000, maxRetries: 2});
const resp = await http.getBytes(url, {Referer, Accept});
```

### NativeHttpClient (Capacitor device)

`src/core/net/native-http.ts` implements the same interface on `CapacitorHttp` (the native networking stack), bypassing WebView CORS for on-device downloads; it falls back to the WebView `fetch` when the native stack fails:

```typescript
import {createHttpClient} from '../src/core/net';

// On device: NativeHttpClient (native stack, with fetch fallback)
// On Web: FetchHttpClient
const http = createHttpClient({timeoutMs: 15000, maxRetries: 2});
```

Binary responses (`responseType: 'arraybuffer'`) are returned as Base64 strings by the native layer; `NativeHttpClient` converts them back to `Uint8Array` with `base64ToBytes`.

### Unified Retry

`requestWithRetry` in `src/core/net/retry.ts` centralizes the "domain rotation × per-URL retry" loop shared by the Fetch and native implementations; the axios client (`scripts/shared/axios-http.ts`) is used by Node scripts only.

## ApiClient

`src/core/api/client.ts` wraps the API channel; `src/core/api/parse.ts` holds the pure parsing functions.

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

Under rate limiting the source may return `code=200` with empty/corrupted `data`; `req` regenerates `ts`/`token` and retries after 2s (up to 3 attempts).

### Image URL Construction

CDN domains rotate by `photoId % CDN count`:

```text
https://{cdn[photoId % len]}/media/photos/{photoId}/{fileName}
```

## Configuration

Relevant settings live in the `domains` and `app` sections of `src/config/app-config.json`: HTML/API/CDN domains, domain server URLs, all secrets, request headers, timeouts and retries.
