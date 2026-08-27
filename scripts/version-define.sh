#!/usr/bin/env bash
# Prints bun --define flags from version.json for build scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(cd "$ROOT" && bun -e "import {readVersion} from './scripts/read-version.ts'; console.log(readVersion().version)")"
printf "%s" "--define:__APP_VERSION__='\"${VERSION}\"'"
