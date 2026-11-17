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

  function resolveItemIconHtml(item) {
    var iconSvg = ICONS[item.icon] || ICONS.bolt;
    var customPath = item.customIconPath || "";
    if (!customPath && item.filePath && typeof IconResolver !== "undefined") {
      customPath = IconResolver.findSiblingImageFile(item.filePath);
    }
    if (customPath && typeof IconResolver !== "undefined") {
      var imgUrl = IconResolver.toFileUrl(customPath);
      return {
        hasCustom: true,
        html:
          '<img class="custom-item-icon" src="' +
          escapeHtml(imgUrl) +
          '" alt="" onerror="this.parentNode.classList.remove(\'has-custom-icon\');this.parentNode.style.background=this.parentNode.getAttribute(\'data-fallback-bg\');this.style.display=\'none\';this.nextSibling.style.display=\'inline-flex\';" />' +
          '<span class="fallback-svg-wrap" style="display:none;align-items:center;justify-content:center;">' +
          iconSvg +
          "</span>"
      };
    }
    return { hasCustom: false, html: iconSvg };
  }

  function renderItems() {
    var settings = store.state.settings;
    var container = $("items-container");
    var emptyState = $("empty-state");
    var items = getFilteredAndSortedItems();
    var cardScale = Number(settings.cardScale) || 100;

    // Sync toolbar UI controls
    $("btn-view-grid").classList.toggle("active", settings.viewMode === "grid");
    $("btn-view-list").classList.toggle("active", settings.viewMode === "list");
    $("sort-select").value = settings.sortBy;
    $("btn-reorder-mode").classList.toggle("active", uiState.reorderMode);
    if ($("card-scale-control")) {
      $("card-scale-control").classList.toggle("hidden", settings.viewMode === "list");
      $("card-scale-slider").value = cardScale;
      $("card-scale-label").textContent = cardScale + "%";
    }

    document.querySelectorAll("#type-filters .pill").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-type") === settings.filterType);
    });

    container.className =
      "items-container " +
      (settings.viewMode === "list" ? "view-list" : "view-grid") +
      (cardScale <= 72 ? " card-compact" : "") +
      (uiState.reorderMode ? " reorder-active" : "");
    container.style.setProperty("--card-scale", String(cardScale / 100));

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
        var iconInfo = resolveItemIconHtml(item);
        var fallbackColor = item.color || "#4f8cff";
        var iconWrapStyle = iconInfo.hasCustom ? "background:transparent" : "background:" + escapeHtml(fallbackColor);
        var iconWrapExtra = iconInfo.hasCustom ? " has-custom-icon" : "";
        var typeLabel = item.type === "expression" ? "EXPR" : item.type === "ffx" ? "FFX" : "JSX";
        var itemVerLabel = item.version ? "v" + String(item.version).replace(/^v/i, "") : "";
        var itemVerBadge = itemVerLabel ? '<span class="badge badge-item-version">' + escapeHtml(itemVerLabel) + "</span>" : "";
        var tooltipText = (item.description || item.filePath || item.name) + (itemVerLabel ? " (" + itemVerLabel + ")" : "");
        var sourceBadge =
          item.source === "github"
            ? '<span class="badge badge-github">GH</span>'
            : item.source === "tiny-local"
            ? '<span class="badge badge-tiny-local">TINY</span>'
            : item.source === "local"
            ? '<span class="badge badge-local">DIR</span>'
            : "";
        var customTagBadges = Array.isArray(item.tags)
          ? item.tags
              .filter(function (t) {
                return t && t !== "local" && t !== "github" && t !== "tiny-local" && t !== "ae-tiny-scripts";
              })
              .map(function (t) {
                return '<span class="badge badge-user-tag">' + escapeHtml(t) + "</span>";
              })
              .join("")
          : "";
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
            escapeHtml(tooltipText) +
            '">' +
            '<div class="list-icon-wrap' +
            iconWrapExtra +
            '" data-fallback-bg="' +
            escapeHtml(fallbackColor) +
            '" style="' +
            iconWrapStyle +
            '">' +
            iconInfo.html +
            "</div>" +
            '<div class="list-main">' +
            '<div class="list-title-row">' +
            '<span class="list-name">' +
            escapeHtml(item.name) +
            "</span>" +
            "</div>" +
            '<div class="list-tags-row">' +
            '<span class="badge badge-' +
            escapeHtml(item.type) +
            '">' +
            typeLabel +
            "</span>" +
            itemVerBadge +
            sourceBadge +
            customTagBadges +
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
          escapeHtml(tooltipText) +
          '">' +
          '<div class="card-hover-actions">' +
          commonActions +
          "</div>" +
          '<div class="grid-icon-wrap' +
          iconWrapExtra +
          '" data-fallback-bg="' +
          escapeHtml(fallbackColor) +
          '" style="' +
          iconWrapStyle +
          '">' +
          iconInfo.html +
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
          itemVerBadge +
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

  var inlineTargetPicker = null;

  // ==================== Launching Items ====================
  function openExternalTargetPicker(item) {
    store.savePendingTargetRequest(item);

    if (csInterface.isCEPEnvironment()) {
      csInterface.requestOpenExtension("com.ae.tinyscripts.launcher.targetpicker", "");
      var evt = new CSEvent(
        "com.ae.tinyscripts.launcher.TARGET_REQUEST",
        "APPLICATION",
        "AEFT",
        "com.ae.tinyscripts.launcher.targetpicker"
      );
      evt.data = JSON.stringify({ item: item });
      csInterface.dispatchEvent(evt);
      setStatus("Opened Target Picker window for: " + item.name);
      return;
    }

    // Standalone browser preview: open external popup window first, fall back to inline modal if blocked
    var popup = null;
    if (typeof window.open === "function") {
      popup = window.open("target-picker.html", "AETinyTargetPicker", "width=540,height=640,resizable=yes");
    }
    if (popup) {
      setStatus("Opened Target Picker window for: " + item.name);
      return;
    }

    if (!inlineTargetPicker && globalTargetPicker()) {
      inlineTargetPicker = new globalTargetPicker().Controller({
        csInterface: csInterface,
        standalone: false,
        onStatus: setStatus
      });
    }
    if (inlineTargetPicker) {
      inlineTargetPicker.openItem(item);
    }
  }

  function globalTargetPicker() {
    return typeof window !== "undefined" ? window.TargetPicker : null;
  }

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
    } else if (item.type === "expression" || item.type === "ffx") {
      openExternalTargetPicker(item);
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
    $("item-version").value = isEdit ? item.version || "" : "";
    $("item-icon").value = isEdit ? item.icon || "bolt" : "bolt";
    $("item-description").value = isEdit ? item.description || "" : "";
    $("item-filepath").value = isEdit ? item.filePath || "" : "";
    $("item-icon-path").value = isEdit ? item.customIconPath || "" : "";
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
    if (!$("item-icon-path").value.trim() && typeof IconResolver !== "undefined") {
      var sibling = IconResolver.findSiblingImageFile(filePath);
      if (sibling) {
        $("item-icon-path").value = sibling;
      }
    }
    if (!$("item-version").value.trim()) {
      var sidecar = LauncherStore.readSidecarMeta(filePath);
      if (sidecar && sidecar.version) {
        $("item-version").value = sidecar.version;
      } else if (typeof require === "function" && (lower.endsWith(".jsx") || lower.indexOf(".expr") >= 0)) {
        try {
          var req = typeof cep_node !== "undefined" && cep_node.require ? cep_node.require : require;
          var fs = req("fs");
          if (fs.existsSync(filePath)) {
            var detectedVer = LauncherStore.parseContentVersion(fs.readFileSync(filePath, "utf8"));
            if (detectedVer) $("item-version").value = detectedVer;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    updateItemFormVisibility();
  }

  function browseIconImage() {
    if (typeof cep !== "undefined" && cep.fs && cep.fs.showOpenDialog) {
      var res = cep.fs.showOpenDialog(false, false, "Select Icon Image", "", ["png", "svg", "jpg", "jpeg", "webp", "gif"]);
      if (res && res.err === 0 && res.data && res.data.length > 0) {
        $("item-icon-path").value = res.data[0];
      }
    }
  }

  function autoDetectSiblingIcon() {
    var fp = $("item-filepath").value.trim();
    if (!fp || typeof IconResolver === "undefined") return;
    var sibling = IconResolver.findSiblingImageFile(fp);
    if (sibling) {
      $("item-icon-path").value = sibling;
      setStatus("Found sibling icon: " + sibling, "success");
    } else {
      setStatus("No same-name image found next to script file.");
    }
  }

  // ==================== Local Script Folders Management ====================
  var tempLocalFolders = [];

  function renderLocalFoldersSettingsList() {
    var box = $("cfg-local-folders-list");
    if (!box) return;
    if (!tempLocalFolders || tempLocalFolders.length === 0) {
      box.innerHTML = '<div class="checklist-empty">No local folders added yet.</div>';
      return;
    }
    box.innerHTML = tempLocalFolders
      .map(function (folderPath, idx) {
        return (
          '<div class="checklist-item folder-list-row">' +
          '<span class="folder-list-path" title="' +
          escapeHtml(folderPath) +
          '">' +
          escapeHtml(folderPath) +
          "</span>" +
          '<button type="button" class="mini-btn danger" data-remove-folder="' +
          idx +
          '" title="Remove Folder">&times;</button>' +
          "</div>"
        );
      })
      .join("");
  }

  function runLocalTinyScriptsLoad(silent) {
    var tiny = store.state.settings.localTinyScriptsRepo || {};
    if (!tiny.path) {
      if (!silent) {
        setStatus("Configure local AE-tiny-scripts path in Settings first.", "error");
        openSettingsModal();
      }
      return;
    }
    setStatus("Loading local AE-tiny-scripts...");
    LocalSync.scanLocalTinyScriptsRepo(store)
      .then(function (summary) {
        var verTag = summary.contentVersion ? " (v" + summary.contentVersion + ")" : "";
        setStatus(
          "Local AE-tiny-scripts loaded" +
            verTag +
            ": +" +
            summary.added +
            " added, " +
            summary.updated +
            " updated (" +
            summary.total +
            " total).",
          "success"
        );
        if ($("cfg-last-tiny-local")) {
          $("cfg-last-tiny-local").textContent =
            "Last loaded: " + new Date().toLocaleString() + (summary.contentVersion ? " (v" + summary.contentVersion + ")" : "");
        }
      })
      .catch(function (err) {
        setStatus("Local AE-tiny-scripts load failed: " + err.message, "error");
        if (!silent) {
          window.alert("Local AE-tiny-scripts Load Error:\n" + err.message);
        }
      });
  }

  function runLocalFoldersScan(silent) {
    var lf = store.state.settings.localFolders || {};
    var tiny = store.state.settings.localTinyScriptsRepo || {};
    var paths = lf.paths || [];
    var hasTiny = !!(tiny.enabled && tiny.path);

    if (paths.length === 0 && !hasTiny) {
      if (!silent) {
        setStatus("Configure Local AE-tiny-scripts or Local Folders in Settings first.", "error");
        openSettingsModal();
      }
      return;
    }

    if (hasTiny) {
      runLocalTinyScriptsLoad(silent);
    }
    if (paths.length === 0) {
      return;
    }
    setStatus("Scanning local script folders...");
    LocalSync.scanLocalFolders(store)
      .then(function (summary) {
        var warn =
          summary.missingFolders && summary.missingFolders.length > 0
            ? " (" + summary.missingFolders.length + " folder(s) not found)"
            : "";
        setStatus(
          "Local Scan complete: +" +
            summary.added +
            " added, " +
            summary.updated +
            " updated (" +
            summary.total +
            " found)" +
            warn,
          summary.missingFolders && summary.missingFolders.length > 0 ? "error" : "success"
        );
        if ($("cfg-last-local-scan")) {
          $("cfg-last-local-scan").textContent = "Last scan: " + new Date().toLocaleString();
        }
      })
      .catch(function (err) {
        setStatus("Local Scan failed: " + err.message, "error");
        if (!silent) {
          window.alert("Local Folder Scan Error:\n" + err.message);
        }
      });
  }

  // ==================== Settings, GitHub Sync & Self-Update ====================
  function openSettingsModal() {
    var s = store.state.settings;
    var tiny = s.localTinyScriptsRepo || {};
    var lf = s.localFolders || {};
    var gh = s.scriptsRepo || {};
    var up = s.launcherUpdateRepo || {};

    $("cfg-tiny-local-enabled").checked = !!tiny.enabled;
    $("cfg-tiny-local-path").value = tiny.path || "";
    $("cfg-tiny-local-subpath").value = tiny.subPath || "";
    $("cfg-tiny-local-autosync").checked = tiny.autoSyncOnLaunch !== false;
    $("cfg-tiny-local-prune").checked = tiny.pruneMissing !== false;
    $("cfg-last-tiny-local").textContent = tiny.lastSyncAt
      ? "Last loaded: " +
        new Date(tiny.lastSyncAt).toLocaleString() +
        (tiny.contentVersion ? " (v" + tiny.contentVersion + ")" : "")
      : "Never loaded";

    tempLocalFolders = Array.isArray(lf.paths) ? lf.paths.slice() : [];
    renderLocalFoldersSettingsList();
    $("cfg-local-folder-input").value = "";
    $("cfg-local-autosync").checked = lf.autoScanOnLaunch !== false;
    $("cfg-local-prune").checked = lf.pruneMissing !== false;
    $("cfg-last-local-scan").textContent = lf.lastScanAt
      ? "Last scan: " + new Date(lf.lastScanAt).toLocaleString()
      : "Never scanned";

    $("cfg-scripts-repo").value = gh.owner && gh.repo ? gh.owner + "/" + gh.repo : gh.owner || "";
    $("cfg-scripts-branch").value = gh.branch || "main";
    $("cfg-scripts-subpath").value = gh.subPath || "";
    $("cfg-github-token").value = gh.token || "";
    $("cfg-scripts-autosync").checked = !!gh.autoSyncOnLaunch;
    $("cfg-scripts-prune").checked = !!gh.pruneMissing;
    $("cfg-last-sync").textContent = gh.lastSyncAt
      ? "Last sync: " +
        new Date(gh.lastSyncAt).toLocaleString() +
        (gh.contentVersion ? " (Scripts v" + gh.contentVersion + ")" : "")
      : "Never synced";

    if (typeof AppVersion !== "undefined") {
      $("cfg-current-version").textContent = AppVersion.isDevelop()
        ? "v" + AppVersion.version + " [DEVELOP / rev." + AppVersion.revision + "]"
        : "v" + AppVersion.version + " [PRODUCTION]";
    } else {
      $("cfg-current-version").textContent = LauncherUpdater.CURRENT_VERSION;
    }
    $("cfg-update-repo").value = up.owner && up.repo ? up.owner + "/" + up.repo : up.repo || "";
    $("cfg-update-autocheck").checked = up.autoCheckOnLaunch !== false;

    var scale = Number(s.cardScale) || 100;
    $("cfg-card-scale").value = scale;
    $("cfg-card-scale-label").textContent = scale + "%";
    $("cfg-view-mode").value = s.viewMode || "grid";

    $("update-status-box").classList.add("hidden");
    $("btn-install-update").classList.add("hidden");

    openModal("modal-settings");
  }

  function saveSettingsFromModal() {
    var scriptsParsed = GitHubSync.parseRepoInput($("cfg-scripts-repo").value);
    var updateParsed = GitHubSync.parseRepoInput($("cfg-update-repo").value);

    store.updateSettings({
      cardScale: Number($("cfg-card-scale").value) || 100,
      viewMode: $("cfg-view-mode").value,
      localTinyScriptsRepo: {
        enabled: $("cfg-tiny-local-enabled").checked,
        path: $("cfg-tiny-local-path").value.trim(),
        subPath: $("cfg-tiny-local-subpath").value.trim(),
        autoSyncOnLaunch: $("cfg-tiny-local-autosync").checked,
        pruneMissing: $("cfg-tiny-local-prune").checked
      },
      localFolders: {
        paths: tempLocalFolders.slice(),
        autoScanOnLaunch: $("cfg-local-autosync").checked,
        pruneMissing: $("cfg-local-prune").checked
      },
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
    $("search-input").addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $("search-input").value) {
        $("search-input").value = "";
        uiState.searchQuery = "";
        renderItems();
      }
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
    $("btn-scan-local").addEventListener("click", function () {
      runLocalFoldersScan(false);
    });
    $("card-scale-slider").addEventListener("input", function (e) {
      var val = Number(e.target.value) || 100;
      store.updateSettings({ cardScale: val });
    });
    $("btn-reset-card-scale").addEventListener("click", function () {
      store.updateSettings({ cardScale: 100 });
      setStatus("Card size reset to 100%.");
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
    $("btn-browse-icon").addEventListener("click", browseIconImage);
    $("btn-auto-icon").addEventListener("click", autoDetectSiblingIcon);
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
        version: $("item-version").value.trim().replace(/^v/i, ""),
        type: $("item-type").value,
        color: $("item-color").value,
        icon: $("item-icon").value,
        customIconPath: $("item-icon-path").value.trim(),
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

    // Settings & Updater Events
    $("btn-open-help").addEventListener("click", function () {
      if (csInterface.isCEPEnvironment()) {
        csInterface.requestOpenExtension("com.ae.tinyscripts.launcher.help", "");
      } else {
        window.open("help.html", "AETinyScriptsHelp", "width=560,height=640,resizable=yes");
      }
    });
    $("cfg-card-scale").addEventListener("input", function (e) {
      $("cfg-card-scale-label").textContent = e.target.value + "%";
    });
    $("btn-cfg-reset-card-scale").addEventListener("click", function () {
      $("cfg-card-scale").value = 100;
      $("cfg-card-scale-label").textContent = "100%";
      store.updateSettings({ cardScale: 100 });
    });
    $("btn-browse-tiny-local").addEventListener("click", function () {
      if (typeof cep !== "undefined" && cep.fs && cep.fs.showOpenDialog) {
        var res = cep.fs.showOpenDialog(false, true, "Select Local AE-tiny-scripts Folder", "", []);
        if (res && res.err === 0 && res.data && res.data.length > 0) {
          $("cfg-tiny-local-path").value = res.data[0];
          $("cfg-tiny-local-enabled").checked = true;
        }
      } else {
        window.alert("Enter the local AE-tiny-scripts directory path in the text box (CEP folder dialog is available inside After Effects).");
      }
    });
    $("btn-detect-tiny-local").addEventListener("click", function () {
      var extDir = csInterface.getSystemPath(SystemPath.EXTENSION);
      var detected =
        typeof LocalSync !== "undefined" && typeof LocalSync.detectLocalTinyScriptsPath === "function"
          ? LocalSync.detectLocalTinyScriptsPath(extDir)
          : "";
      if (detected) {
        $("cfg-tiny-local-path").value = detected;
        $("cfg-tiny-local-enabled").checked = true;
        setStatus("Detected local AE-tiny-scripts: " + detected, "success");
      } else {
        setStatus("Could not auto-detect AE-tiny-scripts folder. Please specify path manually.", "error");
      }
    });
    $("btn-settings-load-tiny-local").addEventListener("click", function () {
      $("cfg-tiny-local-enabled").checked = true;
      saveSettingsFromModal();
      runLocalTinyScriptsLoad(false);
    });
    $("btn-browse-local-folder").addEventListener("click", function () {
      if (typeof cep !== "undefined" && cep.fs && cep.fs.showOpenDialog) {
        var res = cep.fs.showOpenDialog(false, true, "Select Scripts Folder", "", []);
        if (res && res.err === 0 && res.data && res.data.length > 0) {
          $("cfg-local-folder-input").value = res.data[0];
        }
      } else {
        window.alert("Enter the local folder path in the text box (CEP folder dialog is available inside After Effects).");
      }
    });
    $("btn-add-local-folder").addEventListener("click", function () {
      var val = $("cfg-local-folder-input").value.trim();
      if (!val) return;
      if (tempLocalFolders.indexOf(val) === -1) {
        tempLocalFolders.push(val);
        renderLocalFoldersSettingsList();
      }
      $("cfg-local-folder-input").value = "";
    });
    $("cfg-local-folders-list").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-remove-folder]");
      if (!btn) return;
      var idx = Number(btn.getAttribute("data-remove-folder"));
      tempLocalFolders.splice(idx, 1);
      renderLocalFoldersSettingsList();
    });
    $("btn-settings-scan-local").addEventListener("click", function () {
      saveSettingsFromModal();
      runLocalFoldersScan(false);
    });
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
    csInterface.addEventListener("com.ae.tinyscripts.launcher.TARGET_RESULT", function (event) {
      try {
        var res = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (res && res.message) {
          setStatus(res.message, res.ok ? "success" : "error");
        }
      } catch (e) {
        // ignore
      }
    });
    window.addEventListener("storage", function (e) {
      if (e.key === "ae_tiny_scripts_launcher_target_result_v1" && e.newValue) {
        try {
          var res = JSON.parse(e.newValue);
          if (res && res.message) {
            setStatus(res.message, res.ok ? "success" : "error");
          }
        } catch (err) {
          // ignore
        }
      }
    });

    var badge = $("version-badge");
    var badgeText = $("version-badge-text");
    if (typeof AppVersion !== "undefined") {
      var label = AppVersion.getDisplayBadge();
      if (badgeText) {
        badgeText.textContent = label;
      } else {
        badge.textContent = label;
      }
      badge.className = "version-badge " + (AppVersion.isDevelop() ? "channel-develop" : "channel-production");
      badge.title = AppVersion.isDevelop()
        ? "Development Build (v" + AppVersion.version + ", Revision " + AppVersion.revision + ")"
        : "Production Build (v" + AppVersion.version + ")";
    } else if (badgeText) {
      badgeText.textContent = "v" + LauncherUpdater.CURRENT_VERSION;
    } else {
      badge.textContent = "v" + LauncherUpdater.CURRENT_VERSION;
    }

    store.subscribe(renderItems);
    bindEvents();
    renderItems();

    var s = store.state.settings;
    if (
      s.localTinyScriptsRepo &&
      s.localTinyScriptsRepo.enabled &&
      s.localTinyScriptsRepo.autoSyncOnLaunch !== false &&
      s.localTinyScriptsRepo.path
    ) {
      runLocalTinyScriptsLoad(true);
    }
    if (s.localFolders && s.localFolders.autoScanOnLaunch !== false && Array.isArray(s.localFolders.paths) && s.localFolders.paths.length > 0) {
      runLocalFoldersScan(true);
    }
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
