# Product

JMFM downloads comics from JMComic. Built with Capacitor + React Web + TypeScript — enter an album ID to run the full pipeline.

## Why JMFM

Source images are sliced into scrambled strips; web endpoints get DNS-blocked; page widths vary and PDFs look uneven. JMFM fetches via the API channel, reassembles strips, and writes local pages/.

## How It Works

1. **Fetch** — mobile API channel; refreshes available domains at startup.
2. **Reassemble** — getNum derives strip counts; crop and reverse-stitch.
3. **Write** — output to `albumDir/pages/` (default webp); reader opens local images. PDF is optional archive.

## Tech Stack

| Area | Choice | Notes |
| --- | --- | --- |
| Framework | Capacitor 8 + React Web | Web UI inside native shell |
| Language | TypeScript | |
| Build | Bun | |
| Networking | Fetch / CapacitorHttp | Domain rotation, retries, proxy; axios only for Node scripts |
| Crypto | crypto-js | MD5, AES-256-ECB |
| Image decode (device/Web) | Web Canvas | Strip reassembly |
| PDF generation | pdf-lib | Optional archive, uniform width |
| Image decode (Node) | ImageMagick | verify script pipeline check |
| Storage | Capacitor Filesystem / Preferences | |
| Testing | bun test | Core algorithm unit tests |

## Home Recommendations

The home screen fetches daily-updated album metadata from the source (covers only, no extra storage), prioritizes albums matching the most frequent tags in the library, and randomly fills remaining slots up to 6. Cached per day and cleared automatically.

## Content Filtering

Albums whose title or tags contain `AI` are hard-blocked from recommendations and downloads, and cannot be disabled. Custom blacklist tags can be added in settings; matches are likewise excluded.

## Status

Daily recommendations, pages download, local reader, library, serial queue, and library repair are all working. `bun run apk` packages an Android installable.
