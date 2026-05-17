#!/usr/bin/env sh
set -eu

query="${CODETRAP_QUERY:-${1:-}}"
if [ -z "$query" ]; then
  echo "CODETRAP_QUERY or first argument is required" >&2
  exit 2
fi

codetrap search "$query" --mode hybrid --json
