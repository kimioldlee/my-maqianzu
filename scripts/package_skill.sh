#!/bin/bash

set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_PATH="${1:-$SOURCE_ROOT/dist/madugong-perspective.zip}"
STAGING_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/madugong-package.XXXXXX")"
PACKAGE_ROOT="$STAGING_ROOT/madugong-perspective"

cleanup() {
  rm -rf "$STAGING_ROOT"
}
trap cleanup EXIT

mkdir -p "$PACKAGE_ROOT" "$(dirname "$OUTPUT_PATH")"
rsync -a \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude 'dist/' \
  --exclude 'outputs/' \
  --exclude 'tests/' \
  --exclude 'scripts/generate_*' \
  --exclude 'scripts/index_*' \
  --exclude 'scripts/refresh_*' \
  --exclude 'scripts/register_*' \
  --exclude 'scripts/sync_*' \
  --exclude 'scripts/zhihu/' \
  --exclude 'sync-local-retrieval.ps1' \
  --exclude 'scripts/install.sh' \
  --exclude 'scripts/package_skill.sh' \
  "$SOURCE_ROOT/" "$PACKAGE_ROOT/"

rm -f "$OUTPUT_PATH"
(
  cd "$STAGING_ROOT"
  zip -q -r "$OUTPUT_PATH" madugong-perspective
)

printf 'Created %s\n' "$OUTPUT_PATH"
du -h "$OUTPUT_PATH"
