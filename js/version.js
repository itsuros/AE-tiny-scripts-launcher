/**
 * AE Tiny Scripts Launcher - Version & Channel Metadata (js/version.js)
 * Auto-synced with version.json.
 * - channel: "develop" | "production"
 * - revision: integer incremented per commit on develop builds
 */

(function (global) {
  var meta = {
    version: "0.0.0",
    channel: "develop",
    revision: 30
  };

  // In CEP Node.js / Node test environments, prefer live version.json from the extension root
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    try {
      var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
      var fs = req("fs");
      var path = req("path");
      var candidates = [];
      if (typeof __dirname !== "undefined") {
        candidates.push(path.resolve(__dirname, "..", "version.json"));
      }
      if (typeof process.cwd === "function") {
        candidates.push(path.join(process.cwd(), "version.json"));
      }
      for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) {
          var parsed = JSON.parse(fs.readFileSync(candidates[i], "utf8"));
          if (parsed && typeof parsed.version === "string") {
            meta.version = parsed.version;
            meta.channel = parsed.channel === "production" ? "production" : "develop";
            meta.revision = Number.isFinite(Number(parsed.revision)) ? Number(parsed.revision) : meta.revision;
          }
          break;
        }
      }
    } catch (e) {
      // Fall back to embedded constants
    }
  }

  global.AppVersion = {
    version: meta.version,
    channel: meta.channel,
    revision: meta.revision,
    isDevelop: function () {
      return this.channel !== "production";
    },
    isProduction: function () {
      return this.channel === "production";
    },
    getDisplayBadge: function () {
      if (this.isDevelop()) {
        return "DEV v" + this.version + " (rev." + this.revision + ")";
      }
      return "v" + this.version;
    },
    getShortBadge: function () {
      if (this.isDevelop()) {
        return "DEV r" + this.revision;
      }
      return "PROD";
    },
    getFullVersion: function () {
      if (this.isDevelop()) {
        return this.version + "-dev." + this.revision;
      }
      return this.version;
    }
  };
})(typeof window !== "undefined" ? window : global);
