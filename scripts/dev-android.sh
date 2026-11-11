#!/usr/bin/env bash
# Usage: scripts/dev-android.sh [live|usb|package|auto|device|emulator] [AVD_NAME]
#   live     LAN dev server (cap run -l), no rebuild per change
#   usb      adb reverse, for networks that block device<->host traffic
#   package  build once into a debug app that points at the LAN dev server
#   auto|device|emulator  legacy: build web -> sync -> run (no live reload)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-auto}"
AVD="${2:-${JMFM_AVD:-Medium_Phone_API_36.1}}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
EMU="$SDK/emulator/emulator"
DEV_PORT="${DEV_PORT:-3000}"

log()  { printf '\033[36m[dev]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[dev]\033[0m %s\n' "$*" >&2; exit 1; }

lan_ip() {
  local ip
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [[ -z "$ip" ]] && ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -z "$ip" ]]; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')"
  fi
  echo "$ip"
}

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

TARGET="$(pick_device auto)"
if [[ -z "$TARGET" ]]; then
  start_emulator
  TARGET="$(pick_device emulator)"
fi
[[ -n "$TARGET" ]] || fail "No target device."
log "Device: $TARGET"

cd "$ROOT"

case "$MODE" in
  live)
    HOST_IP="$(lan_ip)"
    [[ -n "$HOST_IP" ]] || fail "No LAN IP. Use: bun run dev:android:usb"
    log "Start the dev server in another terminal: bun run dev:web"
    log "Live reload → http://$HOST_IP:$DEV_PORT/  (refresh to pick up edits)"
    bunx cap run android --target "$TARGET" -l --host "$HOST_IP" --port "$DEV_PORT" --no-sync
    ;;
  usb)
    log "adb reverse tcp:$DEV_PORT tcp:$DEV_PORT"
    "$ADB" -s "$TARGET" reverse "tcp:$DEV_PORT" "tcp:$DEV_PORT"
    log "Start the dev server in another terminal: bun run dev:web"
    log "Live reload → http://localhost:$DEV_PORT/  (USB; refresh to pick up edits)"
    bunx cap run android --target "$TARGET" -l --host localhost --port "$DEV_PORT" --no-sync
    ;;
  package)
    HOST_IP="$(lan_ip)"
    [[ -n "$HOST_IP" ]] || fail "No LAN IP. Use: bun run dev:android:usb"
    log "Building web assets ..."
    bun run build
    log "Syncing Capacitor android ..."
    bunx cap sync android
    log "Baking dev server URL http://$HOST_IP:$DEV_PORT/ into the debug app ..."
    bunx cap run android --target "$TARGET" -l --host "$HOST_IP" --port "$DEV_PORT" --no-sync
    ;;
  auto|device|emulator)
    log "Building web assets ..."
    bun run build
    log "Syncing Capacitor android ..."
    bunx cap sync android
    log "Building & running on $TARGET ..."
    bunx cap run android --target "$TARGET"
    ;;
  *)
    fail "Usage: scripts/dev-android.sh [live|usb|package|auto|device|emulator] [AVD_NAME]"
    ;;
esac

log "Done."
