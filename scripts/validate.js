#!/usr/bin/env node
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var os = require("os");
var vm = require("vm");

var ROOT = path.resolve(__dirname, "..");
var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("PASS:", name);
    passed++;
  } catch (err) {
    console.error("FAIL:", name, "\n ", err.stack || err.message);
    failed++;
  }
}

// Load modules in global context
require(path.join(ROOT, "js/store.js"));
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

  assert.strictEqual(global.LauncherUpdater.CURRENT_VERSION, "0.0.0");
});

test("LICENSE is MIT", function () {
  var lic = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  assert.ok(lic.indexOf("MIT License") >= 0);
});

test("index.html references all required scripts and stylesheet", function () {
  var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ["css/styles.css", "js/lib/CSInterface.js", "js/store.js", "js/github-sync.js", "js/updater.js", "js/app.js"].forEach(
    function (rel) {
      assert.ok(html.indexOf(rel) >= 0, "Missing reference in index.html: " + rel);
      assert.ok(fs.existsSync(path.join(ROOT, rel)), "Referenced file missing on disk: " + rel);
    }
  );
});

test("macOS and Windows dev setup scripts exist and reference bundle ID", function () {
  var sh = fs.readFileSync(path.join(ROOT, "scripts/install-dev.sh"), "utf8");
  var ps1 = fs.readFileSync(path.join(ROOT, "scripts/install-dev.ps1"), "utf8");
  var bat = fs.readFileSync(path.join(ROOT, "scripts/install-dev.bat"), "utf8");

  assert.ok(sh.indexOf("com.ae.tinyscripts.launcher") >= 0);
  assert.ok(ps1.indexOf("com.ae.tinyscripts.launcher") >= 0);
  assert.ok(ps1.indexOf("PlayerDebugMode") >= 0);
  assert.ok(ps1.indexOf("Junction") >= 0);
  assert.ok(bat.indexOf("install-dev.ps1") >= 0);
});

test("JS and ExtendScript files parse cleanly without syntax errors", function () {
  var files = [
    "js/lib/CSInterface.js",
    "js/store.js",
    "js/github-sync.js",
    "js/updater.js",
    "js/app.js",
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

console.log("\nSummary: " + passed + " passed, " + failed + " failed.");
if (failed > 0) {
  process.exit(1);
}
