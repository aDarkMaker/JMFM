#!/usr/bin/env bash
# Prints bun --define flags from version.json for build scripts.
# The space form (`--define KEY=VALUE`) is required: bun 1.3 ignores `--define:KEY=VALUE`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(cd "$ROOT" && bun -e "import {readVersion} from './scripts/read-version.ts'; console.log(readVersion().version)")"
printf "%s" "--define __APP_VERSION__='\"${VERSION}\"'"
