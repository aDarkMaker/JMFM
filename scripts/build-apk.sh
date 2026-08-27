#!/usr/bin/env bash
# Usage: scripts/build-apk.sh [debug|release]
# Capacitor workflow: build web -> sync android -> assemble APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VARIANT="${1:-debug}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

log()  { printf '\033[36m[apk]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[apk]\033[0m %s\n' "$*" >&2; exit 1; }

case "$VARIANT" in
  debug) GRADLE_TASK="assembleDebug" ;;
  release) GRADLE_TASK="assembleRelease" ;;
  *) fail "Usage: scripts/build-apk.sh [debug|release]" ;;
esac

# Signing keystore lives outside the repo (~/.jmf) and is generated on demand.
# CI sets JMF_KEYSTORE_FILE/JMF_KEYSTORE_PASS from secrets instead.
ensure_keystore() {
  if [[ -n "${JMF_KEYSTORE_FILE:-}" ]]; then
    [[ -f "$JMF_KEYSTORE_FILE" ]] || fail "JMF_KEYSTORE_FILE set but not found: $JMF_KEYSTORE_FILE"
    return
  fi
  local dir="$HOME/.jmf"
  local ks="$dir/jmf.keystore"
  if [[ -f "$ks" ]]; then
    export JMF_KEYSTORE_FILE="$ks"
    return
  fi
  command -v keytool >/dev/null || fail "keytool not found. Install JDK 21+ to generate the signing keystore."
  mkdir -p "$dir"
  log "Generating signing keystore at $ks ..."
  keytool -genkeypair -v -keystore "$ks" -alias jmf \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "${JMF_KEYSTORE_PASS:-jmf123456}" \
    -keypass "${JMF_KEYSTORE_PASS:-jmf123456}" \
    -dname "CN=JMFM, OU=Dev, O=JMFM, L=Unknown, ST=Unknown, C=CN" >/dev/null 2>&1
  export JMF_KEYSTORE_FILE="$ks"
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

require_java21
[[ -d "$SDK" ]] || fail "Android SDK not found. Set ANDROID_HOME."
export ANDROID_HOME="$SDK"

cd "$ROOT"
log "Building web assets ..."
bun run build

log "Syncing Capacitor android ..."
bunx cap sync android

log "Assembling $VARIANT APK ..."
cd "$ROOT/android"
chmod +x ./gradlew
GRADLE_EXTRA=()
if [[ "$VARIANT" == "release" ]]; then
  ensure_keystore
fi
if [[ -n "${CI_VERSION_CODE:-}" ]]; then
  GRADLE_EXTRA+=("-PciVersionCode=${CI_VERSION_CODE}")
elif command -v bun >/dev/null; then
  CI_VERSION_CODE="$(bun -e "import {readVersion} from './scripts/read-version.ts'; console.log(readVersion().versionCode)")"
  GRADLE_EXTRA+=("-PciVersionCode=${CI_VERSION_CODE}")
fi
if [[ -n "${CI_VERSION_NAME:-}" ]]; then
  GRADLE_EXTRA+=("-PciVersionName=${CI_VERSION_NAME}")
elif command -v bun >/dev/null; then
  CI_VERSION_NAME="$(bun -e "import {readVersion} from './scripts/read-version.ts'; console.log(readVersion().version)")"
  GRADLE_EXTRA+=("-PciVersionName=${CI_VERSION_NAME}")
fi
./gradlew "$GRADLE_TASK" --quiet "${GRADLE_EXTRA[@]}"

APK="$(find "$ROOT/android/app/build/outputs/apk/$VARIANT" -name '*.apk' -type f | head -n 1)"
[[ -n "$APK" ]] || fail "APK not found under android/app/build/outputs/apk/$VARIANT"

OUT_DIR="$ROOT/dist-apk"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/jmfmobile-$VARIANT.apk"
cp -f "$APK" "$OUT"

log "Done: $OUT"
printf '%s\n' "$OUT"
