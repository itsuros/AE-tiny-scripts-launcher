#!/usr/bin/env node
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var VERSION_JSON_PATH = path.join(ROOT, "version.json");
var VERSION_JS_PATH = path.join(ROOT, "js", "version.js");

function readMeta() {
  return JSON.parse(fs.readFileSync(VERSION_JSON_PATH, "utf8"));
}

function writeMeta(meta) {
  fs.writeFileSync(VERSION_JSON_PATH, JSON.stringify(meta, null, 2) + "\n", "utf8");

  var jsContent = fs.readFileSync(VERSION_JS_PATH, "utf8");
  jsContent = jsContent
    .replace(/(var meta = \{\s*version:\s*)"[^"]*"/, '$1"' + meta.version + '"')
    .replace(/(channel:\s*)"[^"]*"/, '$1"' + meta.channel + '"')
    .replace(/(revision:\s*)\d+/, "$1" + meta.revision);
  fs.writeFileSync(VERSION_JS_PATH, jsContent, "utf8");
}

function main() {
  var args = process.argv.slice(2);
  var meta = readMeta();

  if (args.indexOf("--print") >= 0) {
    console.log(JSON.stringify(meta));
    return;
  }

  var channelIdx = args.indexOf("--channel");
  if (channelIdx >= 0 && args[channelIdx + 1]) {
    var ch = args[channelIdx + 1].trim();
    if (ch !== "develop" && ch !== "production") {
      console.error("Invalid channel: " + ch + " (must be 'develop' or 'production')");
      process.exit(1);
    }
    meta.channel = ch;
    writeMeta(meta);
    console.log("Updated channel to:", meta.channel, "(version:", meta.version, "revision:", meta.revision + ")");
    return;
  }

  var verIdx = args.indexOf("--set-version");
  if (verIdx >= 0 && args[verIdx + 1]) {
    meta.version = args[verIdx + 1].trim();
    writeMeta(meta);
    console.log("Updated version to:", meta.version);
    return;
  }

  if (meta.channel === "develop" || args.indexOf("--force") >= 0) {
    meta.revision = (parseInt(meta.revision, 10) || 0) + 1;
    writeMeta(meta);
    console.log("Bumped develop revision to:", meta.revision, "(" + meta.version + "-dev." + meta.revision + ")");
  } else {
    console.log("Channel is production; skipping revision bump.");
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  readMeta: readMeta,
  writeMeta: writeMeta
};
