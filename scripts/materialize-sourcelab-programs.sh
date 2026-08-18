#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$ROOT_DIR/.source-packages/sourcelab_learnx_content.tar.gz"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "SourceLab curriculum archive not found: $ARCHIVE" >&2
  exit 1
fi

cd "$ROOT_DIR"
tar -xzf "$ARCHIVE" --strip-components=1
pnpm exec tsx scripts/validate-sourcelab-programs.ts

echo
printf '%s\n' \
  'SourceLab learning programs materialized and validated.' \
  'Review the generated diff, then remove bootstrap payloads before the final commit.'
