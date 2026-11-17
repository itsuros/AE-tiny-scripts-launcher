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

  if (hasNode) {
    try {
      var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
      fs = req("fs");
      path = req("path");
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

  global.LocalSync = {
    scanLocalFolders: scanLocalFolders
  };
})(typeof window !== "undefined" ? window : global);
