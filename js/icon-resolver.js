/**
 * AE Tiny Scripts Launcher - Sibling Icon Resolver (js/icon-resolver.js)
 * Detects an image file with the same base name in the same directory as a script/expression/ffx
 * and converts local file paths to safe file:// URLs for rendering in the launcher UI.
 */

(function (global) {
  var IMAGE_EXTS = [".png", ".svg", ".jpg", ".jpeg", ".webp", ".gif", ".ico"];

  var hasNode = typeof process !== "undefined" && process.versions && !!process.versions.node;
  var fs = null;
  var path = null;
  var urlMod = null;

  if (hasNode) {
    try {
      var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
      fs = req("fs");
      path = req("path");
      urlMod = req("url");
    } catch (e) {
      hasNode = false;
    }
  }

  function getCandidateBaseNames(filename) {
    var base = String(filename || "").split(/[/\\]/).pop();
    var candidates = [];
    // e.g. wiggle.expr.js -> ["wiggle", "wiggle.expr"]
    var strippedMulti = base.replace(/\.(expr\.js|expr\.txt|expr|jsxbin|jsx|ffx)$/i, "");
    if (strippedMulti) {
      candidates.push(strippedMulti);
    }
    var lastDot = base.lastIndexOf(".");
    if (lastDot > 0) {
      var strippedSingle = base.slice(0, lastDot);
      if (candidates.indexOf(strippedSingle) === -1) {
        candidates.push(strippedSingle);
      }
    }
    return candidates;
  }

  function isSupportedImageFile(filename) {
    var lower = String(filename || "").toLowerCase();
    for (var i = 0; i < IMAGE_EXTS.length; i++) {
      if (lower.endsWith(IMAGE_EXTS[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Look up a sibling image file in the same directory as `scriptFilePath`.
   * Returns the resolved image path, or "" if none exists.
   */
  function findSiblingImageFile(scriptFilePath) {
    if (!hasNode || !fs || !path || !scriptFilePath) {
      return "";
    }
    try {
      var dir = path.dirname(scriptFilePath);
      if (!dir || !fs.existsSync(dir)) {
        return "";
      }
      var baseName = path.basename(scriptFilePath);
      var candidates = getCandidateBaseNames(baseName);
      if (candidates.length === 0) return "";

      var entries = fs.readdirSync(dir);
      var lowerMap = {};
      for (var i = 0; i < entries.length; i++) {
        lowerMap[entries[i].toLowerCase()] = entries[i];
      }

      for (var c = 0; c < candidates.length; c++) {
        for (var e = 0; e < IMAGE_EXTS.length; e++) {
          var targetName = (candidates[c] + IMAGE_EXTS[e]).toLowerCase();
          if (lowerMap[targetName]) {
            var full = path.join(dir, lowerMap[targetName]);
            if (fs.statSync(full).isFile()) {
              return full;
            }
          }
        }
      }
    } catch (err) {
      // ignore filesystem read errors
    }
    return "";
  }

  /**
   * Find a matching sibling image entry from a list of repository relative paths (e.g. GitHub tree).
   */
  function findMatchingSiblingEntry(allPaths, scriptRelPath) {
    if (!Array.isArray(allPaths) || !scriptRelPath) return null;
    var slashIdx = scriptRelPath.lastIndexOf("/");
    var dirPrefix = slashIdx >= 0 ? scriptRelPath.slice(0, slashIdx + 1) : "";
    var fileName = slashIdx >= 0 ? scriptRelPath.slice(slashIdx + 1) : scriptRelPath;
    var candidates = getCandidateBaseNames(fileName);
    if (candidates.length === 0) return null;

    var lowerLookup = {};
    for (var i = 0; i < allPaths.length; i++) {
      var p = allPaths[i];
      if (p.indexOf(dirPrefix) !== 0) continue;
      var rest = p.slice(dirPrefix.length);
      if (rest.indexOf("/") >= 0) continue; // must be in the exact same directory
      lowerLookup[rest.toLowerCase()] = p;
    }

    for (var c = 0; c < candidates.length; c++) {
      for (var e = 0; e < IMAGE_EXTS.length; e++) {
        var key = (candidates[c] + IMAGE_EXTS[e]).toLowerCase();
        if (lowerLookup[key]) {
          return lowerLookup[key];
        }
      }
    }
    return null;
  }

  function toFileUrl(localPath) {
    if (!localPath) return "";
    if (/^(https?:|data:|file:)/i.test(localPath)) {
      return localPath;
    }
    if (urlMod && typeof urlMod.pathToFileURL === "function") {
      try {
        return urlMod.pathToFileURL(localPath).href;
      } catch (e) {
        // fallback below
      }
    }
    var normalized = String(localPath).replace(/\\/g, "/");
    if (/^[A-Za-z]:\//.test(normalized)) {
      return "file:///" + encodeURI(normalized);
    }
    if (normalized.charAt(0) !== "/") {
      normalized = "/" + normalized;
    }
    return "file://" + encodeURI(normalized);
  }

  global.IconResolver = {
    IMAGE_EXTS: IMAGE_EXTS,
    getCandidateBaseNames: getCandidateBaseNames,
    isSupportedImageFile: isSupportedImageFile,
    findSiblingImageFile: findSiblingImageFile,
    findMatchingSiblingEntry: findMatchingSiblingEntry,
    toFileUrl: toFileUrl
  };
})(typeof window !== "undefined" ? window : global);
