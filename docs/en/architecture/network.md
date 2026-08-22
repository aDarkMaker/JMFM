# Networking & API Channel

Data fetching favors the mobile API channel over the HTML channel, because the latter's domains are frequently blocked by DNS.

## HttpClient

`src/core/net/http.ts` provides the base networking layer:

- **Dual protocol**: every domain is tried over both `https://` and `http://`.
- **Domain rotation**: accepts a URL list and tries each in turn until one succeeds.
- **Retry**: each URL can be retried N times (default 3) with a configurable interval.
- **Proxy support**: pass `proxy` to the constructor (e.g. `http://127.0.0.1:7890`).
- **Binary / text**: `getBytes` returns `Uint8Array`; `getHtml` returns text.

```typescript
const http = new HttpClient({proxy: 'http://127.0.0.1:7890'});
const resp = await http.getBytes(url, {Referer, Accept});
```

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
