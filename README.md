# AE Tiny Scripts Launcher

A lightweight, dockable **Adobe After Effects CEP Extension** designed as a modern alternative to Launch Pad for managing and executing **Scripts (`.jsx` / `.jsxbin`)**, **Expressions**, and **Animation Presets (`.ffx`)**.

> **Current Version:** `0.0.0` (Pre-release; Semantic Versioning is used and the version remains `0.0.0` until the first public release.)

---

## Features

- **CEP Dockable Panel**: Built on Adobe CEP v11 (`CSXS 9.0+`, After Effects `16.0+`) with `--enable-nodejs` and automatic host UI theme adaptation (Dark/Light).
- **Icon (Grid) & List Views**: Switch instantaneously between a compact icon grid (Small / Medium / Large) and a detailed list view.
- **Custom Display Ordering**: Reorder items via Drag & Drop or explicit Up/Down controls (`⇅ Reorder`), or sort by Name (`A-Z` / `Z-A`) and Type.
- **GitHub Repository Auto-Sync**: Automatically fetch and download scripts, expressions, and `.ffx` presets from a configurable GitHub repository (`owner/repo`, branch, subdirectory, and optional Personal Access Token).
- **Manual Add / Edit / Delete**: Register local files or inline ExtendScript / Expression snippets alongside GitHub-synced items.
- **Target Picker UI for Expressions & FFX**:
  - **Expressions**: Apply to currently selected timeline properties, common Transform/Time Remap presets across selected/checked layers, or browse a layer's full expression-capable property tree. Supports **Replace / Append / Prepend** modes and **Keyframe Handling** (Keep / Freeze Current Value & Clear / Clear All).
  - **FFX Presets**: Apply to AE selected layers, checked composition layers, or automatically create a **New Adjustment Layer**, **New Solid Layer**, or **New Null Object**. Supports **Time Anchor** (Current Playhead / Layer In-Point / Comp Start), clearing existing effects, and transform keyframe handling.
- **Self Auto-Updater**: Checks GitHub Releases API for newer semantic versions, downloads the release archive, extracts it into the extension directory, and reloads the CEP panel.

---

## Directory Structure

```text
AE-tiny-scripts-launcher/
├── CSXS/
│   └── manifest.xml          # Adobe CEP Extension Manifest (v11 / AEFT)
├── assets/
│   └── icon.svg              # Panel icon
├── css/
│   └── styles.css            # Spectrum-inspired adaptive CEP UI styles
├── js/
│   ├── lib/
│   │   └── CSInterface.js    # Adobe CEP CSInterface wrapper (with browser mock fallback)
│   ├── app.js                # Main UI controller & Target Picker modals
│   ├── github-sync.js        # GitHub repository tree & raw file downloader
│   ├── store.js              # Local JSON / localStorage persistence & custom ordering
│   └── updater.js            # SemVer GitHub Releases self-updater
├── jsx/
│   └── hostscript.jsx        # After Effects ExtendScript bridge
├── scripts/
│   ├── install-dev.sh        # macOS symlink + CSXS PlayerDebugMode setup script
│   └── validate.js           # Node.js validation & unit test suite
├── .debug                    # CEP remote debugging port configuration (8088)
├── index.html                # Panel entry point
├── package.json              # Package metadata (version 0.0.0)
├── CHANGELOG.md              # Release & development changelog
└── LICENSE                   # MIT License
```

---

## Development & Installation (macOS)

1. Run the development symlink script to link the extension into Adobe CEP's extensions folder and enable `PlayerDebugMode`:
   ```bash
   ./scripts/install-dev.sh
   ```
   This symlinks the repository to:
   `~/Library/Application Support/Adobe/CEP/extensions/com.ae.tinyscripts.launcher`
2. Restart **Adobe After Effects**.
3. Open **Window > Extensions > AE Tiny Scripts Launcher**.
4. (Optional) Debug the panel in Chrome/Chromium at `http://localhost:8088`.

### Running Tests

```bash
npm test
```

---

## GitHub Scripts Repository Conventions

When configuring a GitHub repository in **Settings > GitHub Scripts Repository Sync**, the launcher recursively scans the configured branch (and optional subdirectory) and automatically classifies files by extension:

| Extension | Launcher Type |
| :--- | :--- |
| `.jsx`, `.jsxbin` | **Script** |
| `.expr.js`, `.expr.txt`, `.expr` | **Expression** |
| `.ffx` | **Animation Preset (FFX)** |

Downloaded files and launcher state are stored locally under:
- macOS: `~/Library/Application Support/AETinyScriptsLauncher/`
- Windows: `%APPDATA%\AETinyScriptsLauncher\`

---

## Git Branching & Release Workflow

- `main`: Production/release branch (initialized with an empty root commit).
- `develop`: Active integration branch.
- `feat/*`, `fix/*`, `docs/*`: Feature, bugfix, and documentation branches created off `develop` and merged back into `develop`.
- **Release Process**:
  1. Bump the version consistently across `package.json`, `CSXS/manifest.xml`, `js/store.js`, `js/updater.js`, and `CHANGELOG.md`.
  2. Open a Pull Request from `develop` to `main` and merge.
  3. Create an annotated Git tag (e.g. `v0.1.0` or `v1.0.0`) on `main` and publish a GitHub Release so the built-in Self Auto-Updater can detect and install it.

---

## License

Licensed under the [MIT License](LICENSE).
