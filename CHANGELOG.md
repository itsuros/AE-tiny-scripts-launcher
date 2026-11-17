# Changelog

All notable changes to **AE Tiny Scripts Launcher** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Until the first public release, the project version remains `0.0.0`.

## [Unreleased] - 0.0.0

### Added
- **CEP Foundation (`CSXS/manifest.xml`, `.debug`, `js/lib/CSInterface.js`, `jsx/hostscript.jsx`)**:
  - Adobe After Effects CEP v11 panel configuration with `--enable-nodejs` and `--mixed-context`.
  - ExtendScript host bridge for running `.jsx`/`.jsxbin`/inline scripts, inspecting active composition/selection snapshots, and enumerating layer property trees.
  - macOS development installer script (`scripts/install-dev.sh`).
- **Data Store & GitHub Sync (`js/store.js`, `js/github-sync.js`)**:
  - Persistent local state (`launcher-state.json` + `localStorage` fallback) with starter items.
  - GitHub repository recursive tree sync and automatic file classification (`.jsx`/`.jsxbin`, `.expr.js`/`.expr.txt`/`.expr`, `.ffx`).
  - Manual item addition, editing, deletion, and custom display order management (drag-and-drop and explicit shift controls).
- **Self Auto-Updater (`js/updater.js`)**:
  - Semantic version comparison and GitHub Releases API check/download/extract/reload workflow.
- **Launcher UI & Target Selectors (`index.html`, `css/styles.css`, `js/app.js`)**:
  - Adaptive dark/light CEP UI with Grid (Icon) and List view toggling, icon sizing, search, type filtering, and reordering controls.
  - Expression Target Picker UI (Selected Properties, Common Property Presets, Layer Property Tree browser) with Replace/Append/Prepend and Keyframe Handling options.
  - FFX Target Picker UI (AE Selected Layers, Checked Layers, New Adjustment/Solid/Null Layer) with Time Anchor, Clear Existing Effects, and Transform Keyframe options.
- **Validation & Documentation (`scripts/validate.js`, `README.md`, `CHANGELOG.md`, `LICENSE`)**:
  - MIT License, project documentation, and automated Node.js validation test suite.
