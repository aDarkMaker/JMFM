# Features

## Networking and fetch

- **API channel**: no HTML endpoint dependency; avoids domain blocks.
- **Dynamic domains**: decrypts the latest domain list at startup.
- **Domain rotation**: switches on failure; timeout and retry counts are configurable.

## Image reassembly

- **Strip calculation**: getNum derives slice count from album traits and image index.
- **Strip reorder**: crop by source position, reverse-stitch.
- **Formats**: webp through reassembly; gif as-is; jpg on demand.

## Local storage and reading

- **pages as primary output**: downloads write `albumDir/pages/` only (default webp).
- **Image reader**: renders local pages/ directly.
- **Optional PDF**: runtime exposes `createAlbumPdf` (uniform width, zero padding) without blocking the download path.
- **Library repair**: Settings checks metadata, format+count, and covers; failing items are deleted and re-queued.

## Configuration

Key parameters in `src/config/app-config.json`:

- Domain lists (HTML / API / CDN / domain servers)
- App secrets and version
- Request headers, timeouts, retries
- Download concurrency limits
- PDF page sizes and max width

## Engineering

- **Frontend/backend split**: `src/core` is UI-free and unit-testable.
- **Multiple runtimes**: Capacitor / Web / Node share one interface.
- **Unit tests**: getNum, strip reassembly, and other core algorithms covered.
