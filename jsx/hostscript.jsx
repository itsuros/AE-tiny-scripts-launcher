/* global app, CompItem, AVLayer, ShapeLayer, TextLayer, CameraLayer, LightLayer, PropertyType, PropertyValueType, File, Folder, $ */
/**
 * AE Tiny Scripts Launcher - ExtendScript Host (jsx/hostscript.jsx)
 * Provides safe JSON-based communication with the CEP panel for:
 * - Executing .jsx / .jsxbin files or inline scripts
 * - Inspecting active composition, selected layers, and selected properties
 * - Enumerating layer property trees for the Expression Target Picker UI
 * - Applying Expressions with detailed modes (replace, append, prepend, keyframe handling)
 * - Applying FFX animation presets to selected/specified layers or new solids/adjustment layers
 */

var AETinyLauncherHost = (function () {
  // Polyfill JSON for older ExtendScript engines if needed
  function toJSON(obj) {
    if (typeof JSON !== "undefined" && JSON.stringify) {
      return JSON.stringify(obj);
    }
    if (obj === null || obj === undefined) return "null";
    if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
    if (typeof obj === "string") {
      return (
        '"' +
        obj
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\r/g, "\\r")
          .replace(/\n/g, "\\n")
          .replace(/\t/g, "\\t") +
        '"'
      );
    }
    var i, res;
    if (obj instanceof Array) {
      res = [];
      for (i = 0; i < obj.length; i++) {
        res.push(toJSON(obj[i]));
      }
      return "[" + res.join(",") + "]";
    }
    if (typeof obj === "object") {
      res = [];
      for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
          res.push(toJSON(String(k)) + ":" + toJSON(obj[k]));
        }
      }
      return "{" + res.join(",") + "}";
    }
    return '""';
  }

  function parseJSON(str) {
    if (typeof JSON !== "undefined" && JSON.parse) {
      return JSON.parse(str);
    }
    return eval("(" + str + ")");
  }

  /**
   * Execute a .jsx / .jsxbin file from disk or inline ExtendScript code
   */
  function runScriptFile(filePath, inlineCode, scriptName) {
    try {
      if (filePath && filePath.length > 0) {
        var f = new File(filePath);
        if (!f.exists) {
          return toJSON({ ok: false, error: "Script file not found: " + filePath });
        }
        $.evalFile(f);
        return toJSON({ ok: true, message: "Executed: " + (scriptName || f.displayName) });
      } else if (inlineCode && inlineCode.length > 0) {
        eval(inlineCode);
        return toJSON({ ok: true, message: "Executed inline script: " + (scriptName || "Script") });
      }
      return toJSON({ ok: false, error: "No script path or code provided." });
    } catch (e) {
      return toJSON({
        ok: false,
        error: e.toString(),
        line: e.line || null
      });
    }
  }

  /**
   * Build path array of indices/matchNames from layer down to property
   */
  function getPropertyPathInfo(prop) {
    var names = [];
    var matchNames = [];
    var indices = [];
    var curr = prop;
    while (curr && curr.parentProperty !== null) {
      names.unshift(curr.name);
      matchNames.unshift(curr.matchName || curr.name);
      indices.unshift(curr.propertyIndex);
      curr = curr.parentProperty;
    }
    return {
      pathNames: names.join(" > "),
      matchNames: matchNames,
      indices: indices
    };
  }

  /**
   * Inspect current After Effects context:
   * - Active Comp or list of all Comps in project
   * - Layers in the active comp + selection state
   * - Currently selected properties that can accept expressions
   */
  function getContextSnapshot() {
    try {
      var proj = app.project;
      if (!proj) {
        return toJSON({ ok: false, error: "No project open." });
      }

      var comps = [];
      for (var c = 1; c <= proj.numItems; c++) {
        var item = proj.item(c);
        if (item instanceof CompItem) {
          comps.push({
            id: item.id,
            name: item.name,
            width: item.width,
            height: item.height,
            duration: item.duration,
            frameRate: item.frameRate,
            numLayers: item.numLayers
          });
        }
      }

      var activeItem = proj.activeItem;
      var activeComp = activeItem instanceof CompItem ? activeItem : null;

      var layers = [];
      var selectedProps = [];

      if (activeComp) {
        for (var l = 1; l <= activeComp.numLayers; l++) {
          var lyr = activeComp.layer(l);
          layers.push({
            index: lyr.index,
            name: lyr.name,
            selected: lyr.selected,
            locked: lyr.locked,
            enabled: lyr.enabled
          });
        }

        var selLayers = activeComp.selectedLayers;
        for (var s = 0; s < selLayers.length; s++) {
          var sLayer = selLayers[s];
          var props = sLayer.selectedProperties;
          for (var p = 0; p < props.length; p++) {
            var pr = props[p];
            if (pr.propertyType === PropertyType.PROPERTY) {
              var pathInfo = getPropertyPathInfo(pr);
              selectedProps.push({
                layerIndex: sLayer.index,
                layerName: sLayer.name,
                propName: pr.name,
                matchName: pr.matchName,
                canSetExpression: pr.canSetExpression,
                expressionEnabled: pr.expressionEnabled,
                currentExpression: pr.canSetExpression ? pr.expression : "",
                numKeys: pr.numKeys || 0,
                pathNames: pathInfo.pathNames,
                indices: pathInfo.indices
              });
            }
          }
        }
      }

      // Common preset properties that users frequently target
      var commonTargetPresets = [
        { id: "transform.position", label: "Transform > Position", groupMatch: "ADBE Transform Group", propMatch: "ADBE Position" },
        { id: "transform.scale", label: "Transform > Scale", groupMatch: "ADBE Transform Group", propMatch: "ADBE Scale" },
        { id: "transform.rotation", label: "Transform > Rotation / Z Rotation", groupMatch: "ADBE Transform Group", propMatch: "ADBE Rotate Z" },
        { id: "transform.opacity", label: "Transform > Opacity", groupMatch: "ADBE Transform Group", propMatch: "ADBE Opacity" },
        { id: "transform.anchorPoint", label: "Transform > Anchor Point", groupMatch: "ADBE Transform Group", propMatch: "ADBE Anchor Point" },
        { id: "timeRemap", label: "Layer > Time Remap", groupMatch: null, propMatch: "ADBE Time Remapping" }
      ];

      return toJSON({
        ok: true,
        activeComp: activeComp
          ? {
              id: activeComp.id,
              name: activeComp.name,
              numLayers: activeComp.numLayers
            }
          : null,
        comps: comps,
        layers: layers,
        selectedProps: selectedProps,
        commonTargetPresets: commonTargetPresets
      });
    } catch (e) {
      return toJSON({ ok: false, error: e.toString() });
    }
  }

  /**
   * Enumerate expression-capable properties of a given layer in a comp (up to maxDepth)
   */
  function getLayerProperties(compId, layerIndex) {
    try {
      var comp = findComp(compId);
      if (!comp) {
        return toJSON({ ok: false, error: "Target composition not found." });
      }
      if (layerIndex < 1 || layerIndex > comp.numLayers) {
        return toJSON({ ok: false, error: "Invalid layer index." });
      }
      var layer = comp.layer(layerIndex);
      var list = [];

      function walkGroup(group, depth, prefixNames, prefixIndices) {
        if (depth > 3) return;
        for (var i = 1; i <= group.numProperties; i++) {
          var p = group.property(i);
          var nextNames = prefixNames.concat([p.name]);
          var nextIndices = prefixIndices.concat([i]);
          if (p.propertyType === PropertyType.PROPERTY) {
            if (p.canSetExpression) {
              list.push({
                name: p.name,
                matchName: p.matchName,
                pathNames: nextNames.join(" > "),
                indices: nextIndices,
                hasExpression: p.expressionEnabled && p.expression !== "",
                numKeys: p.numKeys || 0
              });
            }
          } else {
            walkGroup(p, depth + 1, nextNames, nextIndices);
          }
        }
      }

      walkGroup(layer, 1, [], []);
      return toJSON({
        ok: true,
        layerIndex: layer.index,
        layerName: layer.name,
        properties: list
      });
    } catch (e) {
      return toJSON({ ok: false, error: e.toString() });
    }
  }

  function findComp(compId) {
    var proj = app.project;
    if (!proj) return null;
    if (compId) {
      for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (it instanceof CompItem && it.id === Number(compId)) {
          return it;
        }
      }
    }
    if (proj.activeItem instanceof CompItem) {
      return proj.activeItem;
    }
    return null;
  }

  function resolvePropertyByIndices(layer, indices) {
    var curr = layer;
    for (var i = 0; i < indices.length; i++) {
      if (!curr || typeof curr.property !== "function") return null;
      curr = curr.property(Number(indices[i]));
    }
    return curr;
  }

  function resolveCommonPresetProperty(layer, presetId) {
    var transform = layer.property("ADBE Transform Group");
    if (!transform) return null;
    if (presetId === "transform.position") return transform.property("ADBE Position");
    if (presetId === "transform.scale") return transform.property("ADBE Scale");
    if (presetId === "transform.rotation") {
      return transform.property("ADBE Rotate Z") || transform.property("ADBE Orientation");
    }
    if (presetId === "transform.opacity") return transform.property("ADBE Opacity");
    if (presetId === "transform.anchorPoint") return transform.property("ADBE Anchor Point");
    if (presetId === "timeRemap") {
      if (layer.canSetTimeRemapEnabled) {
        layer.timeRemapEnabled = true;
      }
      return layer.property("ADBE Time Remapping");
    }
    return null;
  }

  function handleKeyframesOnProperty(prop, keyframeMode) {
    // keyframeMode: "keep" | "clear_all" | "freeze_current"
    if (!prop || !prop.numKeys || prop.numKeys === 0 || keyframeMode === "keep") {
      return;
    }
    if (keyframeMode === "freeze_current") {
      var comp = prop.propertyGroup(prop.propertyDepth).containingComp;
      var currentTime = comp ? comp.time : 0;
      var currentVal = prop.valueAtTime(currentTime, true);
      while (prop.numKeys > 0) {
        prop.removeKey(prop.numKeys);
      }
      prop.setValue(currentVal);
    } else if (keyframeMode === "clear_all") {
      while (prop.numKeys > 0) {
        prop.removeKey(prop.numKeys);
      }
    }
  }

  function combineExpressionText(existingExpr, newExpr, applyMode) {
    // applyMode: "replace" | "append" | "prepend"
    var existing = existingExpr ? String(existingExpr).replace(/^\s+|\s+$/g, "") : "";
    if (!existing || applyMode === "replace") {
      return newExpr;
    }
    if (applyMode === "prepend") {
      return newExpr + "\n\n// --- Previous Expression ---\n" + existing;
    }
    if (applyMode === "append") {
      return existing + "\n\n// --- Appended Expression ---\n" + newExpr;
    }
    return newExpr;
  }

  /**
   * Apply Expression with rich options:
   * optionsJSON: {
   *   compId: number | null,
   *   targetMode: "selected_props" | "common_preset" | "specific_paths",
   *   commonPresetId: string,
   *   layerIndices: number[],
   *   specificTargets: Array<{ layerIndex: number, indices: number[] }>,
   *   expressionCode: string,
   *   applyMode: "replace" | "append" | "prepend",
   *   keyframeMode: "keep" | "clear_all" | "freeze_current",
   *   enableExpression: boolean
   * }
   */
  function applyExpressionWithOptions(optionsJSON) {
    app.beginUndoGroup("Apply Expression (AE Tiny Launcher)");
    try {
      var opts = parseJSON(optionsJSON);
      var comp = findComp(opts.compId);
      if (!comp) {
        return toJSON({ ok: false, error: "Active composition not found. Please open or select a composition." });
      }

      var targetProps = [];
      var i, lyr, p;

      if (opts.targetMode === "selected_props") {
        var selLayers = comp.selectedLayers;
        for (i = 0; i < selLayers.length; i++) {
          var sProps = selLayers[i].selectedProperties;
          for (p = 0; p < sProps.length; p++) {
            if (sProps[p].propertyType === PropertyType.PROPERTY && sProps[p].canSetExpression) {
              targetProps.push(sProps[p]);
            }
          }
        }
      } else if (opts.targetMode === "common_preset") {
        var indices = opts.layerIndices && opts.layerIndices.length > 0 ? opts.layerIndices : [];
        if (indices.length === 0) {
          for (i = 0; i < comp.selectedLayers.length; i++) {
            indices.push(comp.selectedLayers[i].index);
          }
        }
        for (i = 0; i < indices.length; i++) {
          lyr = comp.layer(Number(indices[i]));
          if (lyr) {
            var resolved = resolveCommonPresetProperty(lyr, opts.commonPresetId);
            if (resolved && resolved.canSetExpression) {
              targetProps.push(resolved);
            }
          }
        }
      } else if (opts.targetMode === "specific_paths") {
        var targets = opts.specificTargets || [];
        for (i = 0; i < targets.length; i++) {
          var t = targets[i];
          lyr = comp.layer(Number(t.layerIndex));
          if (lyr) {
            var sp = resolvePropertyByIndices(lyr, t.indices);
            if (sp && sp.canSetExpression) {
              targetProps.push(sp);
            }
          }
        }
      }

      if (targetProps.length === 0) {
        return toJSON({
          ok: false,
          error: "No valid target properties found. Select a property in the timeline or choose a target preset/layer."
        });
      }

      var appliedCount = 0;
      var errors = [];

      for (i = 0; i < targetProps.length; i++) {
        var prop = targetProps[i];
        try {
          handleKeyframesOnProperty(prop, opts.keyframeMode || "keep");
          var finalExpr = combineExpressionText(prop.expression, opts.expressionCode, opts.applyMode || "replace");
          prop.expression = finalExpr;
          prop.expressionEnabled = opts.enableExpression !== false;
          appliedCount++;
        } catch (propErr) {
          errors.push(prop.name + ": " + propErr.toString());
        }
      }

      return toJSON({
        ok: appliedCount > 0,
        appliedCount: appliedCount,
        errors: errors,
        message: "Applied expression to " + appliedCount + " property(s)."
      });
    } catch (e) {
      return toJSON({ ok: false, error: e.toString() });
    } finally {
      app.endUndoGroup();
    }
  }

  /**
   * Apply FFX Preset with rich options:
   * optionsJSON: {
   *   compId: number | null,
   *   ffxPath: string,
   *   targetLayerMode: "selected_layers" | "checked_layers" | "new_adjustment" | "new_solid" | "new_null",
   *   layerIndices: number[],
   *   timeMode: "current_time" | "layer_in_point" | "comp_start",
   *   clearExistingEffects: boolean,
   *   keyframeMode: "keep" | "clear_transform_keys"
   * }
   */
  function applyFFXWithOptions(optionsJSON) {
    app.beginUndoGroup("Apply FFX Preset (AE Tiny Launcher)");
    try {
      var opts = parseJSON(optionsJSON);
      var ffxFile = new File(opts.ffxPath);
      if (!ffxFile.exists) {
        return toJSON({ ok: false, error: "FFX preset file not found: " + opts.ffxPath });
      }

      var comp = findComp(opts.compId);
      if (!comp) {
        return toJSON({ ok: false, error: "Target composition not found. Please open or select a composition." });
      }

      var targetLayers = [];
      var i, lyr;

      if (opts.targetLayerMode === "new_adjustment") {
        var adj = comp.layers.addSolid([1, 1, 1], "Adjustment Layer (FFX)", comp.width, comp.height, comp.pixelAspect, comp.duration);
        adj.adjustmentLayer = true;
        targetLayers.push(adj);
      } else if (opts.targetLayerMode === "new_solid") {
        var solid = comp.layers.addSolid([0.15, 0.15, 0.18], "Solid Layer (FFX)", comp.width, comp.height, comp.pixelAspect, comp.duration);
        targetLayers.push(solid);
      } else if (opts.targetLayerMode === "new_null") {
        var nul = comp.layers.addNull(comp.duration);
        nul.name = "Null (FFX)";
        targetLayers.push(nul);
      } else if (opts.targetLayerMode === "checked_layers" && opts.layerIndices && opts.layerIndices.length > 0) {
        for (i = 0; i < opts.layerIndices.length; i++) {
          lyr = comp.layer(Number(opts.layerIndices[i]));
          if (lyr) targetLayers.push(lyr);
        }
      } else {
        // default to selected_layers
        for (i = 0; i < comp.selectedLayers.length; i++) {
          targetLayers.push(comp.selectedLayers[i]);
        }
      }

      if (targetLayers.length === 0) {
        return toJSON({
          ok: false,
          error: "No target layers selected. Select one or more layers or choose 'New Adjustment Layer'."
        });
      }

      var originalTime = comp.time;
      var originalSelection = [];
      for (i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).selected) {
          originalSelection.push(comp.layer(i));
        }
        comp.layer(i).selected = false;
      }

      var appliedCount = 0;
      for (i = 0; i < targetLayers.length; i++) {
        lyr = targetLayers[i];

        if (opts.clearExistingEffects) {
          var fxGroup = lyr.property("ADBE Effect Parade");
          if (fxGroup) {
            while (fxGroup.numProperties > 0) {
              fxGroup.property(1).remove();
            }
          }
        }

        if (opts.keyframeMode === "clear_transform_keys") {
          var tr = lyr.property("ADBE Transform Group");
          if (tr) {
            for (var tp = 1; tp <= tr.numProperties; tp++) {
              var subProp = tr.property(tp);
              if (subProp && subProp.numKeys) {
                while (subProp.numKeys > 0) {
                  subProp.removeKey(subProp.numKeys);
                }
              }
            }
          }
        }

        if (opts.timeMode === "layer_in_point") {
          comp.time = lyr.inPoint;
        } else if (opts.timeMode === "comp_start") {
          comp.time = 0;
        } else {
          comp.time = originalTime;
        }

        // layer.applyPreset applies to the selected layer(s)
        for (var j = 1; j <= comp.numLayers; j++) {
          comp.layer(j).selected = false;
        }
        lyr.selected = true;
        lyr.applyPreset(ffxFile);
        appliedCount++;
      }

      // Restore playhead and selection
      comp.time = originalTime;
      for (i = 1; i <= comp.numLayers; i++) {
        comp.layer(i).selected = false;
      }
      for (i = 0; i < targetLayers.length; i++) {
        targetLayers[i].selected = true;
      }

      return toJSON({
        ok: true,
        appliedCount: appliedCount,
        message: "Applied FFX preset to " + appliedCount + " layer(s)."
      });
    } catch (e) {
      return toJSON({ ok: false, error: e.toString() });
    } finally {
      app.endUndoGroup();
    }
  }

  return {
    runScriptFile: runScriptFile,
    getContextSnapshot: getContextSnapshot,
    getLayerProperties: getLayerProperties,
    applyExpressionWithOptions: applyExpressionWithOptions,
    applyFFXWithOptions: applyFFXWithOptions
  };
})();
