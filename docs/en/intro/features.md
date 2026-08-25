# Features

## Stable fetching, network-agnostic

- **API channel first**: no reliance on web endpoints, avoiding domain blocks at the source.
- **Dynamic domain refresh**: decrypts the latest domain list at startup, keeps working even as old domains die.
- **Multi-domain rotation**: switches to backups the moment a request fails; timeout and retry counts are tunable.

## Original-quality restoration

- **Strip calculation**: derives the exact slice count from album traits and image index.
- **Strip reorder**: crops by source position and stitches in reverse, restoring the full picture.
- **Format adaptation**: webp goes through reassembly, gif stays as-is, jpg handled on demand — everything is covered.

## Local albums, instant direct reading

- **pages as the primary artifact**: downloads write `albumDir/pages/` only (default webp); the reader opens via direct image reading.
- **Optional PDF archive**: runtime still exposes `createAlbumPdf` (uniform width, zero padding, title naming) without blocking the download path.
- **Library repair**: Settings runs three checks (metadata / format+count / cover) and re-queues failing items.

## Everything configurable

All key parameters live in `src/config/app-config.json` — no code changes needed:

- Domain lists (HTML / API / CDN / domain servers)
- App secrets and version
- Request headers, timeouts and retries
- Download concurrency limits
- PDF page sizes and max width

## Engineering rigor

- **Frontend/backend split**: the business core is independent of the UI; logic is testable and reusable.
- **Multiple runtimes**: Capacitor / Web / Node share one interface, so verification and on-device behavior match.
- **Full test coverage**: core algorithms are guarded by unit tests, so changes are safe.
