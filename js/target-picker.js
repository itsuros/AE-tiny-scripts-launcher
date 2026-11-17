/**
 * AE Tiny Scripts Launcher - Shared Target Picker Controller (js/target-picker.js)
 * Drives the Expression & FFX Target Picker UI in BOTH:
 * 1) Standalone external CEP Modeless window (target-picker.html)
 * 2) Inline modal fallback in index.html when browser popups are blocked outside CEP
 */

(function (global) {
  var RESULT_STORAGE_KEY = "ae_tiny_scripts_launcher_target_result_v1";

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyHostTheme(csInterface) {
    try {
      var env = csInterface.getHostEnvironment();
      var bg = env && env.appSkinInfo && env.appSkinInfo.panelBackgroundColor && env.appSkinInfo.panelBackgroundColor.color;
      if (bg) {
        var lum = 0.2126 * bg.red + 0.7152 * bg.green + 0.0722 * bg.blue;
        if (lum > 140) {
          document.body.classList.remove("theme-dark");
          document.body.classList.add("theme-light");
        } else {
          document.body.classList.remove("theme-light");
          document.body.classList.add("theme-dark");
        }
        document.documentElement.style.setProperty(
          "--bg-app",
          "rgb(" + Math.round(bg.red) + "," + Math.round(bg.green) + "," + Math.round(bg.blue) + ")"
        );
      }
    } catch (e) {
      // ignore
    }
  }

  function TargetPickerController(options) {
    options = options || {};
    this.csInterface = options.csInterface || new CSInterface();
    this.standalone = !!options.standalone;
    this.onStatus = typeof options.onStatus === "function" ? options.onStatus : function () {};
    this.onClose = typeof options.onClose === "function" ? options.onClose : function () {};

    this.activeItem = null;
    this.aeContext = null;
    this.layerPropertiesCache = [];
    this.bound = false;
  }

  TargetPickerController.prototype.evalHostFunction = function (fnCall) {
    var cs = this.csInterface;
    return new Promise(function (resolve) {
      cs.evalScript(fnCall, function (raw) {
        if (!raw || raw === "EvalScript error.") {
          resolve({ ok: false, error: raw || "ExtendScript returned empty response." });
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve({ ok: false, error: "Invalid JSON from ExtendScript: " + raw });
        }
      });
    });
  };

  TargetPickerController.prototype.fetchAEContext = function () {
    var self = this;
    return this.evalHostFunction("AETinyLauncherHost.getContextSnapshot()").then(function (res) {
      if (res.mock) {
        res = {
          ok: true,
          mock: true,
          activeComp: { id: 1, name: "Main_Comp (Preview Mock)", numLayers: 3 },
          comps: [{ id: 1, name: "Main_Comp (Preview Mock)", numLayers: 3 }],
          layers: [
            { index: 1, name: "Camera Null", selected: true, locked: false, enabled: true },
            { index: 2, name: "Title Text", selected: false, locked: false, enabled: true },
            { index: 3, name: "Background Solid", selected: false, locked: false, enabled: true }
          ],
          selectedProps: [
            {
              layerIndex: 1,
              layerName: "Camera Null",
              propName: "Position",
              matchName: "ADBE Position",
              canSetExpression: true,
              expressionEnabled: false,
              currentExpression: "",
              numKeys: 0,
              pathNames: "Transform > Position",
              indices: [2, 2]
            }
          ]
        };
      }
      self.aeContext = res;
      return res;
    });
  };

  TargetPickerController.prototype.setPickerStatus = function (msg, kind) {
    if (this.standalone && $("picker-status-text")) {
      var el = $("picker-status-text");
      el.textContent = msg;
      el.className = "hint" + (kind ? " status-" + kind : "");
    }
    this.onStatus(msg, kind);
  };

  TargetPickerController.prototype.notifyMainPanelResult = function (ok, message) {
    var payload = {
      ok: ok,
      message: message,
      at: new Date().toISOString()
    };
    if (this.csInterface.isCEPEnvironment()) {
      var evt = new CSEvent(
        "com.ae.tinyscripts.launcher.TARGET_RESULT",
        "APPLICATION",
        "AEFT",
        "com.ae.tinyscripts.launcher.panel"
      );
      evt.data = JSON.stringify(payload);
      this.csInterface.dispatchEvent(evt);
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        // ignore
      }
    }
  };

  TargetPickerController.prototype.closePicker = function (type) {
    if (this.standalone) {
      this.csInterface.closeExtension();
    } else {
      if (type === "expression" && $("modal-expression")) {
        $("modal-expression").classList.add("hidden");
      } else if (type === "ffx" && $("modal-ffx")) {
        $("modal-ffx").classList.add("hidden");
      }
      this.onClose();
    }
  };

  TargetPickerController.prototype.openItem = function (item) {
    this.activeItem = item;
    this.bindEvents();

    if (!item || (item.type !== "expression" && item.type !== "ffx")) {
      if (this.standalone) {
        $("picker-expr-view").classList.add("hidden");
        $("picker-ffx-view").classList.add("hidden");
        $("picker-empty-view").classList.remove("hidden");
        $("btn-picker-apply").disabled = true;
      }
      return;
    }

    if (this.standalone) {
      $("picker-empty-view").classList.add("hidden");
      $("btn-picker-apply").disabled = false;
      var badge = $("picker-type-badge");
      if (item.type === "expression") {
        badge.textContent = "EXPR";
        badge.className = "badge badge-expression";
        $("picker-window-title").textContent = "Apply Expression: " + item.name;
        $("btn-picker-apply").textContent = "Apply Expression";
        $("picker-expr-view").classList.remove("hidden");
        $("picker-ffx-view").classList.add("hidden");
      } else {
        badge.textContent = "FFX";
        badge.className = "badge badge-ffx";
        $("picker-window-title").textContent = "Apply FFX Preset: " + item.name;
        $("btn-picker-apply").textContent = "Apply FFX Preset";
        $("picker-ffx-view").classList.remove("hidden");
        $("picker-expr-view").classList.add("hidden");
      }
    }

    if (item.type === "expression") {
      this.populateExpressionUI(item);
    } else {
      this.populateFfxUI(item);
    }
  };

  // ==================== Expression UI ====================
  TargetPickerController.prototype.populateExpressionUI = function (item) {
    if (!this.standalone) {
      if ($("expr-modal-title")) $("expr-modal-title").textContent = "Apply Expression: " + item.name;
      if ($("modal-expression")) $("modal-expression").classList.remove("hidden");
    }

    $("expr-code-preview").value = item.code || "";
    $("expr-common-preset").value = item.defaultTargetPreset || "transform.position";
    $("expr-apply-mode").value = item.defaultApplyMode || "replace";
    $("expr-keyframe-mode").value = item.defaultKeyframeMode || "keep";
    $("expr-enable-flag").checked = true;

    if (!item.code && item.filePath && typeof require === "function") {
      try {
        var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
        var fs = req("fs");
        if (fs.existsSync(item.filePath)) {
          $("expr-code-preview").value = fs.readFileSync(item.filePath, "utf8");
        }
      } catch (e) {
        // ignore
      }
    }

    this.refreshExpressionContext();
  };

  TargetPickerController.prototype.refreshExpressionContext = function () {
    var self = this;
    $("expr-comp-name").textContent = "Loading AE context...";
    this.fetchAEContext().then(function (ctx) {
      if (!ctx.ok) {
        $("expr-comp-name").textContent = "Error: " + ctx.error;
        return;
      }
      if (!ctx.activeComp) {
        $("expr-comp-name").textContent = "No active composition open";
      } else {
        $("expr-comp-name").textContent = ctx.activeComp.name + " (" + ctx.layers.length + " layers)";
      }

      var selPropsEl = $("expr-selected-props-list");
      if (!ctx.selectedProps || ctx.selectedProps.length === 0) {
        selPropsEl.innerHTML =
          '<div class="checklist-empty">No timeline properties selected in After Effects. Select a property or switch to "Common Property" / "Layer Property Tree".</div>';
      } else {
        selPropsEl.innerHTML = ctx.selectedProps
          .map(function (p) {
            var statusTag = p.canSetExpression ? "" : " (cannot set expression)";
            var keyTag = p.numKeys > 0 ? " [" + p.numKeys + " keys]" : "";
            return (
              '<div class="checklist-item">' +
              "<span><strong>#" +
              p.layerIndex +
              " " +
              escapeHtml(p.layerName) +
              "</strong> &rarr; " +
              escapeHtml(p.pathNames) +
              keyTag +
              statusTag +
              "</span></div>"
            );
          })
          .join("");
      }

      var commonLayersEl = $("expr-common-layers-list");
      if (!ctx.layers || ctx.layers.length === 0) {
        commonLayersEl.innerHTML = '<div class="checklist-empty">No layers in active composition.</div>';
      } else {
        commonLayersEl.innerHTML = ctx.layers
          .map(function (l) {
            return (
              '<label class="checklist-item">' +
              '<input type="checkbox" class="expr-common-layer-cb" value="' +
              l.index +
              '" ' +
              (l.selected ? "checked" : "") +
              " />" +
              "<span>#" +
              l.index +
              " " +
              escapeHtml(l.name) +
              (l.selected ? " <em>(AE Selected)</em>" : "") +
              "</span></label>"
            );
          })
          .join("");
      }

      var treeLayerSel = $("expr-tree-layer");
      treeLayerSel.innerHTML = "";
      if (ctx.layers && ctx.layers.length > 0) {
        ctx.layers.forEach(function (l) {
          var opt = document.createElement("option");
          opt.value = l.index;
          opt.textContent = "#" + l.index + " " + l.name + (l.selected ? " *" : "");
          if (l.selected) opt.selected = true;
          treeLayerSel.appendChild(opt);
        });
        self.loadLayerPropertyTree();
      } else {
        $("expr-tree-props-list").innerHTML = '<div class="checklist-empty">No layers available.</div>';
      }
    });
  };

  TargetPickerController.prototype.loadLayerPropertyTree = function () {
    var self = this;
    var ctx = this.aeContext;
    var layerIndex = Number($("expr-tree-layer").value);
    if (!ctx || !ctx.activeComp || !layerIndex) return;

    $("expr-tree-props-list").innerHTML = '<div class="checklist-empty">Scanning layer properties...</div>';

    if (ctx.mock) {
      this.layerPropertiesCache = [
        { name: "Anchor Point", pathNames: "Transform > Anchor Point", indices: [2, 1], hasExpression: false, numKeys: 0 },
        { name: "Position", pathNames: "Transform > Position", indices: [2, 2], hasExpression: false, numKeys: 0 },
        { name: "Scale", pathNames: "Transform > Scale", indices: [2, 6], hasExpression: false, numKeys: 0 },
        { name: "Rotation", pathNames: "Transform > Rotation", indices: [2, 10], hasExpression: false, numKeys: 0 },
        { name: "Opacity", pathNames: "Transform > Opacity", indices: [2, 11], hasExpression: false, numKeys: 0 }
      ];
      this.renderLayerPropertyTreeList();
      return;
    }

    this.evalHostFunction(
      "AETinyLauncherHost.getLayerProperties(" + Number(ctx.activeComp.id) + ", " + layerIndex + ")"
    ).then(function (res) {
      if (!res.ok) {
        $("expr-tree-props-list").innerHTML = '<div class="checklist-empty">' + escapeHtml(res.error) + "</div>";
        return;
      }
      self.layerPropertiesCache = res.properties || [];
      self.renderLayerPropertyTreeList();
    });
  };

  TargetPickerController.prototype.renderLayerPropertyTreeList = function () {
    var search = $("expr-tree-search").value.trim().toLowerCase();
    var layerIndex = Number($("expr-tree-layer").value);
    var props = this.layerPropertiesCache.filter(function (p) {
      return !search || p.pathNames.toLowerCase().indexOf(search) >= 0;
    });

    var container = $("expr-tree-props-list");
    if (props.length === 0) {
      container.innerHTML = '<div class="checklist-empty">No matching expression-capable properties found.</div>';
      return;
    }

    container.innerHTML = props
      .map(function (p) {
        var meta = (p.hasExpression ? " [expr]" : "") + (p.numKeys > 0 ? " [" + p.numKeys + " keys]" : "");
        return (
          '<label class="checklist-item">' +
          '<input type="checkbox" class="expr-tree-prop-cb" data-layer="' +
          layerIndex +
          '" data-indices="' +
          escapeHtml(JSON.stringify(p.indices)) +
          '" />' +
          "<span>" +
          escapeHtml(p.pathNames) +
          '<span class="hint">' +
          escapeHtml(meta) +
          "</span></span></label>"
        );
      })
      .join("");
  };

  TargetPickerController.prototype.switchExprTargetPanel = function () {
    var mode = document.querySelector('input[name="exprTargetMode"]:checked').value;
    $("expr-panel-selected").classList.toggle("hidden", mode !== "selected_props");
    $("expr-panel-common").classList.toggle("hidden", mode !== "common_preset");
    $("expr-panel-tree").classList.toggle("hidden", mode !== "specific_paths");
  };

  TargetPickerController.prototype.executeApplyExpression = function () {
    var self = this;
    var mode = document.querySelector('input[name="exprTargetMode"]:checked').value;
    var code = $("expr-code-preview").value;
    if (!code.trim()) {
      this.setPickerStatus("Expression code is empty.", "error");
      return;
    }

    var layerIndices = [];
    document.querySelectorAll(".expr-common-layer-cb:checked").forEach(function (cb) {
      layerIndices.push(Number(cb.value));
    });

    var specificTargets = [];
    document.querySelectorAll(".expr-tree-prop-cb:checked").forEach(function (cb) {
      specificTargets.push({
        layerIndex: Number(cb.getAttribute("data-layer")),
        indices: JSON.parse(cb.getAttribute("data-indices"))
      });
    });

    var payload = {
      compId: this.aeContext && this.aeContext.activeComp ? this.aeContext.activeComp.id : null,
      targetMode: mode,
      commonPresetId: $("expr-common-preset").value,
      layerIndices: layerIndices,
      specificTargets: specificTargets,
      expressionCode: code,
      applyMode: $("expr-apply-mode").value,
      keyframeMode: $("expr-keyframe-mode").value,
      enableExpression: $("expr-enable-flag").checked
    };

    this.setPickerStatus("Applying expression...");
    this.evalHostFunction(
      "AETinyLauncherHost.applyExpressionWithOptions(" + JSON.stringify(JSON.stringify(payload)) + ")"
    ).then(function (res) {
      if (res.ok) {
        var msg = res.message || "Expression applied.";
        self.setPickerStatus(msg, "success");
        self.notifyMainPanelResult(true, msg);
        if (!self.standalone || !($("picker-keep-open") && $("picker-keep-open").checked)) {
          self.closePicker("expression");
        }
      } else {
        self.setPickerStatus("Expression Error: " + res.error, "error");
        self.notifyMainPanelResult(false, "Expression Error: " + res.error);
        window.alert("Expression Apply Error:\n" + res.error);
      }
    });
  };

  // ==================== FFX UI ====================
  TargetPickerController.prototype.populateFfxUI = function (item) {
    if (!this.standalone) {
      if ($("ffx-modal-title")) $("ffx-modal-title").textContent = "Apply FFX: " + item.name;
      if ($("modal-ffx")) $("modal-ffx").classList.remove("hidden");
    }

    $("ffx-file-display").textContent = item.filePath || "(No file path set - edit item to select a .ffx file)";
    $("ffx-time-mode").value = item.defaultTimeMode || "current_time";
    $("ffx-keyframe-mode").value = "keep";
    $("ffx-clear-effects").checked = false;

    var defaultMode = item.defaultTargetLayerMode || "selected_layers";
    var radio = document.querySelector('input[name="ffxTargetMode"][value="' + defaultMode + '"]');
    if (radio) radio.checked = true;

    this.refreshFfxContext();
  };

  TargetPickerController.prototype.refreshFfxContext = function () {
    var self = this;
    this.fetchAEContext().then(function (ctx) {
      var compSel = $("ffx-comp-select");
      compSel.innerHTML = "";
      if (!ctx.ok || !ctx.comps || ctx.comps.length === 0) {
        var optEmpty = document.createElement("option");
        optEmpty.value = "";
        optEmpty.textContent = "No compositions open in AE";
        compSel.appendChild(optEmpty);
      } else {
        ctx.comps.forEach(function (c) {
          var opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name + " (" + c.numLayers + " layers)";
          if (ctx.activeComp && c.id === ctx.activeComp.id) opt.selected = true;
          compSel.appendChild(opt);
        });
      }

      var layersBox = $("ffx-layers-list");
      if (!ctx.layers || ctx.layers.length === 0) {
        layersBox.innerHTML = '<div class="checklist-empty">No layers in active composition.</div>';
      } else {
        layersBox.innerHTML = ctx.layers
          .map(function (l) {
            return (
              '<label class="checklist-item">' +
              '<input type="checkbox" class="ffx-layer-cb" value="' +
              l.index +
              '" ' +
              (l.selected ? "checked" : "") +
              " />" +
              "<span>#" +
              l.index +
              " " +
              escapeHtml(l.name) +
              (l.selected ? " <em>(AE Selected)</em>" : "") +
              "</span></label>"
            );
          })
          .join("");
      }
      self.updateFfxLayerListVisibility();
    });
  };

  TargetPickerController.prototype.updateFfxLayerListVisibility = function () {
    var mode = document.querySelector('input[name="ffxTargetMode"]:checked').value;
    var needsList = mode === "selected_layers" || mode === "checked_layers";
    $("ffx-layer-checklist-wrap").classList.toggle("hidden", !needsList);
    if (mode === "selected_layers") {
      $("ffx-layer-subtitle").textContent = "Preview of AE selected layers (applied to AE timeline selection):";
    } else if (mode === "checked_layers") {
      $("ffx-layer-subtitle").textContent = "Check the specific layers to apply this FFX preset to:";
    }
  };

  TargetPickerController.prototype.executeApplyFfx = function () {
    var self = this;
    var item = this.activeItem;
    if (!item || !item.filePath) {
      this.setPickerStatus("Missing .ffx file path.", "error");
      window.alert("Please edit this FFX item and specify a valid .ffx file path.");
      return;
    }

    var mode = document.querySelector('input[name="ffxTargetMode"]:checked').value;
    var layerIndices = [];
    document.querySelectorAll(".ffx-layer-cb:checked").forEach(function (cb) {
      layerIndices.push(Number(cb.value));
    });

    var payload = {
      compId: $("ffx-comp-select").value ? Number($("ffx-comp-select").value) : null,
      ffxPath: item.filePath,
      targetLayerMode: mode,
      layerIndices: layerIndices,
      timeMode: $("ffx-time-mode").value,
      clearExistingEffects: $("ffx-clear-effects").checked,
      keyframeMode: $("ffx-keyframe-mode").value
    };

    this.setPickerStatus("Applying FFX preset: " + item.name + "...");
    this.evalHostFunction(
      "AETinyLauncherHost.applyFFXWithOptions(" + JSON.stringify(JSON.stringify(payload)) + ")"
    ).then(function (res) {
      if (res.ok) {
        var msg = res.message || "FFX applied.";
        self.setPickerStatus(msg, "success");
        self.notifyMainPanelResult(true, msg);
        if (!self.standalone || !($("picker-keep-open") && $("picker-keep-open").checked)) {
          self.closePicker("ffx");
        }
      } else {
        self.setPickerStatus("FFX Error: " + res.error, "error");
        self.notifyMainPanelResult(false, "FFX Error: " + res.error);
        window.alert("FFX Apply Error:\n" + res.error);
      }
    });
  };

  TargetPickerController.prototype.bindEvents = function () {
    if (this.bound) return;
    this.bound = true;
    var self = this;

    if ($("btn-expr-refresh")) {
      $("btn-expr-refresh").addEventListener("click", function () {
        self.refreshExpressionContext();
      });
    }
    document.querySelectorAll('input[name="exprTargetMode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        self.switchExprTargetPanel();
      });
    });
    if ($("expr-tree-layer")) {
      $("expr-tree-layer").addEventListener("change", function () {
        self.loadLayerPropertyTree();
      });
    }
    if ($("expr-tree-search")) {
      $("expr-tree-search").addEventListener("input", function () {
        self.renderLayerPropertyTreeList();
      });
    }
    if ($("btn-expr-apply")) {
      $("btn-expr-apply").addEventListener("click", function () {
        self.executeApplyExpression();
      });
    }

    if ($("btn-ffx-refresh")) {
      $("btn-ffx-refresh").addEventListener("click", function () {
        self.refreshFfxContext();
      });
    }
    document.querySelectorAll('input[name="ffxTargetMode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        self.updateFfxLayerListVisibility();
      });
    });
    if ($("btn-ffx-apply")) {
      $("btn-ffx-apply").addEventListener("click", function () {
        self.executeApplyFfx();
      });
    }

    if (this.standalone) {
      $("btn-picker-close-top").addEventListener("click", function () {
        self.closePicker();
      });
      $("btn-picker-cancel").addEventListener("click", function () {
        self.closePicker();
      });
      $("btn-picker-apply").addEventListener("click", function () {
        if (!self.activeItem) return;
        if (self.activeItem.type === "expression") {
          self.executeApplyExpression();
        } else if (self.activeItem.type === "ffx") {
          self.executeApplyFfx();
        }
      });
    }
  };

  function initStandalone() {
    var cs = new CSInterface();
    var store = new LauncherStore();
    var controller = new TargetPickerController({
      csInterface: cs,
      standalone: true
    });

    applyHostTheme(cs);
    cs.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, function () {
      applyHostTheme(cs);
    });

    // Listen for live TARGET_REQUEST events if main panel dispatches another item while window is open
    cs.addEventListener("com.ae.tinyscripts.launcher.TARGET_REQUEST", function (event) {
      try {
        var data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && data.item) {
          controller.openItem(data.item);
          if (typeof window.focus === "function") window.focus();
        }
      } catch (e) {
        // ignore
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("storage", function (e) {
        if (e.key === "ae_tiny_scripts_launcher_pending_target_v1" && e.newValue) {
          try {
            var parsed = JSON.parse(e.newValue);
            if (parsed && parsed.item) controller.openItem(parsed.item);
          } catch (err) {
            // ignore
          }
        }
      });
    }

    var pending = store.loadPendingTargetRequest();
    if (pending && pending.item) {
      controller.openItem(pending.item);
    } else {
      controller.openItem(null);
    }
  }

  global.TargetPicker = {
    Controller: TargetPickerController,
    initStandalone: initStandalone
  };
})(typeof window !== "undefined" ? window : global);
