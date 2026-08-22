# Changelog

## 2026-08-22

### PDF Assembly Fix

- **Issue**: generated PDFs had tiny pages and large white placeholders with wrong page sizes.
- **Root cause**: ImageMagick strip crops left virtual-page metadata; after `-append`, the virtual page stayed at the first strip's height, so the PDF MediaBox was set to that wrong height and the full image was squeezed into a short page.
- **Fix**: added `+repage` after `-append` in `decodeWithMagick`, and `+repage` before assembling in `createPdfWithMagick`.
- **Verification**: all pages 960pt wide at full image heights (670-1386pt), no white placeholders.

### Uniform PDF Width

- Added `src/core/pdf/layout.ts`: `computeUniformWidth` (target width = min(max source width, 1190)) and `scaleSize` (proportional scaling).
- Node runtime: `identify` all widths, then a single `-resize`.
- RN runtime: `buildPdfPages(imagePaths, sizes?)` lays out pages from actual sizes with `imageFit: 'fill'`; the download orchestration records each decoded page size.
- Mixed-width test: a 200x300 and a 400x600 image both become 400x600, no padding.

### Pipeline Completed

- `DownloadService` now uses `ApiClient` as its `ContentSource`, with a fallback for single-chapter albums with empty series.
- Extracted the `DownloadRuntime` interface into `src/core/download/types.ts`, shared by RN and Node runtimes.
- `scripts/node-runtime.ts`: ImageMagick decode + PDF generation.
- Full verification on real album 1327951 (50-page PDF).

### Config Externalized

- Added `src/config/app-config.json` centralizing domains, secrets, request headers, download concurrency and PDF params.
- Core modules read from config; hardcoded values removed.

## 2026-08-21

### API Channel Working

- Implemented `ApiClient`: dynamic domain refresh (AES-decrypted domain list), token generation, response decryption, image URL construction.
- Fixed AES-256-ECB key derivation: the 32-byte ASCII of `md5(secret + ts)` is used as the key, matching the Python jmcomic library.
- Implemented pure-TS Base64 / UTF-8 decoding, replacing Node-specific APIs (RN-compatible).
- Conclusion: under the current network, the HTML channel is DNS-blocked while the API channel works.

### Project Rewrite

- Fully rewrote from Android (Java) to React Native + TypeScript.
- Cleared the old Gradle project; scaffolded pure TS (no `.js` files).
- Removed the leftover internal npm mirror config from `~/.npmrc`.
