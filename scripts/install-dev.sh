#!/usr/bin/env bash
set -e

EXT_ID="com.ae.tinyscripts.launcher"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"

remove_existing_target() {
  if [ -L "$TARGET_DIR" ]; then
    rm "$TARGET_DIR"
  elif [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
  fi
}

echo "=== AE Tiny Scripts Launcher Dev Setup ==="

if [ "${1:-}" = "--uninstall" ] || [ "${1:-}" = "-u" ]; then
  if [ -L "$TARGET_DIR" ] || [ -d "$TARGET_DIR" ]; then
    remove_existing_target
    echo "Removed link/installation at: $TARGET_DIR"
  else
    echo "Nothing to remove at: $TARGET_DIR"
  fi
  exit 0
fi

mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"

if [ -L "$TARGET_DIR" ] || [ -d "$TARGET_DIR" ]; then
  echo "Removing existing installation at: $TARGET_DIR"
  remove_existing_target
fi

ln -s "$SRC_DIR" "$TARGET_DIR"
echo "Linked $SRC_DIR -> $TARGET_DIR"

# Enable PlayerDebugMode for CSXS 9 through 12
for ver in 9 10 11 12; do
  defaults write com.adobe.CSXS.$ver PlayerDebugMode 1 || true
done

echo "Enabled PlayerDebugMode for CSXS 9-12."

if [ -d "$SRC_DIR/.git" ]; then
  git -C "$SRC_DIR" config core.hooksPath .githooks || true
  echo "Configured git core.hooksPath -> .githooks (auto revision bump on develop commits)."
fi

echo "Setup complete! Restart After Effects and open Window > Extensions > AE Tiny Scripts Launcher."
