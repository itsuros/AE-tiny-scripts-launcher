/**
 * AE Tiny Scripts Launcher - Data Store & Persistence (js/store.js)
 * Manages items (Script / Expression / FFX), settings, ordering, and persistence.
 * Works both inside CEP (Node.js fs + localStorage) and in standalone browser mode.
 */

(function (global) {
  var STORAGE_KEY = "ae_tiny_scripts_launcher_state_v1";

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

  function getDataDir(customDir) {
    if (hasNode && os && path) {
      var base =
        process.platform === "win32"
          ? process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
          : path.join(os.homedir(), "Library", "Application Support");
      var dir = customDir || path.join(base, "AETinyScriptsLauncher");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      var syncDir = path.join(dir, "github_scripts");
      if (!fs.existsSync(syncDir)) {
        fs.mkdirSync(syncDir, { recursive: true });
      }
      var manualDir = path.join(dir, "manual_files");
      if (!fs.existsSync(manualDir)) {
        fs.mkdirSync(manualDir, { recursive: true });
      }
      return dir;
    }
    return customDir || "/tmp/AETinyScriptsLauncher";
  }

  function getDefaultStarterItems() {
    return [
      {
        id: "starter-script-center-anchor",
        name: "Center Anchor Point",
        type: "script",
        source: "manual",
        icon: "anchor",
        color: "#4f8cff",
        description: "Centers the anchor point of selected layers to their layer bounds while keeping position.",
        filePath: "",
        code: [
          "(function() {",
          "  var comp = app.project.activeItem;",
          "  if (!(comp instanceof CompItem)) { alert('Please select a composition.'); return; }",
          "  app.beginUndoGroup('Center Anchor Point');",
          "  var layers = comp.selectedLayers;",
          "  for (var i = 0; i < layers.length; i++) {",
          "    var l = layers[i];",
          "    var rect = l.sourceRectAtTime(comp.time, false);",
          "    var cx = rect.left + rect.width / 2;",
          "    var cy = rect.top + rect.height / 2;",
          "    var ap = l.property('ADBE Transform Group').property('ADBE Anchor Point');",
          "    var pos = l.property('ADBE Transform Group').property('ADBE Position');",
          "    var dx = cx - ap.value[0];",
          "    var dy = cy - ap.value[1];",
          "    ap.setValue([cx, cy]);",
          "    pos.setValue([pos.value[0] + dx, pos.value[1] + dy]);",
          "  }",
          "  app.endUndoGroup();",
          "})();"
        ].join("\n"),
        order: 0,
        tags: ["transform", "utility"],
        createdAt: "2026-11-17T00:00:00.000Z"
      },
      {
        id: "starter-expr-smooth-wiggle",
        name: "Smooth Wiggle (Freq/Amp)",
        type: "expression",
        source: "manual",
        icon: "wave",
        color: "#a855f7",
        description: "Organic camera/layer shake using wiggle(freq, amp) with customizable parameters.",
        filePath: "",
        code: [
          "// Smooth Wiggle Expression",
          "var freq = 2.5; // oscillations per second",
          "var amp = 25;   // amplitude in pixels/degrees",
          "wiggle(freq, amp);"
        ].join("\n"),
        defaultTargetPreset: "transform.position",
        defaultApplyMode: "replace",
        defaultKeyframeMode: "keep",
        order: 1,
        tags: ["expression", "motion"],
        createdAt: "2026-11-17T00:00:00.000Z"
      },
      {
        id: "starter-expr-inertial-bounce",
        name: "Inertial Bounce (Keyframes)",
        type: "expression",
        source: "manual",
        icon: "bounce",
        color: "#ec4899",
        description: "Overshoots and settles after the last keyframe on any animated property.",
        filePath: "",
        code: [
          "// Inertial Bounce after Keyframes",
          "var amp = 0.06;",
          "var freq = 2.5;",
          "var decay = 5.0;",
          "var n = 0;",
          "if (numKeys > 0) {",
          "  n = nearestKey(time).index;",
          "  if (key(n).time > time) n--;",
          "}",
          "if (n === 0) {",
          "  value;",
          "} else {",
          "  var t = time - key(n).time;",
          "  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);",
          "  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);",
          "}"
        ].join("\n"),
        defaultTargetPreset: "transform.scale",
        defaultApplyMode: "replace",
        defaultKeyframeMode: "keep",
        order: 2,
        tags: ["expression", "bounce"],
        createdAt: "2026-11-17T00:00:00.000Z"
      },
      {
        id: "starter-expr-loop-cycle",
        name: "Loop Out Cycle",
        type: "expression",
        source: "manual",
        icon: "loop",
        color: "#10b981",
        description: "Infinitely cycles keyframe animation using loopOut('cycle').",
        filePath: "",
        code: 'loopOut("cycle");',
        defaultTargetPreset: "transform.rotation",
        defaultApplyMode: "replace",
        defaultKeyframeMode: "keep",
        order: 3,
        tags: ["expression", "loop"],
        createdAt: "2026-11-17T00:00:00.000Z"
      },
      {
        id: "starter-ffx-sample",
        name: "Vignette & Glow Preset (.ffx)",
        type: "ffx",
        source: "manual",
        icon: "sparkles",
        color: "#f59e0b",
        description: "Sample FFX preset entry. Click to open the FFX Target Selector and apply to layers or a new Adjustment Layer.",
        filePath: "/Presets/Sample_Vignette_Glow.ffx",
        code: "",
        defaultTargetLayerMode: "selected_layers",
        defaultTimeMode: "current_time",
        order: 4,
        tags: ["preset", "ffx"],
        createdAt: "2026-11-17T00:00:00.000Z"
      }
    ];
  }

  function getDefaultState() {
    return {
      version: "0.0.0",
      settings: {
        viewMode: "grid", // "grid" (icon view) | "list" (list view)
        iconSize: "medium", // "small" | "medium" | "large"
        filterType: "all", // "all" | "script" | "expression" | "ffx"
        filterSource: "all", // "all" | "manual" | "github"
        sortBy: "custom", // "custom" | "name_asc" | "name_desc" | "type"
        // GitHub Scripts Repository Settings
        scriptsRepo: {
          owner: "",
          repo: "",
          branch: "main",
          subPath: "",
          token: "",
          autoSyncOnLaunch: false,
          lastSyncAt: null
        },
        // Self Auto-Update Settings
        launcherUpdateRepo: {
          owner: "",
          repo: "AE-tiny-scripts-launcher",
          autoCheckOnLaunch: true,
          lastCheckedAt: null,
          latestAvailableVersion: null
        }
      },
      items: getDefaultStarterItems()
    };
  }

  function LauncherStore(options) {
    this.options = options || {};
    this.state = getDefaultState();
    this.listeners = [];
    this.load();
  }

  LauncherStore.prototype.getStateFilePath = function () {
    if (!hasNode) return null;
    return path.join(getDataDir(this.options.dataDir), "launcher-state.json");
  };

  LauncherStore.prototype.getScriptsSyncDir = function () {
    if (!hasNode) return "/tmp/AETinyScriptsLauncher/github_scripts";
    return path.join(getDataDir(this.options.dataDir), "github_scripts");
  };

  LauncherStore.prototype.load = function () {
    var loaded = null;
    var filePath = this.getStateFilePath();
    if (hasNode && filePath && fs.existsSync(filePath)) {
      try {
        loaded = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) {
        console.warn("Failed to read state file, falling back to localStorage:", e);
      }
    }
    if (!loaded && typeof localStorage !== "undefined") {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (e) {
        console.warn("Failed to read localStorage:", e);
      }
    }
    if (loaded && typeof loaded === "object") {
      var def = getDefaultState();
      this.state = {
        version: "0.0.0",
        settings: Object.assign({}, def.settings, loaded.settings || {}, {
          scriptsRepo: Object.assign({}, def.settings.scriptsRepo, (loaded.settings && loaded.settings.scriptsRepo) || {}),
          launcherUpdateRepo: Object.assign(
            {},
            def.settings.launcherUpdateRepo,
            (loaded.settings && loaded.settings.launcherUpdateRepo) || {}
          )
        }),
        items: Array.isArray(loaded.items) ? loaded.items : def.items
      };
      this.normalizeOrder();
    }
  };

  LauncherStore.prototype.save = function () {
    var serialized = JSON.stringify(this.state, null, 2);
    var filePath = this.getStateFilePath();
    if (hasNode && filePath) {
      try {
        fs.writeFileSync(filePath, serialized, "utf8");
      } catch (e) {
        console.warn("Failed to save state file:", e);
      }
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch (e) {
        console.warn("Failed to save to localStorage:", e);
      }
    }
    this.notify();
  };

  LauncherStore.prototype.subscribe = function (fn) {
    this.listeners.push(fn);
  };

  LauncherStore.prototype.notify = function () {
    var st = this.state;
    this.listeners.forEach(function (fn) {
      fn(st);
    });
  };

  LauncherStore.prototype.reindexOrder = function () {
    this.state.items.forEach(function (item, idx) {
      item.order = idx;
    });
  };

  LauncherStore.prototype.normalizeOrder = function () {
    this.state.items.sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    this.reindexOrder();
  };

  LauncherStore.prototype.updateSettings = function (partial) {
    this.state.settings = Object.assign({}, this.state.settings, partial);
    if (partial.scriptsRepo) {
      this.state.settings.scriptsRepo = Object.assign({}, this.state.settings.scriptsRepo, partial.scriptsRepo);
    }
    if (partial.launcherUpdateRepo) {
      this.state.settings.launcherUpdateRepo = Object.assign(
        {},
        this.state.settings.launcherUpdateRepo,
        partial.launcherUpdateRepo
      );
    }
    this.save();
  };

  LauncherStore.prototype.addItem = function (itemData) {
    var id = itemData.id || "item-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    var newItem = {
      id: id,
      name: (itemData.name || "Untitled Item").trim(),
      type: itemData.type || "script", // "script" | "expression" | "ffx"
      source: itemData.source || "manual", // "manual" | "github"
      icon: itemData.icon || (itemData.type === "expression" ? "wave" : itemData.type === "ffx" ? "sparkles" : "bolt"),
      color: itemData.color || (itemData.type === "expression" ? "#a855f7" : itemData.type === "ffx" ? "#f59e0b" : "#4f8cff"),
      description: itemData.description || "",
      filePath: itemData.filePath || "",
      code: itemData.code || "",
      defaultTargetPreset: itemData.defaultTargetPreset || "transform.position",
      defaultApplyMode: itemData.defaultApplyMode || "replace",
      defaultKeyframeMode: itemData.defaultKeyframeMode || "keep",
      defaultTargetLayerMode: itemData.defaultTargetLayerMode || "selected_layers",
      defaultTimeMode: itemData.defaultTimeMode || "current_time",
      remotePath: itemData.remotePath || null,
      sha: itemData.sha || null,
      order: this.state.items.length,
      tags: Array.isArray(itemData.tags) ? itemData.tags : [],
      createdAt: new Date().toISOString()
    };
    this.state.items.push(newItem);
    this.normalizeOrder();
    this.save();
    return newItem;
  };

  LauncherStore.prototype.updateItem = function (id, updates) {
    var idx = this.state.items.findIndex(function (it) {
      return it.id === id;
    });
    if (idx === -1) return null;
    this.state.items[idx] = Object.assign({}, this.state.items[idx], updates, { id: id });
    this.save();
    return this.state.items[idx];
  };

  LauncherStore.prototype.deleteItem = function (id) {
    var before = this.state.items.length;
    this.state.items = this.state.items.filter(function (it) {
      return it.id !== id;
    });
    if (this.state.items.length !== before) {
      this.reindexOrder();
      this.save();
      return true;
    }
    return false;
  };

  /**
   * Reorder items by moving draggedId before/after targetId or by explicit index
   */
  LauncherStore.prototype.moveItem = function (draggedId, targetId, position) {
    if (draggedId === targetId) return;
    this.normalizeOrder();
    var fromIdx = this.state.items.findIndex(function (it) {
      return it.id === draggedId;
    });
    if (fromIdx === -1) return;
    var moved = this.state.items.splice(fromIdx, 1)[0];
    var toIdx = this.state.items.findIndex(function (it) {
      return it.id === targetId;
    });
    if (toIdx === -1) {
      this.state.items.push(moved);
    } else {
      var insertAt = position === "after" ? toIdx + 1 : toIdx;
      this.state.items.splice(insertAt, 0, moved);
    }
    this.reindexOrder();
    this.state.settings.sortBy = "custom";
    this.save();
  };

  /**
   * Shift an item up (-1) or down (+1) in custom order
   */
  LauncherStore.prototype.shiftItemOrder = function (id, delta) {
    this.normalizeOrder();
    var idx = this.state.items.findIndex(function (it) {
      return it.id === id;
    });
    if (idx === -1) return;
    var nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= this.state.items.length) return;
    var temp = this.state.items[idx];
    this.state.items[idx] = this.state.items[nextIdx];
    this.state.items[nextIdx] = temp;
    this.reindexOrder();
    this.state.settings.sortBy = "custom";
    this.save();
  };

  /**
   * Merge synchronized GitHub items while preserving custom order and existing manual items
   */
  LauncherStore.prototype.mergeGitHubItems = function (syncedItems, removeMissingRemote) {
    var existingByRemotePath = {};
    this.state.items.forEach(function (it) {
      if (it.source === "github" && it.remotePath) {
        existingByRemotePath[it.remotePath] = it;
      }
    });

    var seenPaths = {};
    var added = 0;
    var updated = 0;

    for (var i = 0; i < syncedItems.length; i++) {
      var remote = syncedItems[i];
      seenPaths[remote.remotePath] = true;
      var existing = existingByRemotePath[remote.remotePath];
      if (existing) {
        existing.name = remote.name || existing.name;
        existing.type = remote.type || existing.type;
        existing.description = remote.description !== undefined ? remote.description : existing.description;
        existing.filePath = remote.filePath || existing.filePath;
        existing.code = remote.code !== undefined ? remote.code : existing.code;
        existing.sha = remote.sha || existing.sha;
        existing.icon = remote.icon || existing.icon;
        existing.color = remote.color || existing.color;
        updated++;
      } else {
        this.state.items.push({
          id: "gh-" + Date.now() + "-" + i,
          name: remote.name,
          type: remote.type || "script",
          source: "github",
          icon: remote.icon || (remote.type === "expression" ? "wave" : remote.type === "ffx" ? "sparkles" : "github"),
          color: remote.color || (remote.type === "expression" ? "#a855f7" : remote.type === "ffx" ? "#f59e0b" : "#38bdf8"),
          description: remote.description || "Synced from GitHub (" + remote.remotePath + ")",
          filePath: remote.filePath || "",
          code: remote.code || "",
          defaultTargetPreset: remote.defaultTargetPreset || "transform.position",
          defaultApplyMode: "replace",
          defaultKeyframeMode: "keep",
          defaultTargetLayerMode: "selected_layers",
          defaultTimeMode: "current_time",
          remotePath: remote.remotePath,
          sha: remote.sha || null,
          order: this.state.items.length,
          tags: remote.tags || ["github"],
          createdAt: new Date().toISOString()
        });
        added++;
      }
    }

    var removed = 0;
    if (removeMissingRemote) {
      var beforeCount = this.state.items.length;
      this.state.items = this.state.items.filter(function (it) {
        if (it.source !== "github") return true;
        return !!seenPaths[it.remotePath];
      });
      removed = beforeCount - this.state.items.length;
    }

    this.state.settings.scriptsRepo.lastSyncAt = new Date().toISOString();
    this.normalizeOrder();
    this.save();

    return { added: added, updated: updated, removed: removed, total: syncedItems.length };
  };

  var TARGET_REQUEST_KEY = "ae_tiny_scripts_launcher_pending_target_v1";

  LauncherStore.prototype.getPendingTargetFilePath = function () {
    if (!hasNode) return null;
    return path.join(getDataDir(this.options.dataDir), "pending-target-request.json");
  };

  LauncherStore.prototype.savePendingTargetRequest = function (item) {
    var payload = {
      requestId: "req-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      openedAt: new Date().toISOString(),
      item: item
    };
    var serialized = JSON.stringify(payload);
    var filePath = this.getPendingTargetFilePath();
    if (hasNode && filePath) {
      try {
        fs.writeFileSync(filePath, serialized, "utf8");
      } catch (e) {
        console.warn("Failed to write pending target request:", e);
      }
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(TARGET_REQUEST_KEY, serialized);
      } catch (e) {
        // ignore
      }
    }
    return payload;
  };

  LauncherStore.prototype.loadPendingTargetRequest = function () {
    var filePath = this.getPendingTargetFilePath();
    if (hasNode && filePath && fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) {
        console.warn("Failed to read pending target request:", e);
      }
    }
    if (typeof localStorage !== "undefined") {
      try {
        var raw = localStorage.getItem(TARGET_REQUEST_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }
    return null;
  };

  global.LauncherStore = LauncherStore;
})(typeof window !== "undefined" ? window : global);
