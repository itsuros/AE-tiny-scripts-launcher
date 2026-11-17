/**
 * AE Tiny Scripts Launcher - GitHub Scripts Repository Synchronizer (js/github-sync.js)
 * Connects to a user-configured GitHub repository (`owner/repo`), inspects either:
 * 1) `launcher-manifest.json` (if present in the target path) for rich metadata, OR
 * 2) Automatic recursive directory listing via GitHub Contents/Trees API for:
 *    - `.jsx`, `.jsxbin` -> Script
 *    - `.expr.js`, `.expr.txt`, `.expr` -> Expression
 *    - `.ffx` -> FFX Preset
 * Downloads files locally into `AETinyScriptsLauncher/github_scripts` and merges them into LauncherStore.
 */

(function (global) {
  var hasNode = typeof process !== "undefined" && process.versions && !!process.versions.node;
  var fs = null;
  var path = null;
  var https = null;

  if (hasNode) {
    try {
      var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
      fs = req("fs");
      path = req("path");
      https = req("https");
    } catch (e) {
      hasNode = false;
    }
  }

  function buildHeaders(token, accept) {
    var headers = {
      "User-Agent": "AE-Tiny-Scripts-Launcher/0.0.0",
      Accept: accept || "application/vnd.github.v3+json"
    };
    if (token && token.trim().length > 0) {
      headers.Authorization = "Bearer " + token.trim();
    }
    return headers;
  }

  function fetchJSON(url, token) {
    if (typeof fetch === "function") {
      return fetch(url, { headers: buildHeaders(token) }).then(function (res) {
        if (!res.ok) {
          throw new Error("GitHub API HTTP " + res.status + " (" + res.statusText + ")");
        }
        return res.json();
      });
    }
    return new Promise(function (resolve, reject) {
      if (!https) return reject(new Error("HTTPS client unavailable."));
      https
        .get(url, { headers: buildHeaders(token) }, function (res) {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchJSON(res.headers.location, token).then(resolve, reject);
          }
          var chunks = [];
          res.on("data", function (c) {
            chunks.push(c);
          });
          res.on("end", function () {
            var body = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error("GitHub API HTTP " + res.statusCode + ": " + body.slice(0, 180)));
            }
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on("error", reject);
    });
  }

  function fetchRawBuffer(url, token) {
    if (typeof fetch === "function") {
      return fetch(url, { headers: buildHeaders(token, "application/octet-stream") }).then(function (res) {
        if (!res.ok) {
          throw new Error("Download failed HTTP " + res.status);
        }
        return res.arrayBuffer();
      });
    }
    return new Promise(function (resolve, reject) {
      if (!https) return reject(new Error("HTTPS client unavailable."));
      https
        .get(url, { headers: buildHeaders(token, "application/octet-stream") }, function (res) {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchRawBuffer(res.headers.location, token).then(resolve, reject);
          }
          var chunks = [];
          res.on("data", function (c) {
            chunks.push(c);
          });
          res.on("end", function () {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error("Download HTTP " + res.statusCode));
            }
            resolve(Buffer.concat(chunks));
          });
        })
        .on("error", reject);
    });
  }

  function detectItemTypeFromFilename(filename) {
    var lower = filename.toLowerCase();
    if (lower.endsWith(".expr.js") || lower.endsWith(".expr.txt") || lower.endsWith(".expr")) {
      return "expression";
    }
    if (lower.endsWith(".ffx")) {
      return "ffx";
    }
    if (lower.endsWith(".jsx") || lower.endsWith(".jsxbin")) {
      return "script";
    }
    return null;
  }

  function cleanDisplayName(filename) {
    return filename
      .replace(/\.(expr\.js|expr\.txt|expr|jsxbin|jsx|ffx)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
  }

  function saveFileLocally(syncDir, relativePath, arrayBufferOrBuffer) {
    if (!hasNode || !fs || !path) {
      return "";
    }
    var safeRel = relativePath.replace(/\.\./g, "");
    var fullPath = path.join(syncDir, safeRel);
    var parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    var buf = Buffer.isBuffer(arrayBufferOrBuffer) ? arrayBufferOrBuffer : Buffer.from(arrayBufferOrBuffer);
    fs.writeFileSync(fullPath, buf);
    return fullPath;
  }

  /**
   * Parse "owner/repo" or full GitHub URL into { owner, repo }
   */
  function parseRepoInput(ownerInput, repoInput) {
    var combined = (ownerInput || "").trim();
    if (combined.indexOf("github.com/") >= 0) {
      var m = combined.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
      if (m) {
        return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
      }
    }
    if (combined.indexOf("/") >= 0 && !repoInput) {
      var parts = combined.split("/");
      return { owner: parts[0].trim(), repo: parts[1].trim().replace(/\.git$/i, "") };
    }
    return {
      owner: combined,
      repo: (repoInput || "").trim().replace(/\.git$/i, "")
    };
  }

  /**
   * Synchronize scripts/expressions/FFX from configured GitHub repository
   */
  function syncFromGitHub(store, options) {
    options = options || {};
    var cfg = store.state.settings.scriptsRepo;
    var parsed = parseRepoInput(options.owner || cfg.owner, options.repo || cfg.repo);
    var branch = (options.branch || cfg.branch || "main").trim();
    var subPath = (options.subPath !== undefined ? options.subPath : cfg.subPath || "").replace(/^\/+|\/+$/g, "");
    var token = options.token !== undefined ? options.token : cfg.token;
    var onProgress = typeof options.onProgress === "function" ? options.onProgress : function () {};

    if (!parsed.owner || !parsed.repo) {
      return Promise.reject(new Error("Please configure GitHub Repository Owner and Repo name in Settings."));
    }

    var syncDir = store.getScriptsSyncDir();
    var treeUrl =
      "https://api.github.com/repos/" +
      encodeURIComponent(parsed.owner) +
      "/" +
      encodeURIComponent(parsed.repo) +
      "/git/trees/" +
      encodeURIComponent(branch) +
      "?recursive=1";

    onProgress("Fetching repository file tree from " + parsed.owner + "/" + parsed.repo + " (" + branch + ")...");

    return fetchJSON(treeUrl, token).then(function (treeData) {
      var tree = Array.isArray(treeData.tree) ? treeData.tree : [];
      var allBlobPaths = tree
        .filter(function (n) {
          return n.type === "blob";
        })
        .map(function (n) {
          return n.path;
        });

      var candidateFiles = tree.filter(function (node) {
        if (node.type !== "blob") return false;
        if (subPath && node.path.indexOf(subPath + "/") !== 0 && node.path !== subPath) {
          return false;
        }
        return detectItemTypeFromFilename(node.path) !== null;
      });

      var syncedItems = [];
      var chain = Promise.resolve();

      function buildRawUrl(relPath) {
        return (
          "https://raw.githubusercontent.com/" +
          encodeURIComponent(parsed.owner) +
          "/" +
          encodeURIComponent(parsed.repo) +
          "/" +
          encodeURIComponent(branch) +
          "/" +
          relPath
            .split("/")
            .map(encodeURIComponent)
            .join("/")
        );
      }

      // Check for optional launcher-manifest.json in subPath or root for independent content versioning
      var manifestCandidates = subPath ? [subPath + "/launcher-manifest.json", "launcher-manifest.json"] : ["launcher-manifest.json"];
      var manifestPath = null;
      for (var mIdx = 0; mIdx < manifestCandidates.length; mIdx++) {
        if (allBlobPaths.indexOf(manifestCandidates[mIdx]) >= 0) {
          manifestPath = manifestCandidates[mIdx];
          break;
        }
      }

      var manifestData = { version: null, items: {} };

      if (manifestPath) {
        chain = chain.then(function () {
          return fetchRawBuffer(buildRawUrl(manifestPath), token)
            .then(function (buf) {
              var txt =
                typeof TextDecoder !== "undefined" && !(buf instanceof Buffer)
                  ? new TextDecoder("utf-8").decode(buf)
                  : Buffer.from(buf).toString("utf8");
              var parsedManifest = JSON.parse(txt);
              if (parsedManifest && typeof parsedManifest === "object") {
                manifestData.version = parsedManifest.version || null;
                manifestData.items = parsedManifest.items || {};
              }
            })
            .catch(function () {
              // ignore invalid manifest
            });
        });
      }

      candidateFiles.forEach(function (fileNode, idx) {
        chain = chain.then(function () {
          var itemType = detectItemTypeFromFilename(fileNode.path);
          var rawUrl = buildRawUrl(fileNode.path);

          onProgress("Downloading (" + (idx + 1) + "/" + candidateFiles.length + "): " + fileNode.path);

          return fetchRawBuffer(rawUrl, token).then(function (buf) {
            var localPath = saveFileLocally(syncDir, fileNode.path, buf);
            var textCode = "";
            if (itemType === "script" || itemType === "expression") {
              if (typeof TextDecoder !== "undefined" && !(buf instanceof Buffer)) {
                textCode = new TextDecoder("utf-8").decode(buf);
              } else if (typeof Buffer !== "undefined") {
                textCode = Buffer.from(buf).toString("utf8");
              }
            }

            // Check if a sibling image with the same base name exists in the same GitHub directory
            var siblingImageRel =
              global.IconResolver && typeof global.IconResolver.findMatchingSiblingEntry === "function"
                ? global.IconResolver.findMatchingSiblingEntry(allBlobPaths, fileNode.path)
                : null;

            var iconPromise = Promise.resolve("");
            if (siblingImageRel) {
              iconPromise = fetchRawBuffer(buildRawUrl(siblingImageRel), token)
                .then(function (imgBuf) {
                  return saveFileLocally(syncDir, siblingImageRel, imgBuf);
                })
                .catch(function () {
                  return "";
                });
            }

            return iconPromise.then(function (localIconPath) {
              var baseName = fileNode.path.split("/").pop();
              var manifestItem = manifestData.items[fileNode.path] || {};
              var itemVersion =
                manifestItem.version ||
                (global.LauncherStore && typeof global.LauncherStore.parseContentVersion === "function"
                  ? global.LauncherStore.parseContentVersion(textCode)
                  : "");
              syncedItems.push({
                name: manifestItem.name || cleanDisplayName(baseName),
                type: itemType,
                version: itemVersion || "",
                remotePath: fileNode.path,
                sha: fileNode.sha,
                filePath: localPath,
                customIconPath: localIconPath || "",
                code: itemType === "expression" || !localPath ? textCode : "",
                description: manifestItem.description || "GitHub: " + parsed.owner + "/" + parsed.repo + " (" + fileNode.path + ")"
              });
            });
          });
        });
      });

      return chain.then(function () {
        if (store.state.settings.scriptsRepo) {
          store.state.settings.scriptsRepo.contentVersion = manifestData.version || null;
        }
        var summary = store.mergeGitHubItems(syncedItems, !!options.removeMissingRemote);
        summary.contentVersion = manifestData.version || null;
        onProgress("Sync complete! " + summary.added + " added, " + summary.updated + " updated.");
        return summary;
      });
    });
  }

  global.GitHubSync = {
    parseRepoInput: parseRepoInput,
    detectItemTypeFromFilename: detectItemTypeFromFilename,
    cleanDisplayName: cleanDisplayName,
    syncFromGitHub: syncFromGitHub
  };
})(typeof window !== "undefined" ? window : global);
