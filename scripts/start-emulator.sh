#!/usr/bin/env bash
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
AVD="${1:-Medium_Phone_API_36.1}"
LOG="/tmp/jmfm-emulator.log"
LOCK_DIR="$HOME/.android/avd/Medium_Phone.avd"

rm -f "$LOCK_DIR/hardware-qemu.ini.lock" "$LOCK_DIR/multiinstance.lock"
pkill -f qemu-system-aarch64 2>/dev/null || true
adb kill-server 2>/dev/null || true
adb start-server

echo "Starting $AVD (cold boot, no snapshot)..."
nohup "$SDK/emulator/emulator" \
  -avd "$AVD" \
  -gpu host \
  -no-boot-anim \
  -no-snapshot-load \
  -no-snapshot-save \
  > "$LOG" 2>&1 &

echo "Log: $LOG"
echo "Waiting for boot..."

for i in $(seq 1 60); do
  if ! pgrep -f qemu-system-aarch64 >/dev/null; then
    echo "Emulator exited. Last log lines:"
    tail -20 "$LOG"
    exit 1
  fi
  boot=$(adb -e shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
  if [ "$boot" = "1" ]; then
    echo "Ready."
    adb devices -l
    exit 0
  fi
  sleep 5
done

echo "Still booting after 5 min. Check: tail -f $LOG"
exit 2
