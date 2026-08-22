#!/usr/bin/env bash
# Usage: scripts/dev-android.sh [auto|device|emulator] [AVD_NAME]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-auto}"
AVD="${2:-${JMFM_AVD:-Medium_Phone_API_36.1}}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
EMU="$SDK/emulator/emulator"
PORT=8081

log()  { printf '\033[36m[dev]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[dev]\033[0m %s\n' "$*" >&2; exit 1; }

metro_up() {
  curl -sf "http://127.0.0.1:$PORT/status" 2>/dev/null | grep -q running
}

start_metro() {
  log "Starting Metro on :$PORT ..."
  cd "$ROOT"
  nohup node node_modules/react-native/cli.js start --no-interactive > /tmp/jmfm-metro.log 2>&1 &
  for _ in $(seq 1 45); do
    metro_up && { log "Metro ready."; return 0; }
    sleep 2
  done
  tail -15 /tmp/jmfm-metro.log
  fail "Metro failed to start. Run 'bun run start' in another terminal."
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
  local lock="$HOME/.android/avd/Medium_Phone.avd"
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
$ADB start-server >/dev/null

TARGET="$(pick_device "$MODE")"
if [[ -z "$TARGET" ]]; then
  [[ "$MODE" == "device" ]] && fail "No physical device. Enable USB debugging and authorize this computer."
  start_emulator
  TARGET="$(pick_device emulator)"
fi
[[ -n "$TARGET" ]] || fail "No target device."

log "Device: $TARGET"
$ADB -s "$TARGET" reverse tcp:$PORT tcp:$PORT >/dev/null 2>&1 || true

metro_up || start_metro

log "Building & installing ..."
cd "$ROOT"
npx react-native run-android --device "$TARGET" --no-packager

log "Done. Logs: tail -f /tmp/jmfm-metro.log"
