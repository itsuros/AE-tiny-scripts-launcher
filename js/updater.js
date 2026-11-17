/**
 * AE Tiny Scripts Launcher - Self Auto-Updater (js/updater.js)
 * Checks GitHub Releases API for newer semantic versions, downloads release archive,
 * extracts over the extension directory, and reloads the CEP panel.
 */

(function (global) {
  var CURRENT_VERSION = "0.0.0";

  var hasNode = typeof process !== "undefined" && process.versions && !!process.versions.node;
  var fs = null;
  var path = null;
  var os = null;
  var https = null;
  var childProcess = null;

  if (hasNode) {
    try {
      var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
      fs = req("fs");
      path = req("path");
      os = req("os");
      https = req("https");
      childProcess = req("child_process");
    } catch (e) {
      hasNode = false;
    }
  }

  function parseSemver(verStr) {
    if (!verStr) return { major: 0, minor: 0, patch: 0 };
    var cleaned = String(verStr).trim().replace(/^v/i, "").split("-")[0];
    var parts = cleaned.split(".");
    return {
      major: parseInt(parts[0], 10) || 0,
      minor: parseInt(parts[1], 10) || 0,
      patch: parseInt(parts[2], 10) || 0
    };
  }

  /**
   * Returns 1 if a > b, -1 if a < b, 0 if equal
   */
  function compareSemver(a, b) {
    var va = parseSemver(a);
    var vb = parseSemver(b);
    if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
    if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
    if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;
    return 0;
  }

  function fetchReleaseJSON(url, token) {
    var headers = {
      "User-Agent": "AE-Tiny-Scripts-Launcher/" + CURRENT_VERSION,
      Accept: "application/vnd.github.v3+json"
    };
    if (token && token.trim()) {
      headers.Authorization = "Bearer " + token.trim();
    }
    if (typeof fetch === "function") {
      return fetch(url, { headers: headers }).then(function (res) {
        if (!res.ok) {
          throw new Error("GitHub Releases API returned HTTP " + res.status);
        }
        return res.json();
      });
    }
    return new Promise(function (resolve, reject) {
      if (!https) return reject(new Error("HTTPS module unavailable"));
      https
        .get(url, { headers: headers }, function (res) {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchReleaseJSON(res.headers.location, token).then(resolve, reject);
          }
          var chunks = [];
          res.on("data", function (c) {
            chunks.push(c);
          });
          res.on("end", function () {
            var body = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error("GitHub Releases HTTP " + res.statusCode));
            }
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", reject);
    });
  }

  function downloadFileToDisk(url, destFile, token) {
    return new Promise(function (resolve, reject) {
      if (!hasNode || !https || !fs) {
        return reject(new Error("Node.js fs/https is required to install updates."));
      }
      var headers = {
        "User-Agent": "AE-Tiny-Scripts-Launcher/" + CURRENT_VERSION,
        Accept: "application/octet-stream"
      };
      if (token && token.trim()) {
        headers.Authorization = "Bearer " + token.trim();
      }
      https
        .get(url, { headers: headers }, function (res) {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return downloadFileToDisk(res.headers.location, destFile, token).then(resolve, reject);
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error("Failed to download release archive: HTTP " + res.statusCode));
          }
          var out = fs.createWriteStream(destFile);
          res.pipe(out);
          out.on("finish", function () {
            out.close(function () {
              resolve(destFile);
            });
          });
          out.on("error", reject);
        })
        .on("error", reject);
    });
  }

  function checkForUpdates(store) {
    var cfg = store.state.settings.launcherUpdateRepo || {};
    var parsed = global.GitHubSync
      ? global.GitHubSync.parseRepoInput(cfg.owner, cfg.repo)
      : { owner: cfg.owner, repo: cfg.repo };

    if (!parsed.owner || !parsed.repo) {
      return Promise.reject(new Error("Launcher update repository (owner/repo) is not configured in Settings."));
    }

    var token = (store.state.settings.scriptsRepo && store.state.settings.scriptsRepo.token) || "";
    var url =
      "https://api.github.com/repos/" +
      encodeURIComponent(parsed.owner) +
      "/" +
      encodeURIComponent(parsed.repo) +
      "/releases/latest";

    return fetchReleaseJSON(url, token).then(function (release) {
      var latestTag = release.tag_name || release.name || "0.0.0";
      var hasUpdate = compareSemver(latestTag, CURRENT_VERSION) > 0;
      var zipUrl = release.zipball_url;
      if (Array.isArray(release.assets) && release.assets.length > 0) {
        var zipAsset = release.assets.find(function (a) {
          return a.name && a.name.toLowerCase().endsWith(".zip");
        });
        if (zipAsset && zipAsset.browser_download_url) {
          zipUrl = zipAsset.browser_download_url;
        }
      }
      store.updateSettings({
        launcherUpdateRepo: {
          lastCheckedAt: new Date().toISOString(),
          latestAvailableVersion: latestTag
        }
      });
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: latestTag.replace(/^v/i, ""),
        tagName: latestTag,
        hasUpdate: hasUpdate,
        zipUrl: zipUrl,
        releaseNotes: release.body || "",
        htmlUrl: release.html_url || ""
      };
    });
  }

  function copyRecursiveSync(src, dest) {
    var stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      var entries = fs.readdirSync(src);
      entries.forEach(function (entry) {
        if (entry === ".git" || entry === "node_modules") return;
        copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  function installUpdate(updateInfo, extensionDir, token, onStatus) {
    onStatus = typeof onStatus === "function" ? onStatus : function () {};
    if (!hasNode || !fs || !path || !os || !childProcess) {
      return Promise.reject(
        new Error("Automatic in-place update requires CEP Node.js runtime. Please download from GitHub Releases.")
      );
    }
    if (!updateInfo || !updateInfo.zipUrl) {
      return Promise.reject(new Error("No release archive URL found."));
    }

    var tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ae-launcher-update-"));
    var zipFile = path.join(tmpRoot, "release.zip");
    var extractDir = path.join(tmpRoot, "extracted");
    fs.mkdirSync(extractDir, { recursive: true });

    onStatus("Downloading release " + updateInfo.tagName + "...");
    return downloadFileToDisk(updateInfo.zipUrl, zipFile, token).then(function () {
      onStatus("Extracting archive...");
      return new Promise(function (resolve, reject) {
        if (process.platform === "win32") {
          childProcess.execFile(
            "powershell.exe",
            ["-NoProfile", "-Command", "Expand-Archive -Path '" + zipFile + "' -DestinationPath '" + extractDir + "' -Force"],
            function (err) {
              if (err) return reject(err);
              resolve();
            }
          );
        } else {
          childProcess.execFile("unzip", ["-q", "-o", zipFile, "-d", extractDir], function (err) {
            if (err) return reject(err);
            resolve();
          });
        }
      }).then(function () {
        var topEntries = fs.readdirSync(extractDir);
        var sourceRoot = extractDir;
        if (topEntries.length === 1 && fs.statSync(path.join(extractDir, topEntries[0])).isDirectory()) {
          sourceRoot = path.join(extractDir, topEntries[0]);
        }
        onStatus("Applying update to extension directory...");
        copyRecursiveSync(sourceRoot, extensionDir);
        onStatus("Update complete! Reloading panel...");
        return { ok: true };
      });
    });
  }

  global.LauncherUpdater = {
    CURRENT_VERSION: CURRENT_VERSION,
    parseSemver: parseSemver,
    compareSemver: compareSemver,
    checkForUpdates: checkForUpdates,
    installUpdate: installUpdate
  };
})(typeof window !== "undefined" ? window : global);
