#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var os = require("os");
var vm = require("vm");

var ROOT = path.resolve(__dirname, "..");
var testsQueue = [];

function test(name, fn) {
  testsQueue.push({ name: name, fn: fn });
}

async function runAllTests() {
  var passed = 0;
  var failed = 0;
  for (var i = 0; i < testsQueue.length; i++) {
    var t = testsQueue[i];
    try {
      await Promise.resolve(t.fn());
      console.log("PASS:", t.name);
      passed++;
    } catch (err) {
      console.error("FAIL:", t.name, "\n ", err.stack || err.message);
      failed++;
    }
  }
  console.log("\nSummary: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) {
    process.exit(1);
  }
}

// Load modules in global context
require(path.join(ROOT, "js/version.js"));
require(path.join(ROOT, "js/icon-resolver.js"));
require(path.join(ROOT, "js/store.js"));
require(path.join(ROOT, "js/local-sync.js"));
require(path.join(ROOT, "js/github-sync.js"));
require(path.join(ROOT, "js/updater.js"));

test("Version 0.0.0 consistency across package.json, manifest.xml, and updater.js", function () {
  var pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.strictEqual(pkg.version, "0.0.0");
  assert.strictEqual(pkg.license, "MIT");

  var manifest = fs.readFileSync(path.join(ROOT, "CSXS/manifest.xml"), "utf8");
  assert.ok(manifest.indexOf('ExtensionBundleVersion="0.0.0"') >= 0, "manifest bundle version must be 0.0.0");
  assert.ok(manifest.indexOf('Version="0.0.0"') >= 0, "manifest extension version must be 0.0.0");
  assert.ok(manifest.indexOf('<Host Name="AEFT"') >= 0, "manifest must target AEFT");
  assert.ok(manifest.indexOf("<Parameter>--enable-nodejs</Parameter>") >= 0, "manifest must enable Node.js");
  assert.ok(manifest.indexOf("com.ae.tinyscripts.launcher.targetpicker") >= 0, "manifest must declare external targetpicker");
  assert.ok(manifest.indexOf("com.ae.tinyscripts.launcher.help") >= 0, "manifest must declare external help window");
  assert.ok(manifest.indexOf("<Type>Modeless</Type>") >= 0, "external windows must use Modeless window");
  assert.ok(manifest.indexOf("<MainPath>./target-picker.html</MainPath>") >= 0, "targetpicker MainPath missing");
  assert.ok(manifest.indexOf("<MainPath>./help.html</MainPath>") >= 0, "help MainPath missing");

  assert.strictEqual(global.LauncherUpdater.CURRENT_VERSION, "0.0.0");

  var verJson = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8"));
  assert.strictEqual(verJson.version, "0.0.0");
  assert.ok(verJson.channel === "develop" || verJson.channel === "production");
  assert.ok(typeof verJson.revision === "number" && verJson.revision >= 1);
  assert.strictEqual(global.AppVersion.version, verJson.version);
  assert.strictEqual(global.AppVersion.channel, verJson.channel);
  assert.strictEqual(global.AppVersion.revision, verJson.revision);
});

test("LICENSE is MIT", function () {
  var lic = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  assert.ok(lic.indexOf("MIT License") >= 0);
});

test("index.html, target-picker.html, and help.html reference required assets and UI controls", function () {
  var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  [
    "css/styles.css",
    "js/lib/CSInterface.js",
    "js/version.js",
    "js/icon-resolver.js",
    "js/store.js",
    "js/local-sync.js",
    "js/github-sync.js",
    "js/updater.js",
    "js/target-picker.js",
    "js/app.js"
  ].forEach(function (rel) {
    assert.ok(html.indexOf(rel) >= 0, "Missing reference in index.html: " + rel);
    assert.ok(fs.existsSync(path.join(ROOT, rel)), "Referenced file missing on disk: " + rel);
  });

  ["btn-toggle-search", "btn-reset-card-scale", "btn-cfg-reset-card-scale", "btn-open-help", "version-icon"].forEach(
    function (idOrClass) {
      assert.ok(html.indexOf(idOrClass) >= 0, "Missing UI control in index.html: " + idOrClass);
    }
  );

  var pickerHtml = fs.readFileSync(path.join(ROOT, "target-picker.html"), "utf8");
  ["css/styles.css", "js/lib/CSInterface.js", "js/version.js", "js/store.js", "js/target-picker.js"].forEach(function (rel) {
    assert.ok(pickerHtml.indexOf(rel) >= 0, "Missing reference in target-picker.html: " + rel);
  });

  var helpHtml = fs.readFileSync(path.join(ROOT, "help.html"), "utf8");
  ["css/styles.css", "js/lib/CSInterface.js", "js/version.js"].forEach(function (rel) {
    assert.ok(helpHtml.indexOf(rel) >= 0, "Missing reference in help.html: " + rel);
  });
});

test("macOS and Windows dev setup scripts exist and reference bundle ID", function () {
  var sh = fs.readFileSync(path.join(ROOT, "scripts/install-dev.sh"), "utf8");
  var ps1 = fs.readFileSync(path.join(ROOT, "scripts/install-dev.ps1"), "utf8");
  var bat = fs.readFileSync(path.join(ROOT, "scripts/install-dev.bat"), "utf8");

  assert.ok(sh.indexOf("com.ae.tinyscripts.launcher") >= 0);
  assert.ok(sh.indexOf("--uninstall") >= 0);
  assert.ok(ps1.indexOf("com.ae.tinyscripts.launcher") >= 0);
  assert.ok(ps1.indexOf("-Uninstall") >= 0);
  assert.ok(ps1.indexOf("PlayerDebugMode") >= 0);
  assert.ok(ps1.indexOf("Junction") >= 0);
  assert.ok(bat.indexOf("install-dev.ps1") >= 0);
});

test("JS and ExtendScript files parse cleanly without syntax errors", function () {
  var files = [
    "js/lib/CSInterface.js",
    "js/version.js",
    "js/icon-resolver.js",
    "js/store.js",
    "js/local-sync.js",
    "js/github-sync.js",
    "js/updater.js",
    "js/target-picker.js",
    "js/app.js",
    "scripts/bump-revision.js",
    "jsx/hostscript.jsx"
  ];
  files.forEach(function (rel) {
    var code = fs.readFileSync(path.join(ROOT, rel), "utf8");
    new vm.Script(code, { filename: rel });
  });
});

test("LauncherStore CRUD, custom ordering, and persistence", function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ae-launcher-test-"));
  try {
    var store = new global.LauncherStore({ dataDir: tmpDir });
    var initialCount = store.state.items.length;
    assert.ok(initialCount >= 5, "Should include default starter items");

    var added = store.addItem({
      name: "Test Custom Script",
      type: "script",
      code: "alert('hi');",
      tags: ["test"]
    });
    assert.strictEqual(store.state.items.length, initialCount + 1);
    assert.strictEqual(added.order, initialCount);

    store.updateItem(added.id, { name: "Renamed Script" });
    var found = store.state.items.find(function (i) {
      return i.id === added.id;
    });
    assert.strictEqual(found.name, "Renamed Script");

    // Shift earlier
    store.shiftItemOrder(added.id, -1);
    assert.strictEqual(found.order, initialCount - 1);

    // Move to first position
    var firstId = store.state.items[0].id;
    store.moveItem(added.id, firstId, "before");
    assert.strictEqual(store.state.items[0].id, added.id);

    // Reload from disk and verify persistence
    var reloaded = new global.LauncherStore({ dataDir: tmpDir });
    assert.strictEqual(reloaded.state.items[0].id, added.id);
    assert.strictEqual(reloaded.state.items[0].name, "Renamed Script");

    // Pending target request round-trip
    var savedReq = reloaded.savePendingTargetRequest({ id: "x1", name: "Wiggle", type: "expression" });
    var loadedReq = reloaded.loadPendingTargetRequest();
    assert.strictEqual(loadedReq.requestId, savedReq.requestId);
    assert.strictEqual(loadedReq.item.name, "Wiggle");

    // Delete item
    assert.strictEqual(reloaded.deleteItem(added.id), true);
    assert.strictEqual(reloaded.state.items.length, initialCount);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("LauncherStore GitHub merge preserves manual items and prunes when requested", function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ae-launcher-gh-"));
  try {
    var store = new global.LauncherStore({ dataDir: tmpDir });
    var manualCount = store.state.items.length;

    var res1 = store.mergeGitHubItems(
      [
        { name: "Auto Rig", type: "script", remotePath: "scripts/auto-rig.jsx", sha: "111" },
        { name: "Bounce", type: "expression", remotePath: "expr/bounce.expr.js", sha: "222" }
      ],
      false
    );
    assert.strictEqual(res1.added, 2);
    assert.strictEqual(store.state.items.length, manualCount + 2);

    var res2 = store.mergeGitHubItems(
      [{ name: "Auto Rig v2", type: "script", remotePath: "scripts/auto-rig.jsx", sha: "333" }],
      true
    );
    assert.strictEqual(res2.updated, 1);
    assert.strictEqual(res2.removed, 1);
    assert.strictEqual(store.state.items.length, manualCount + 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("GitHubSync parses repo inputs and detects Script/Expression/FFX types", function () {
  assert.deepStrictEqual(global.GitHubSync.parseRepoInput("alice/ae-tools"), { owner: "alice", repo: "ae-tools" });
  assert.deepStrictEqual(global.GitHubSync.parseRepoInput("https://github.com/alice/ae-tools.git"), {
    owner: "alice",
    repo: "ae-tools"
  });

  assert.strictEqual(global.GitHubSync.detectItemTypeFromFilename("folder/my_tool.jsx"), "script");
  assert.strictEqual(global.GitHubSync.detectItemTypeFromFilename("folder/my_tool.jsxbin"), "script");
  assert.strictEqual(global.GitHubSync.detectItemTypeFromFilename("expr/wiggle.expr.js"), "expression");
  assert.strictEqual(global.GitHubSync.detectItemTypeFromFilename("expr/wiggle.expr"), "expression");
  assert.strictEqual(global.GitHubSync.detectItemTypeFromFilename("presets/glow.ffx"), "ffx");
  assert.strictEqual(global.GitHubSync.detectItemTypeFromFilename("README.md"), null);

  assert.strictEqual(global.GitHubSync.cleanDisplayName("smooth_wiggle.expr.js"), "smooth wiggle");
});

test("LauncherUpdater compares semantic versions accurately", function () {
  assert.strictEqual(global.LauncherUpdater.compareSemver("0.0.1", "0.0.0"), 1);
  assert.strictEqual(global.LauncherUpdater.compareSemver("v0.1.0", "0.0.9"), 1);
  assert.strictEqual(global.LauncherUpdater.compareSemver("1.0.0", "0.9.9"), 1);
  assert.strictEqual(global.LauncherUpdater.compareSemver("v0.0.0", "0.0.0"), 0);
  assert.strictEqual(global.LauncherUpdater.compareSemver("0.0.0", "0.0.1"), -1);
});

test("AppVersion formats develop (with revision) and production channels distinctly", function () {
  var origChannel = global.AppVersion.channel;
  var origRev = global.AppVersion.revision;
  try {
    global.AppVersion.channel = "develop";
    global.AppVersion.revision = 42;
    assert.strictEqual(global.AppVersion.isDevelop(), true);
    assert.strictEqual(global.AppVersion.getDisplayBadge(), "DEV v0.0.0 (rev.42)");
    assert.strictEqual(global.AppVersion.getShortBadge(), "DEV r42");

    global.AppVersion.channel = "production";
    assert.strictEqual(global.AppVersion.isProduction(), true);
    assert.strictEqual(global.AppVersion.getDisplayBadge(), "v0.0.0");
    assert.strictEqual(global.AppVersion.getShortBadge(), "PROD");
  } finally {
    global.AppVersion.channel = origChannel;
    global.AppVersion.revision = origRev;
  }
});

test("IconResolver finds sibling image files and GitHub tree matches", function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ae-launcher-icon-"));
  try {
    var scriptA = path.join(tmpDir, "center_anchor.jsx");
    var iconA = path.join(tmpDir, "center_anchor.png");
    var exprB = path.join(tmpDir, "wiggle.expr.js");
    var iconB = path.join(tmpDir, "wiggle.svg");
    var ffxC = path.join(tmpDir, "glow.ffx");

    fs.writeFileSync(scriptA, "// a", "utf8");
    fs.writeFileSync(iconA, "png", "utf8");
    fs.writeFileSync(exprB, "wiggle(2,10);", "utf8");
    fs.writeFileSync(iconB, "<svg/>", "utf8");
    fs.writeFileSync(ffxC, "ffx", "utf8");

    assert.strictEqual(global.IconResolver.findSiblingImageFile(scriptA), iconA);
    assert.strictEqual(global.IconResolver.findSiblingImageFile(exprB), iconB);
    assert.strictEqual(global.IconResolver.findSiblingImageFile(ffxC), "");
    assert.ok(global.IconResolver.toFileUrl(iconA).indexOf("file://") === 0);

    var treeMatch = global.IconResolver.findMatchingSiblingEntry(
      ["scripts/a.jsx", "scripts/a.png", "other/b.png"],
      "scripts/a.jsx"
    );
    assert.strictEqual(treeMatch, "scripts/a.png");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("LocalSync scans multiple configured local folders and resolves sibling icons", function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ae-launcher-local-"));
  var dir1 = path.join(tmpDir, "folder1");
  var dir2 = path.join(tmpDir, "folder2");
  var sub2 = path.join(dir2, "sub");
  var dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dir1, { recursive: true });
  fs.mkdirSync(sub2, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(dir1, "tool_one.jsx"), "alert(1);", "utf8");
  fs.writeFileSync(path.join(dir1, "tool_one.png"), "fake-png", "utf8");
  fs.writeFileSync(path.join(sub2, "bounce.expr.txt"), "loopOut();", "utf8");
  fs.writeFileSync(path.join(sub2, "preset.ffx"), "ffx", "utf8");

  var store = new global.LauncherStore({ dataDir: dataDir });
  store.updateSettings({
    cardScale: 65,
    localFolders: { paths: [dir1, dir2], autoScanOnLaunch: true, pruneMissing: true }
  });

  return global.LocalSync.scanLocalFolders(store)
    .then(function (summary) {
      assert.strictEqual(summary.added, 3);
      assert.strictEqual(summary.scannedFolderCount, 2);

      var toolOne = store.state.items.find(function (it) {
        return it.name === "tool one";
      });
      assert.ok(toolOne, "tool_one.jsx should be registered");
      assert.strictEqual(toolOne.source, "local");
      assert.strictEqual(toolOne.customIconPath, path.join(dir1, "tool_one.png"));

      var bounceExpr = store.state.items.find(function (it) {
        return it.name === "bounce" && it.type === "expression";
      });
      assert.ok(bounceExpr, "bounce.expr.txt should be registered as expression");
      assert.strictEqual(bounceExpr.code, "loopOut();");
      assert.strictEqual(store.state.settings.cardScale, 65);
    })
    .finally(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});

runAllTests();
