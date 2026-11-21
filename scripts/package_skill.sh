#!/bin/bash

set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
OUTPUT_PATH="${1:-$SOURCE_ROOT/dist/madugong-perspective.zip}"
case "$OUTPUT_PATH" in
  /*) ;;
  *) OUTPUT_PATH="$(pwd)/$OUTPUT_PATH" ;;
esac

case "$OUTPUT_PATH" in
  */)
    printf 'Output path must name a ZIP file: %s\n' "$OUTPUT_PATH" >&2
    exit 2
    ;;
esac

case "$OUTPUT_PATH" in
  */../*|*/./*)
    printf 'Output path must not contain . or .. segments: %s\n' "$OUTPUT_PATH" >&2
    exit 2
    ;;
esac

check_output_path() {
  case "$1" in
    "$SOURCE_ROOT"/dist/*) ;;
    "$SOURCE_ROOT"/*)
      printf 'Refusing output inside the source tree outside dist/: %s\n' "$1" >&2
      exit 2
      ;;
  esac
}

check_output_path "$OUTPUT_PATH"
OUTPUT_PARENT="$(dirname "$OUTPUT_PATH")"
EXISTING_PARENT="$OUTPUT_PARENT"
while [ ! -d "$EXISTING_PARENT" ]; do
  NEXT_PARENT="$(dirname "$EXISTING_PARENT")"
  if [ "$NEXT_PARENT" = "$EXISTING_PARENT" ]; then
    printf 'Cannot resolve output parent: %s\n' "$OUTPUT_PARENT" >&2
    exit 2
  fi
  EXISTING_PARENT="$NEXT_PARENT"
done
EXISTING_PARENT_REAL="$(cd "$EXISTING_PARENT" && pwd -P)"
PROSPECTIVE_PARENT="$EXISTING_PARENT_REAL${OUTPUT_PARENT#"$EXISTING_PARENT"}"
check_output_path "$PROSPECTIVE_PARENT/$(basename "$OUTPUT_PATH")"

mkdir -p "$OUTPUT_PARENT"
OUTPUT_DIR="$(cd "$(dirname "$OUTPUT_PATH")" && pwd -P)"
OUTPUT_PATH="$OUTPUT_DIR/$(basename "$OUTPUT_PATH")"
check_output_path "$OUTPUT_PATH"

if [ -d "$OUTPUT_PATH" ]; then
  printf 'Output path is a directory: %s\n' "$OUTPUT_PATH" >&2
  exit 2
fi

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
  --exclude '.DS_Store' \
  --exclude '*.tmp' \
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

unzip -tq "$OUTPUT_PATH" >/dev/null

printf 'Created %s\n' "$OUTPUT_PATH"
du -h "$OUTPUT_PATH"
