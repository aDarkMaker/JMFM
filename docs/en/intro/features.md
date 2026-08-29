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

- **pages as primary output**: downloads write `albumDir/pages/` only (default webp), with atomic writes against half-written files.
- **Image reader**: renders local pages/ directly; legacy PDFs via pdf.js.
- **Library repair**: Settings checks metadata, format+count, and covers; missing items are backfilled on demand, full re-download only when an album is entirely gone.

## Configuration

Key parameters in `src/config/app-config.json`:

- Domain lists (HTML / API / CDN / domain servers)
- App secrets and API protocol version
- Request headers, timeouts, retries
- Download concurrency limits

## Engineering

- **Frontend/backend split**: `src/core` is UI-free and unit-testable.
- **Multiple runtimes**: Capacitor / Web / Node share one interface.
- **Unit tests**: getNum, strip reassembly, and other core algorithms covered.
