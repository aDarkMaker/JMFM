#!/usr/bin/env bash

is_java17_home() {
  local java="$1/bin/java"
  [[ -x "$java" ]] && "$java" -version 2>&1 | grep -qE 'version "17\.'
}

resolve_java17_home() {
  local home prefix

  if [[ -n "${JAVA_HOME:-}" ]] && is_java17_home "$JAVA_HOME"; then
    echo "$JAVA_HOME"
    return 0
  fi

  if home="$(/usr/libexec/java_home -v 17 2>/dev/null)" && is_java17_home "$home"; then
    echo "$home"
    return 0
  fi

  if command -v brew >/dev/null; then
    prefix="$(brew --prefix openjdk@17 2>/dev/null || true)"
    if [[ -n "$prefix" ]] && is_java17_home "$prefix/libexec/openjdk.jdk/Contents/Home"; then
      echo "$prefix/libexec/openjdk.jdk/Contents/Home"
      return 0
    fi
  fi

  return 1
}

if ! JAVA_HOME="$(resolve_java17_home)"; then
  echo "JDK 17 not found. Install one, e.g. brew install openjdk@17" >&2
  return 1 2>/dev/null || exit 1
fi

export JAVA_HOME
