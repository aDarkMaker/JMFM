#!/usr/bin/env bash
# Usage: scripts/dev-android.sh [auto|device|emulator] [AVD_NAME]
# Capacitor workflow: build web -> sync android -> run on physical device first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-auto}"
AVD="${2:-${JMFM_AVD:-Medium_Phone_API_36.1}}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
EMU="$SDK/emulator/emulator"

log()  { printf '\033[36m[dev]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[dev]\033[0m %s\n' "$*" >&2; exit 1; }

require_java21() {
  if ! command -v java >/dev/null; then
    fail "JDK not found. Capacitor 8 requires JDK 21+. Install one, e.g. brew install openjdk@21"
  fi
  local major
  major="$(java -version 2>&1 | awk -F'[".]' 'NR==1 && /version/ {print $2}')"
  if [[ -n "$major" ]] && (( major < 21 )); then
    fail "JDK $major detected. Capacitor 8 requires JDK 21+. Set JAVA_HOME to JDK 21."
  fi
}

pick_device() {
  local mode="$1" picked="" id
  for id in $($ADB devices | awk 'NR>1 && $2=="device" {print $1}'); do
    case "$mode" in
      device)   [[ "$id" != emulator-* ]] && picked="$id" ;;
      emulator) [[ "$id" == emulator-* ]] && picked="$id" ;;
      auto)
        [[ "$id" != emulator-* ]] && { echo "$id"; return; }
        picked="$id"
        ;;
    esac
  done
  echo "$picked"
}

start_emulator() {
  [[ -x "$EMU" ]] || fail "emulator not found: $EMU"
  local lock="$HOME/.android/avd/${AVD}.avd"
  rm -f "$lock/hardware-qemu.ini.lock" "$lock/multiinstance.lock"
  log "Starting emulator $AVD ..."
  nohup "$EMU" -avd "$AVD" -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save \
    > /tmp/jmfm-emulator.log 2>&1 &
  for _ in $(seq 1 60); do
    pgrep -f qemu-system-aarch64 >/dev/null || fail "Emulator crashed. See /tmp/jmfm-emulator.log"
    local boot=$($ADB -e shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    [[ "$boot" == "1" ]] && return 0
    sleep 5
  done
  fail "Emulator boot timeout."
}

[[ -x "$ADB" ]] || fail "adb not found. Set ANDROID_HOME."
require_java21
$ADB start-server >/dev/null

TARGET="$(pick_device "$MODE")"
if [[ -z "$TARGET" ]]; then
  [[ "$MODE" == "device" ]] && fail "No physical device. Enable USB debugging and authorize this computer."
  start_emulator
  TARGET="$(pick_device emulator)"
fi
[[ -n "$TARGET" ]] || fail "No target device."

log "Device: $TARGET"

cd "$ROOT"
log "Building web assets ..."
bun run build

log "Syncing Capacitor android ..."
bunx cap sync android

log "Building & running on $TARGET ..."
bunx cap run android --target "$TARGET"

log "Done."
