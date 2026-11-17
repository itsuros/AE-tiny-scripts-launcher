/**
 * AE Tiny Scripts Launcher - Main UI Controller (js/app.js)
 * Connects CEP CSInterface, LauncherStore, GitHubSync, and LauncherUpdater to the DOM.
 */

(function () {
  var csInterface = new CSInterface();
  var store = new LauncherStore();

  var uiState = {
    searchQuery: "",
    reorderMode: false,
    draggedId: null,
    activeExpressionItem: null,
    activeFfxItem: null,
    aeContext: null,
    layerPropertiesCache: [],
    pendingUpdateInfo: null
  };

  // ==================== SVG Icon Registry ====================
  var ICONS = {
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    anchor: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>',
    wave: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"></path></svg>',
    bounce: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c3-10 6-10 9 0 2-6 4-6 6 0 1-3 2-3 3 0"></path></svg>',
    loop: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>',
    sparkles: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 10.5l-6.1 1.7L12 18l-1.9-5.8L4 10.5l6.1-1.7L12 3z"></path></svg>',
    layers: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
    code: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
    github: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>'
  };

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

  function setStatus(message, kind) {
    var el = $("status-text");
    el.textContent = message;
    el.className = "status-text" + (kind ? " " + kind : "");
  }

  // ==================== CEP Theme Synchronization ====================
  function applyHostTheme() {
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
      // ignore if unavailable
    }
  }

  // ==================== ExtendScript Bridge Helpers ====================
  function evalHostFunction(fnCall) {
    return new Promise(function (resolve) {
      csInterface.evalScript(fnCall, function (raw) {
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
  }

  function fetchAEContext() {
    return evalHostFunction("AETinyLauncherHost.getContextSnapshot()").then(function (res) {
      if (res.mock) {
        // Provide realistic mock context when previewed outside After Effects
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
      uiState.aeContext = res;
      return res;
    });
  }

  // ==================== Rendering & Filtering ====================
  function getFilteredAndSortedItems() {
    var settings = store.state.settings;
    var query = uiState.searchQuery.trim().toLowerCase();

    var list = store.state.items.filter(function (item) {
      if (settings.filterType !== "all" && item.type !== settings.filterType) {
        return false;
      }
      if (query) {
        var hay = [item.name, item.description, item.type, (item.tags || []).join(" ")].join(" ").toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
      return true;
    });

    if (settings.sortBy === "name_asc") {
      list.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    } else if (settings.sortBy === "name_desc") {
      list.sort(function (a, b) {
        return b.name.localeCompare(a.name);
      });
    } else if (settings.sortBy === "type") {
      list.sort(function (a, b) {
        return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      });
    } else {
      list.sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
    }

    return list;
  }

  function renderItems() {
    var settings = store.state.settings;
    var container = $("items-container");
    var emptyState = $("empty-state");
    var items = getFilteredAndSortedItems();

    // Sync toolbar UI controls
    $("btn-view-grid").classList.toggle("active", settings.viewMode === "grid");
    $("btn-view-list").classList.toggle("active", settings.viewMode === "list");
    $("sort-select").value = settings.sortBy;
    $("btn-reorder-mode").classList.toggle("active", uiState.reorderMode);

    document.querySelectorAll("#type-filters .pill").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-type") === settings.filterType);
    });

    container.className =
      "items-container " +
      (settings.viewMode === "list" ? "view-list" : "view-grid") +
      " size-" +
      (settings.iconSize || "medium") +
      (uiState.reorderMode ? " reorder-active" : "");

    $("item-count").textContent = items.length + " / " + store.state.items.length + " items";

    if (items.length === 0) {
      container.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    var allowCustomDrag = settings.sortBy === "custom";

    var html = items
      .map(function (item) {
        var iconSvg = ICONS[item.icon] || ICONS.bolt;
        var typeLabel = item.type === "expression" ? "EXPR" : item.type === "ffx" ? "FFX" : "JSX";
        var sourceBadge = item.source === "github" ? '<span class="badge badge-github">GH</span>' : "";
        var reorderBtns =
          '<button class="mini-btn" data-action="move-up" title="Move Up/Left">&#9650;</button>' +
          '<button class="mini-btn" data-action="move-down" title="Move Down/Right">&#9660;</button>';
        var commonActions =
          reorderBtns +
          '<button class="mini-btn" data-action="edit" title="Edit">&#9998;</button>' +
          '<button class="mini-btn danger" data-action="delete" title="Delete">&times;</button>';

        if (settings.viewMode === "list") {
          return (
            '<div class="list-row" draggable="' +
            allowCustomDrag +
            '" data-id="' +
            escapeHtml(item.id) +
            '" title="' +
            escapeHtml(item.description || item.name) +
            '">' +
            '<div class="list-icon-wrap" style="background:' +
            escapeHtml(item.color || "#4f8cff") +
            '">' +
            iconSvg +
            "</div>" +
            '<div class="list-main">' +
            '<div class="list-title-row">' +
            '<span class="list-name">' +
            escapeHtml(item.name) +
            "</span>" +
            '<span class="badge badge-' +
            escapeHtml(item.type) +
            '">' +
            typeLabel +
            "</span>" +
            sourceBadge +
            "</div>" +
            '<div class="list-desc">' +
            escapeHtml(item.description || item.filePath || "Inline " + item.type) +
            "</div>" +
            "</div>" +
            '<div class="list-actions">' +
            commonActions +
            "</div>" +
            "</div>"
          );
        }

        return (
          '<div class="grid-card" draggable="' +
          allowCustomDrag +
          '" data-id="' +
          escapeHtml(item.id) +
          '" title="' +
          escapeHtml(item.description || item.name) +
          '">' +
          '<div class="card-hover-actions">' +
          commonActions +
          "</div>" +
          '<div class="grid-icon-wrap" style="background:' +
          escapeHtml(item.color || "#4f8cff") +
          '">' +
          iconSvg +
          "</div>" +
          '<div class="grid-name">' +
          escapeHtml(item.name) +
          "</div>" +
          '<div class="grid-badges">' +
          '<span class="badge badge-' +
          escapeHtml(item.type) +
          '">' +
          typeLabel +
          "</span>" +
          sourceBadge +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML = html;
    attachItemCardListeners();
  }

  function attachItemCardListeners() {
    var container = $("items-container");
    var cards = container.querySelectorAll("[data-id]");

    cards.forEach(function (card) {
      var id = card.getAttribute("data-id");

      card.addEventListener("click", function (e) {
        var actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
          e.stopPropagation();
          var action = actionBtn.getAttribute("data-action");
          handleCardAction(id, action);
          return;
        }
        var item = store.state.items.find(function (it) {
          return it.id === id;
        });
        if (item) launchItem(item);
      });

      // Drag and drop reordering
      card.addEventListener("dragstart", function (e) {
        if (store.state.settings.sortBy !== "custom") {
          e.preventDefault();
          return;
        }
        uiState.draggedId = id;
        card.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
        }
      });

      card.addEventListener("dragend", function () {
        uiState.draggedId = null;
        card.classList.remove("dragging");
        container.querySelectorAll(".drag-over").forEach(function (el) {
          el.classList.remove("drag-over");
        });
      });

      card.addEventListener("dragover", function (e) {
        if (!uiState.draggedId || uiState.draggedId === id) return;
        e.preventDefault();
        card.classList.add("drag-over");
      });

      card.addEventListener("dragleave", function () {
        card.classList.remove("drag-over");
      });

      card.addEventListener("drop", function (e) {
        e.preventDefault();
        card.classList.remove("drag-over");
        if (uiState.draggedId && uiState.draggedId !== id) {
          store.moveItem(uiState.draggedId, id, "before");
          setStatus("Updated display order.", "success");
        }
      });
    });
  }

  function handleCardAction(id, action) {
    var item = store.state.items.find(function (it) {
      return it.id === id;
    });
    if (!item) return;

    if (action === "move-up") {
      store.shiftItemOrder(id, -1);
      setStatus("Moved '" + item.name + "' earlier.");
    } else if (action === "move-down") {
      store.shiftItemOrder(id, 1);
      setStatus("Moved '" + item.name + "' later.");
    } else if (action === "edit") {
      openItemModal(item);
    } else if (action === "delete") {
      if (window.confirm('Remove "' + item.name + '" from Launcher?')) {
        store.deleteItem(id);
        setStatus("Deleted '" + item.name + "'.");
      }
    }
  }

  // ==================== Launching Items ====================
  function launchItem(item) {
    if (item.type === "script") {
      setStatus("Running script: " + item.name + "...");
      var cmd =
        "AETinyLauncherHost.runScriptFile(" +
        JSON.stringify(item.filePath || "") +
        ", " +
        JSON.stringify(item.code || "") +
        ", " +
        JSON.stringify(item.name || "") +
        ")";
      evalHostFunction(cmd).then(function (res) {
        if (res.ok) {
          setStatus(res.message || "Executed: " + item.name, "success");
        } else {
          setStatus("Error: " + res.error, "error");
        }
      });
    } else if (item.type === "expression") {
      openExpressionModal(item);
    } else if (item.type === "ffx") {
      openFfxModal(item);
    }
  }

  // ==================== Modal Helpers ====================
  function openModal(id) {
    $(id).classList.remove("hidden");
  }

  function closeModal(id) {
    $(id).classList.add("hidden");
  }

  // ==================== Add / Edit Item Modal ====================
  function openItemModal(item) {
    var isEdit = !!item;
    $("modal-item-title").textContent = isEdit ? "Edit Item" : "Add Script / Expression / FFX";
    $("item-id").value = isEdit ? item.id : "";
    $("item-type").value = isEdit ? item.type : "script";
    $("item-color").value = isEdit ? item.color || "#4f8cff" : "#4f8cff";
    $("item-name").value = isEdit ? item.name : "";
    $("item-icon").value = isEdit ? item.icon || "bolt" : "bolt";
    $("item-description").value = isEdit ? item.description || "" : "";
    $("item-filepath").value = isEdit ? item.filePath || "" : "";
    $("item-code").value = isEdit ? item.code || "" : "";
    $("item-tags").value = isEdit && Array.isArray(item.tags) ? item.tags.join(", ") : "";
    updateItemFormVisibility();
    openModal("modal-item");
  }

  function updateItemFormVisibility() {
    var t = $("item-type").value;
    $("group-item-code").classList.toggle("hidden", t === "ffx");
    if (!$("item-id").value) {
      if (t === "expression") {
        $("item-color").value = "#a855f7";
        $("item-icon").value = "wave";
      } else if (t === "ffx") {
        $("item-color").value = "#f59e0b";
        $("item-icon").value = "sparkles";
      } else {
        $("item-color").value = "#4f8cff";
        $("item-icon").value = "bolt";
      }
    }
  }

  function browseLocalFile() {
    if (typeof cep !== "undefined" && cep.fs && cep.fs.showOpenDialog) {
      var res = cep.fs.showOpenDialog(false, false, "Select Script, Expression, or FFX Preset", "", [
        "jsx",
        "jsxbin",
        "ffx",
        "js",
        "txt",
        "expr"
      ]);
      if (res && res.err === 0 && res.data && res.data.length > 0) {
        applyPickedFilePath(res.data[0]);
      }
      return;
    }
    $("hidden-file-picker").click();
  }

  function applyPickedFilePath(filePath) {
    $("item-filepath").value = filePath;
    var base = filePath.split(/[/\\]/).pop();
    if (!$("item-name").value.trim()) {
      $("item-name").value = base.replace(/\.(expr\.js|expr\.txt|expr|jsxbin|jsx|ffx)$/i, "");
    }
    var lower = base.toLowerCase();
    if (lower.endsWith(".ffx")) {
      $("item-type").value = "ffx";
    } else if (lower.endsWith(".expr") || lower.endsWith(".expr.js") || lower.endsWith(".expr.txt")) {
      $("item-type").value = "expression";
    } else if (lower.endsWith(".jsx") || lower.endsWith(".jsxbin")) {
      $("item-type").value = "script";
    }
    updateItemFormVisibility();
  }

  // ==================== Expression Target Modal ====================
  function openExpressionModal(item) {
    uiState.activeExpressionItem = item;
    $("expr-modal-title").textContent = "Apply Expression: " + item.name;
    $("expr-code-preview").value = item.code || "";
    $("expr-common-preset").value = item.defaultTargetPreset || "transform.position";
    $("expr-apply-mode").value = item.defaultApplyMode || "replace";
    $("expr-keyframe-mode").value = item.defaultKeyframeMode || "keep";
    $("expr-enable-flag").checked = true;

    // Load code from file if code is empty and filePath exists in Node
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

    openModal("modal-expression");
    refreshExpressionContext();
  }

  function refreshExpressionContext() {
    $("expr-comp-name").textContent = "Loading AE context...";
    fetchAEContext().then(function (ctx) {
      if (!ctx.ok) {
        $("expr-comp-name").textContent = "Error: " + ctx.error;
        return;
      }
      if (!ctx.activeComp) {
        $("expr-comp-name").textContent = "No active composition open";
      } else {
        $("expr-comp-name").textContent = ctx.activeComp.name + " (" + ctx.layers.length + " layers)";
      }

      // Populate Selected Properties list
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

      // Populate Common Layers Checklist
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

      // Populate Layer dropdown for Property Tree
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
        loadLayerPropertyTree();
      } else {
        $("expr-tree-props-list").innerHTML = '<div class="checklist-empty">No layers available.</div>';
      }
    });
  }

  function loadLayerPropertyTree() {
    var ctx = uiState.aeContext;
    var layerIndex = Number($("expr-tree-layer").value);
    if (!ctx || !ctx.activeComp || !layerIndex) return;

    $("expr-tree-props-list").innerHTML = '<div class="checklist-empty">Scanning layer properties...</div>';

    if (ctx.mock) {
      uiState.layerPropertiesCache = [
        { name: "Anchor Point", pathNames: "Transform > Anchor Point", indices: [2, 1], hasExpression: false, numKeys: 0 },
        { name: "Position", pathNames: "Transform > Position", indices: [2, 2], hasExpression: false, numKeys: 0 },
        { name: "Scale", pathNames: "Transform > Scale", indices: [2, 6], hasExpression: false, numKeys: 0 },
        { name: "Rotation", pathNames: "Transform > Rotation", indices: [2, 10], hasExpression: false, numKeys: 0 },
        { name: "Opacity", pathNames: "Transform > Opacity", indices: [2, 11], hasExpression: false, numKeys: 0 }
      ];
      renderLayerPropertyTreeList();
      return;
    }

    evalHostFunction("AETinyLauncherHost.getLayerProperties(" + Number(ctx.activeComp.id) + ", " + layerIndex + ")").then(
      function (res) {
        if (!res.ok) {
          $("expr-tree-props-list").innerHTML = '<div class="checklist-empty">' + escapeHtml(res.error) + "</div>";
          return;
        }
        uiState.layerPropertiesCache = res.properties || [];
        renderLayerPropertyTreeList();
      }
    );
  }

  function renderLayerPropertyTreeList() {
    var search = $("expr-tree-search").value.trim().toLowerCase();
    var layerIndex = Number($("expr-tree-layer").value);
    var props = uiState.layerPropertiesCache.filter(function (p) {
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
  }

  function switchExprTargetPanel() {
    var mode = document.querySelector('input[name="exprTargetMode"]:checked').value;
    $("expr-panel-selected").classList.toggle("hidden", mode !== "selected_props");
    $("expr-panel-common").classList.toggle("hidden", mode !== "common_preset");
    $("expr-panel-tree").classList.toggle("hidden", mode !== "specific_paths");
  }

  function executeApplyExpression() {
    var mode = document.querySelector('input[name="exprTargetMode"]:checked').value;
    var code = $("expr-code-preview").value;
    if (!code.trim()) {
      setStatus("Expression code is empty.", "error");
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
      compId: uiState.aeContext && uiState.aeContext.activeComp ? uiState.aeContext.activeComp.id : null,
      targetMode: mode,
      commonPresetId: $("expr-common-preset").value,
      layerIndices: layerIndices,
      specificTargets: specificTargets,
      expressionCode: code,
      applyMode: $("expr-apply-mode").value,
      keyframeMode: $("expr-keyframe-mode").value,
      enableExpression: $("expr-enable-flag").checked
    };

    setStatus("Applying expression...");
    evalHostFunction("AETinyLauncherHost.applyExpressionWithOptions(" + JSON.stringify(JSON.stringify(payload)) + ")").then(
      function (res) {
        if (res.ok) {
          setStatus(res.message || "Expression applied.", "success");
          closeModal("modal-expression");
        } else {
          setStatus("Expression Error: " + res.error, "error");
          window.alert("Expression Apply Error:\n" + res.error);
        }
      }
    );
  }

  // ==================== FFX Target Modal ====================
  function openFfxModal(item) {
    uiState.activeFfxItem = item;
    $("ffx-modal-title").textContent = "Apply FFX: " + item.name;
    $("ffx-file-display").textContent = item.filePath || "(No file path set - edit item to select a .ffx file)";
    $("ffx-time-mode").value = item.defaultTimeMode || "current_time";
    $("ffx-keyframe-mode").value = "keep";
    $("ffx-clear-effects").checked = false;

    var defaultMode = item.defaultTargetLayerMode || "selected_layers";
    var radio = document.querySelector('input[name="ffxTargetMode"][value="' + defaultMode + '"]');
    if (radio) radio.checked = true;

    openModal("modal-ffx");
    refreshFfxContext();
  }

  function refreshFfxContext() {
    fetchAEContext().then(function (ctx) {
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
      updateFfxLayerListVisibility();
    });
  }

  function updateFfxLayerListVisibility() {
    var mode = document.querySelector('input[name="ffxTargetMode"]:checked').value;
    var needsList = mode === "selected_layers" || mode === "checked_layers";
    $("ffx-layer-checklist-wrap").classList.toggle("hidden", !needsList);
    if (mode === "selected_layers") {
      $("ffx-layer-subtitle").textContent = "Preview of AE selected layers (applied to AE timeline selection):";
    } else if (mode === "checked_layers") {
      $("ffx-layer-subtitle").textContent = "Check the specific layers to apply this FFX preset to:";
    }
  }

  function executeApplyFfx() {
    var item = uiState.activeFfxItem;
    if (!item || !item.filePath) {
      setStatus("Missing .ffx file path.", "error");
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

    setStatus("Applying FFX preset: " + item.name + "...");
    evalHostFunction("AETinyLauncherHost.applyFFXWithOptions(" + JSON.stringify(JSON.stringify(payload)) + ")").then(
      function (res) {
        if (res.ok) {
          setStatus(res.message || "FFX applied.", "success");
          closeModal("modal-ffx");
        } else {
          setStatus("FFX Error: " + res.error, "error");
          window.alert("FFX Apply Error:\n" + res.error);
        }
      }
    );
  }

  // ==================== Settings, GitHub Sync & Self-Update ====================
  function openSettingsModal() {
    var s = store.state.settings;
    var gh = s.scriptsRepo || {};
    var up = s.launcherUpdateRepo || {};

    $("cfg-scripts-repo").value = gh.owner && gh.repo ? gh.owner + "/" + gh.repo : gh.owner || "";
    $("cfg-scripts-branch").value = gh.branch || "main";
    $("cfg-scripts-subpath").value = gh.subPath || "";
    $("cfg-github-token").value = gh.token || "";
    $("cfg-scripts-autosync").checked = !!gh.autoSyncOnLaunch;
    $("cfg-scripts-prune").checked = !!gh.pruneMissing;
    $("cfg-last-sync").textContent = gh.lastSyncAt ? "Last sync: " + new Date(gh.lastSyncAt).toLocaleString() : "Never synced";

    $("cfg-current-version").textContent = LauncherUpdater.CURRENT_VERSION;
    $("cfg-update-repo").value = up.owner && up.repo ? up.owner + "/" + up.repo : up.repo || "";
    $("cfg-update-autocheck").checked = up.autoCheckOnLaunch !== false;

    $("cfg-icon-size").value = s.iconSize || "medium";
    $("cfg-view-mode").value = s.viewMode || "grid";

    $("update-status-box").classList.add("hidden");
    $("btn-install-update").classList.add("hidden");

    openModal("modal-settings");
  }

  function saveSettingsFromModal() {
    var scriptsParsed = GitHubSync.parseRepoInput($("cfg-scripts-repo").value);
    var updateParsed = GitHubSync.parseRepoInput($("cfg-update-repo").value);

    store.updateSettings({
      iconSize: $("cfg-icon-size").value,
      viewMode: $("cfg-view-mode").value,
      scriptsRepo: {
        owner: scriptsParsed.owner,
        repo: scriptsParsed.repo,
        branch: $("cfg-scripts-branch").value.trim() || "main",
        subPath: $("cfg-scripts-subpath").value.trim(),
        token: $("cfg-github-token").value.trim(),
        autoSyncOnLaunch: $("cfg-scripts-autosync").checked,
        pruneMissing: $("cfg-scripts-prune").checked
      },
      launcherUpdateRepo: {
        owner: updateParsed.owner,
        repo: updateParsed.repo || "AE-tiny-scripts-launcher",
        autoCheckOnLaunch: $("cfg-update-autocheck").checked
      }
    });
    setStatus("Settings saved.", "success");
    closeModal("modal-settings");
  }

  function runGitHubSync(silent) {
    var gh = store.state.settings.scriptsRepo;
    if (!gh.owner || !gh.repo) {
      if (!silent) {
        setStatus("Configure GitHub Scripts Repository in Settings first.", "error");
        openSettingsModal();
      }
      return;
    }

    var syncBtn = $("btn-sync-github");
    syncBtn.classList.add("spinning");
    setStatus("Syncing scripts from GitHub...");

    GitHubSync.syncFromGitHub(store, {
      removeMissingRemote: !!gh.pruneMissing,
      onProgress: function (msg) {
        setStatus(msg);
      }
    })
      .then(function (summary) {
        syncBtn.classList.remove("spinning");
        setStatus(
          "GitHub Sync complete: +" + summary.added + " added, " + summary.updated + " updated (" + summary.total + " total).",
          "success"
        );
        if ($("cfg-last-sync")) {
          $("cfg-last-sync").textContent = "Last sync: " + new Date().toLocaleString();
        }
      })
      .catch(function (err) {
        syncBtn.classList.remove("spinning");
        setStatus("GitHub Sync failed: " + err.message, "error");
        if (!silent) {
          window.alert("GitHub Sync Error:\n" + err.message);
        }
      });
  }

  function checkSelfUpdates(silent) {
    var box = $("update-status-box");
    var installBtn = $("btn-install-update");

    if (!silent) {
      box.classList.remove("hidden");
      box.textContent = "Checking GitHub Releases...";
    }

    LauncherUpdater.checkForUpdates(store)
      .then(function (info) {
        uiState.pendingUpdateInfo = info;
        if (info.hasUpdate) {
          $("update-dot").classList.remove("hidden");
          box.classList.remove("hidden");
          box.textContent =
            "Update available: v" +
            info.latestVersion +
            " (current: v" +
            info.currentVersion +
            ")\n\n" +
            (info.releaseNotes || "");
          installBtn.classList.remove("hidden");
          setStatus("New launcher version v" + info.latestVersion + " available!", "success");
        } else {
          $("update-dot").classList.add("hidden");
          installBtn.classList.add("hidden");
          if (!silent) {
            box.classList.remove("hidden");
            box.textContent = "You are on the latest version (v" + info.currentVersion + ").";
            setStatus("Launcher is up to date (v" + info.currentVersion + ").");
          }
        }
      })
      .catch(function (err) {
        if (!silent) {
          box.classList.remove("hidden");
          box.textContent = "Update check failed: " + err.message;
          setStatus("Update check failed: " + err.message, "error");
        }
      });
  }

  function performSelfUpdate() {
    if (!uiState.pendingUpdateInfo) return;
    var box = $("update-status-box");
    var extDir = csInterface.getSystemPath(SystemPath.EXTENSION);
    var token = (store.state.settings.scriptsRepo && store.state.settings.scriptsRepo.token) || "";

    box.classList.remove("hidden");
    LauncherUpdater.installUpdate(uiState.pendingUpdateInfo, extDir, token, function (msg) {
      box.textContent = msg;
      setStatus(msg);
    })
      .then(function () {
        setTimeout(function () {
          window.location.reload();
        }, 1200);
      })
      .catch(function (err) {
        box.textContent = "Update failed: " + err.message;
        setStatus("Update failed: " + err.message, "error");
      });
  }

  // ==================== Event Wiring & Initialization ====================
  function bindEvents() {
    // Toolbar
    $("btn-view-grid").addEventListener("click", function () {
      store.updateSettings({ viewMode: "grid" });
    });
    $("btn-view-list").addEventListener("click", function () {
      store.updateSettings({ viewMode: "list" });
    });
    $("sort-select").addEventListener("change", function (e) {
      store.updateSettings({ sortBy: e.target.value });
    });
    $("search-input").addEventListener("input", function (e) {
      uiState.searchQuery = e.target.value;
      renderItems();
    });
    $("type-filters").addEventListener("click", function (e) {
      var pill = e.target.closest("[data-type]");
      if (!pill) return;
      store.updateSettings({ filterType: pill.getAttribute("data-type") });
    });
    $("btn-reorder-mode").addEventListener("click", function () {
      uiState.reorderMode = !uiState.reorderMode;
      if (uiState.reorderMode && store.state.settings.sortBy !== "custom") {
        store.updateSettings({ sortBy: "custom" });
      } else {
        renderItems();
      }
    });

    $("btn-add-item").addEventListener("click", function () {
      openItemModal(null);
    });
    $("btn-empty-add").addEventListener("click", function () {
      openItemModal(null);
    });
    $("btn-sync-github").addEventListener("click", function () {
      runGitHubSync(false);
    });
    $("btn-settings").addEventListener("click", openSettingsModal);

    // Close modals
    document.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeModal(btn.getAttribute("data-close"));
      });
    });

    // Item Modal Form
    $("item-type").addEventListener("change", updateItemFormVisibility);
    $("btn-browse-file").addEventListener("click", browseLocalFile);
    $("hidden-file-picker").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      applyPickedFilePath(file.path || file.name);
      if (typeof FileReader !== "undefined" && !file.name.toLowerCase().endsWith(".ffx") && !file.name.toLowerCase().endsWith(".jsxbin")) {
        var reader = new FileReader();
        reader.onload = function (ev) {
          if (!$("item-code").value) {
            $("item-code").value = ev.target.result || "";
          }
        };
        reader.readAsText(file);
      }
    });

    $("form-item").addEventListener("submit", function (e) {
      e.preventDefault();
      var existingId = $("item-id").value;
      var tags = $("item-tags")
        .value.split(",")
        .map(function (t) {
          return t.trim();
        })
        .filter(Boolean);

      var payload = {
        name: $("item-name").value.trim(),
        type: $("item-type").value,
        color: $("item-color").value,
        icon: $("item-icon").value,
        description: $("item-description").value.trim(),
        filePath: $("item-filepath").value.trim(),
        code: $("item-code").value,
        tags: tags
      };

      if (existingId) {
        store.updateItem(existingId, payload);
        setStatus("Updated '" + payload.name + "'.", "success");
      } else {
        store.addItem(payload);
        setStatus("Added '" + payload.name + "'.", "success");
      }
      closeModal("modal-item");
    });

    // Expression Modal Events
    $("btn-expr-refresh").addEventListener("click", refreshExpressionContext);
    document.querySelectorAll('input[name="exprTargetMode"]').forEach(function (r) {
      r.addEventListener("change", switchExprTargetPanel);
    });
    $("expr-tree-layer").addEventListener("change", loadLayerPropertyTree);
    $("expr-tree-search").addEventListener("input", renderLayerPropertyTreeList);
    $("btn-expr-apply").addEventListener("click", executeApplyExpression);

    // FFX Modal Events
    $("btn-ffx-refresh").addEventListener("click", refreshFfxContext);
    document.querySelectorAll('input[name="ffxTargetMode"]').forEach(function (r) {
      r.addEventListener("change", updateFfxLayerListVisibility);
    });
    $("btn-ffx-apply").addEventListener("click", executeApplyFfx);

    // Settings & Updater Events
    $("btn-save-settings").addEventListener("click", saveSettingsFromModal);
    $("btn-settings-sync-now").addEventListener("click", function () {
      saveSettingsFromModal();
      runGitHubSync(false);
    });
    $("btn-check-update").addEventListener("click", function () {
      var updateParsed = GitHubSync.parseRepoInput($("cfg-update-repo").value);
      store.updateSettings({
        launcherUpdateRepo: {
          owner: updateParsed.owner,
          repo: updateParsed.repo || "AE-tiny-scripts-launcher"
        }
      });
      checkSelfUpdates(false);
    });
    $("btn-install-update").addEventListener("click", performSelfUpdate);
  }

  function init() {
    applyHostTheme();
    csInterface.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, applyHostTheme);

    $("version-badge").textContent = "v" + LauncherUpdater.CURRENT_VERSION;

    store.subscribe(renderItems);
    bindEvents();
    renderItems();

    var s = store.state.settings;
    if (s.scriptsRepo && s.scriptsRepo.autoSyncOnLaunch && s.scriptsRepo.owner && s.scriptsRepo.repo) {
      runGitHubSync(true);
    }
    if (
      s.launcherUpdateRepo &&
      s.launcherUpdateRepo.autoCheckOnLaunch &&
      s.launcherUpdateRepo.owner &&
      s.launcherUpdateRepo.repo
    ) {
      checkSelfUpdates(true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
