#!/usr/bin/env bash
set -e

EXT_ID="com.ae.tinyscripts.launcher"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"

echo "=== AE Tiny Scripts Launcher Dev Setup ==="
mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"

if [ -L "$TARGET_DIR" ] || [ -d "$TARGET_DIR" ]; then
  echo "Removing existing installation at: $TARGET_DIR"
  rm -rf "$TARGET_DIR"
fi

ln -s "$SRC_DIR" "$TARGET_DIR"
echo "Linked $SRC_DIR -> $TARGET_DIR"

# Enable PlayerDebugMode for CSXS 9 through 12
for ver in 9 10 11 12; do
  defaults write com.adobe.CSXS.$ver PlayerDebugMode 1 || true
done

echo "Enabled PlayerDebugMode for CSXS 9-12."
echo "Setup complete! Restart After Effects and open Window > Extensions > AE Tiny Scripts Launcher."
