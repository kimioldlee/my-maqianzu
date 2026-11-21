#!/bin/bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/install.sh --personal
  bash scripts/install.sh --project /absolute/project/path

Installs the complete runtime skill. Re-run after updating the source clone.
EOF
}

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MODE="${1:---personal}"

case "$MODE" in
  --personal)
    [ "$#" -eq 1 ] || { usage; exit 2; }
    TARGET_ROOT="${HOME}/.claude/skills/madugong-perspective"
    ;;
  --project)
    [ "$#" -eq 2 ] || { usage; exit 2; }
    PROJECT_ROOT="$(cd "$2" && pwd)"
    TARGET_ROOT="${PROJECT_ROOT}/.claude/skills/madugong-perspective"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 2
    ;;
esac

if [ "$SOURCE_ROOT" = "$TARGET_ROOT" ]; then
  printf 'Skill is already installed at %s\n' "$TARGET_ROOT"
  exit 0
fi

if [ -L "$TARGET_ROOT" ]; then
  printf 'Refusing to install through a symbolic link: %s\n' "$TARGET_ROOT" >&2
  exit 2
fi

if [ -e "$TARGET_ROOT/.git" ]; then
  printf 'Target is a Git clone; update it with git pull --ff-only instead: %s\n' "$TARGET_ROOT" >&2
  exit 2
fi

if [ -e "$TARGET_ROOT" ] && [ ! -d "$TARGET_ROOT" ]; then
  printf 'Target exists and is not a directory: %s\n' "$TARGET_ROOT" >&2
  exit 2
fi

mkdir -p "$TARGET_ROOT"
rsync -a --delete \
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
  "$SOURCE_ROOT/" "$TARGET_ROOT/"

printf 'Installed madugong-perspective to %s\n' "$TARGET_ROOT"
printf 'Restart Claude Code if the skill is not detected immediately.\n'
