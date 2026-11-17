/**
 * CSInterface - v11.0.0 compatible wrapper for Adobe CEP
 * Based on https://github.com/Adobe-CEP/CEP-Resources
 * Includes safe fallback for standalone browser preview/testing when __adobe_cep__ is absent.
 */

var SystemPath = {
  USER_DATA: "userData",
  COMMON_FILES: "commonFiles",
  MY_DOCUMENTS: "myDocuments",
  APPLICATION: "application",
  EXTENSION: "extension",
  HOST_APPLICATION: "hostApplication"
};

var CSEvent = function (type, scope, appId, extensionId) {
  this.type = type;
  this.scope = scope || "APPLICATION";
  this.appId = appId || "AEFT";
  this.extensionId = extensionId || "com.ae.tinyscripts.launcher.panel";
  this.data = "";
};

var CSInterface = function () {};

CSInterface.THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";

CSInterface.prototype.isCEPEnvironment = function () {
  return typeof window !== "undefined" && typeof window.__adobe_cep__ !== "undefined";
};

CSInterface.prototype.evalScript = function (script, callback) {
  if (callback === null || callback === undefined) {
    callback = function () {};
  }
  if (this.isCEPEnvironment()) {
    window.__adobe_cep__.evalScript(script, callback);
  } else {
    // Fallback mock for browser testing outside After Effects
    if (typeof window.__mockEvalScript === "function") {
      window.__mockEvalScript(script, callback);
    } else {
      setTimeout(function () {
        callback(JSON.stringify({ ok: true, mock: true, message: "Executed in mock environment" }));
      }, 30);
    }
  }
};

CSInterface.prototype.getSystemPath = function (pathType) {
  if (this.isCEPEnvironment()) {
    var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    var OSVersion = this.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0) {
      path = path.replace("file:///", "");
    } else if (OSVersion.indexOf("Mac") >= 0) {
      path = path.replace("file://", "");
    }
    return path;
  }
  // Node fallback if running in Electron/NW or dev
  if (typeof process !== "undefined" && process.cwd) {
    return process.cwd();
  }
  return "/tmp/ae-tiny-scripts-launcher";
};

CSInterface.prototype.getHostEnvironment = function () {
  if (this.isCEPEnvironment()) {
    return JSON.parse(window.__adobe_cep__.getHostEnvironment());
  }
  return {
    appName: "AEFT",
    appVersion: "24.0.0",
    appLocale: "ja_JP",
    appSkinInfo: {
      panelBackgroundColor: {
        color: { red: 35, green: 35, blue: 35, alpha: 255 }
      },
      baseFontFamily: "system-ui",
      baseFontSize: 11
    }
  };
};

CSInterface.prototype.getOSInformation = function () {
  if (this.isCEPEnvironment()) {
    return window.__adobe_cep__.getOSInformation();
  }
  return navigator.platform || "Mac OS X";
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
  if (this.isCEPEnvironment()) {
    window.__adobe_cep__.addEventListener(type, listener, obj);
  } else {
    window.addEventListener(type, listener);
  }
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
  if (this.isCEPEnvironment()) {
    window.__adobe_cep__.removeEventListener(type, listener, obj);
  } else {
    window.removeEventListener(type, listener);
  }
};

CSInterface.prototype.dispatchEvent = function (event) {
  if (this.isCEPEnvironment()) {
    if (typeof event.data === "object") {
      event.data = JSON.stringify(event.data);
    }
    window.__adobe_cep__.dispatchEvent(event);
  }
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
  if (this.isCEPEnvironment() && typeof cep !== "undefined" && cep.util) {
    cep.util.openURLInDefaultBrowser(url);
  } else {
    window.open(url, "_blank");
  }
};

CSInterface.prototype.getExtensionID = function () {
  if (this.isCEPEnvironment()) {
    return window.__adobe_cep__.getExtensionId();
  }
  return "com.ae.tinyscripts.launcher.panel";
};
