/**
 * AE Tiny Scripts Launcher - Local Folders Scanner (js/local-sync.js)
 * Scans one or more configured local directory paths for:
 *   - .jsx, .jsxbin -> script
 *   - .expr.js, .expr.txt, .expr -> expression
 *   - .ffx -> ffx
 * Automatically detects sibling image files with the same base name as the default icon.
 */

(function (global) {
  var hasNode = typeof process !== "undefined" && process.versions && !!process.versions.node;
  var fs = null;
  var path = null;
  var os = null;

  if (hasNode) {
    try {
      var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
      fs = req("fs");
      path = req("path");
      os = req("os");
    } catch (e) {
      hasNode = false;
    }
  }

  function detectType(filename) {
    if (global.GitHubSync && typeof global.GitHubSync.detectItemTypeFromFilename === "function") {
      return global.GitHubSync.detectItemTypeFromFilename(filename);
    }
    var lower = String(filename || "").toLowerCase();
    if (lower.endsWith(".expr.js") || lower.endsWith(".expr.txt") || lower.endsWith(".expr")) {
      return "expression";
    }
    if (lower.endsWith(".ffx")) return "ffx";
    if (lower.endsWith(".jsx") || lower.endsWith(".jsxbin")) return "script";
    return null;
  }

  function cleanName(filename) {
    if (global.GitHubSync && typeof global.GitHubSync.cleanDisplayName === "function") {
      return global.GitHubSync.cleanDisplayName(filename);
    }
    return String(filename || "")
      .replace(/\.(expr\.js|expr\.txt|expr|jsxbin|jsx|ffx)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
  }

  function walkDirectory(dirPath, rootFolder, results, depth) {
    if (depth > 8) return;
    var entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var ent = entries[i];
      if (!ent || !ent.name || ent.name.charAt(0) === ".") continue;
      if (ent.name === "node_modules") continue;
      var fullPath = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        walkDirectory(fullPath, rootFolder, results, depth + 1);
      } else if (ent.isFile()) {
        var itemType = detectType(ent.name);
        if (!itemType) continue;
        var siblingIcon =
          global.IconResolver && typeof global.IconResolver.findSiblingImageFile === "function"
            ? global.IconResolver.findSiblingImageFile(fullPath)
            : "";
        var code = "";
        var rawTextForMeta = "";
        if (itemType === "expression" || ent.name.toLowerCase().endsWith(".jsx")) {
          try {
            rawTextForMeta = fs.readFileSync(fullPath, "utf8");
          } catch (e) {
            rawTextForMeta = "";
          }
          if (itemType === "expression") {
            code = rawTextForMeta;
          }
        }
        var sidecar =
          global.LauncherStore && typeof global.LauncherStore.readSidecarMeta === "function"
            ? global.LauncherStore.readSidecarMeta(fullPath)
            : null;
        var parsedVersion =
          (sidecar && sidecar.version) ||
          (global.LauncherStore && typeof global.LauncherStore.parseContentVersion === "function"
            ? global.LauncherStore.parseContentVersion(rawTextForMeta)
            : "");
        results.push({
          name: (sidecar && sidecar.name) || cleanName(ent.name),
          type: itemType,
          version: parsedVersion || "",
          filePath: fullPath,
          localFolderRoot: rootFolder,
          customIconPath: siblingIcon,
          code: code,
          description: (sidecar && sidecar.description) || "Local: " + fullPath
        });
      }
    }
  }

  function scanLocalFolders(store, options) {
    options = options || {};
    if (!hasNode || !fs || !path) {
      return Promise.reject(new Error("Local folder scanning requires CEP Node.js runtime."));
    }

    var cfg = store.state.settings.localFolders || {};
    var folders = Array.isArray(options.paths) ? options.paths : Array.isArray(cfg.paths) ? cfg.paths : [];
    var cleanFolders = folders
      .map(function (p) {
        return String(p || "").trim();
      })
      .filter(Boolean);

    var foundItems = [];
    var missingFolders = [];

    cleanFolders.forEach(function (folderPath) {
      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        missingFolders.push(folderPath);
        return;
      }
      walkDirectory(folderPath, folderPath, foundItems, 0);
    });

    var pruneMissing = options.pruneMissing !== undefined ? !!options.pruneMissing : !!cfg.pruneMissing;
    var summary = store.mergeLocalItems(foundItems, pruneMissing);
    summary.missingFolders = missingFolders;
    summary.scannedFolderCount = cleanFolders.length - missingFolders.length;
    return Promise.resolve(summary);
  }

  /**
   * Auto-detect common locations where a local AE-tiny-scripts checkout may be placed
   */
  function detectLocalTinyScriptsPath(extensionDir) {
    if (!hasNode || !fs || !path) return "";
    var candidates = [];
    if (extensionDir) {
      candidates.push(path.resolve(extensionDir, "..", "AE-tiny-scripts"));
    }
    if (os && typeof os.homedir === "function") {
      var home = os.homedir();
      candidates.push(path.join(home, "Development", "GitHub", "AE-tiny-scripts"));
      candidates.push(path.join(home, "Documents", "GitHub", "AE-tiny-scripts"));
      candidates.push(path.join(home, "Documents", "AE-tiny-scripts"));
    }
    for (var i = 0; i < candidates.length; i++) {
      try {
        if (fs.existsSync(candidates[i]) && fs.statSync(candidates[i]).isDirectory()) {
          return candidates[i];
        }
      } catch (e) {
        // ignore inaccessible candidate
      }
    }
    return "";
  }

  function readLocalTinyScriptsManifest(repoRoot, subPath) {
    var meta = { version: null, items: {} };
    if (!hasNode || !fs || !path) return meta;
    var targetDir = subPath ? path.join(repoRoot, subPath) : repoRoot;
    var manifestCandidates = [
      path.join(targetDir, "launcher-manifest.json"),
      path.join(repoRoot, "launcher-manifest.json")
    ];
    for (var i = 0; i < manifestCandidates.length; i++) {
      if (fs.existsSync(manifestCandidates[i])) {
        try {
          var parsed = JSON.parse(fs.readFileSync(manifestCandidates[i], "utf8"));
          if (parsed && typeof parsed === "object") {
            meta.version = parsed.version || null;
            meta.items = parsed.items || {};
            return meta;
          }
        } catch (e) {
          // ignore malformed manifest
        }
      }
    }
    var pkgPath = path.join(repoRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        var pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg && typeof pkg.version === "string") {
          meta.version = pkg.version;
        }
      } catch (e) {
        // ignore
      }
    }
    return meta;
  }

  /**
   * Scan the dedicated local AE-tiny-scripts repository directory
   */
  function scanLocalTinyScriptsRepo(store, options) {
    options = options || {};
    if (!hasNode || !fs || !path) {
      return Promise.reject(new Error("Local AE-tiny-scripts loading requires CEP Node.js runtime."));
    }

    var cfg = store.state.settings.localTinyScriptsRepo || {};
    var repoRoot = String(options.path !== undefined ? options.path : cfg.path || "").trim();
    var subPath = String(options.subPath !== undefined ? options.subPath : cfg.subPath || "")
      .trim()
      .replace(/^[/\\]+|[/\\]+$/g, "");

    if (!repoRoot) {
      return Promise.reject(new Error("Local AE-tiny-scripts path is not configured."));
    }
    if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
      return Promise.reject(new Error("Local AE-tiny-scripts directory not found: " + repoRoot));
    }

    var scanDir = subPath ? path.join(repoRoot, subPath) : repoRoot;
    if (!fs.existsSync(scanDir) || !fs.statSync(scanDir).isDirectory()) {
      return Promise.reject(new Error("Configured subdirectory not found inside AE-tiny-scripts: " + scanDir));
    }

    var manifest = readLocalTinyScriptsManifest(repoRoot, subPath);
    var foundItems = [];
    walkDirectory(scanDir, repoRoot, foundItems, 0);

    foundItems.forEach(function (it) {
      var relPosix = path.relative(repoRoot, it.filePath).split(path.sep).join("/");
      var override = manifest.items[relPosix] || {};
      if (override.name) it.name = override.name;
      if (override.version) it.version = String(override.version).trim();
      if (override.description) it.description = override.description;
      if (override.icon) it.icon = override.icon;
      if (override.color) it.color = override.color;
      if (Array.isArray(override.tags)) it.tags = override.tags;
      if (!override.description) {
        it.description = "AE-tiny-scripts (local): " + relPosix;
      }
      if (!it.tags) {
        it.tags = ["ae-tiny-scripts", "local"];
      }
    });

    var pruneMissing = options.pruneMissing !== undefined ? !!options.pruneMissing : cfg.pruneMissing !== false;
    var summary = store.mergeTinyScriptsLocalItems(foundItems, pruneMissing, manifest.version);
    summary.contentVersion = manifest.version;
    summary.scannedPath = scanDir;
    return Promise.resolve(summary);
  }

  global.LocalSync = {
    scanLocalFolders: scanLocalFolders,
    scanLocalTinyScriptsRepo: scanLocalTinyScriptsRepo,
    detectLocalTinyScriptsPath: detectLocalTinyScriptsPath
  };
})(typeof window !== "undefined" ? window : global);
