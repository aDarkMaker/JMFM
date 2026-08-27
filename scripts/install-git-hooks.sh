#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x .githooks/pre-commit .githooks/pre-push .githooks/push
git config core.hooksPath .githooks
git config alias.jmfpush '!bash "$(git rev-parse --show-toplevel)/.githooks/push"'
git config --unset alias.push 2>/dev/null || true
echo "Git hooks installed (core.hooksPath=.githooks, use: git jmfpush origin main)"
