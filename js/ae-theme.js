/**
 * AE Tiny Scripts Launcher - After Effects Native Theme Engine (js/ae-theme.js)
 * Reads CEP HostEnvironment appSkinInfo and dynamically generates CSS custom properties
 * that conform to After Effects' native panel UI across the full Brightness slider range
 * (darkest, standard dark, mid-gray, and light modes).
 */

(function (global) {
  function clampByte(n) {
    return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
  }

  function toRgb(c) {
    return "rgb(" + clampByte(c.red) + ", " + clampByte(c.green) + ", " + clampByte(c.blue) + ")";
  }

  function toRgba(c, alpha) {
    return "rgba(" + clampByte(c.red) + ", " + clampByte(c.green) + ", " + clampByte(c.blue) + ", " + alpha + ")";
  }

  function shiftColor(c, delta) {
    return {
      red: clampByte(c.red + delta),
      green: clampByte(c.green + delta),
      blue: clampByte(c.blue + delta)
    };
  }

  function getLuminance(c) {
    return 0.2126 * clampByte(c.red) + 0.7152 * clampByte(c.green) + 0.0722 * clampByte(c.blue);
  }

  function computeThemeTokens(appSkinInfo) {
    var skin = appSkinInfo || {};
    var panelBg =
      skin.panelBackgroundColor && skin.panelBackgroundColor.color
        ? skin.panelBackgroundColor.color
        : { red: 35, green: 35, blue: 35 };

    var lum = getLuminance(panelBg);
    var isLight = lum > 128;

    // Preserve host appBarBackgroundColor when available, otherwise derive subtle panel chrome
    var appBarBg =
      skin.appBarBackgroundColor && skin.appBarBackgroundColor.color
        ? skin.appBarBackgroundColor.color
        : shiftColor(panelBg, isLight ? -8 : -5);

    var highlight =
      skin.systemHighlightColor && skin.systemHighlightColor.color
        ? skin.systemHighlightColor.color
        : { red: 45, green: 140, blue: 235 };

    var accentHover = shiftColor(highlight, isLight ? -16 : 18);

    // Subtle luminance-aware surfaces that never clash at any AE Brightness slider position
    var surface = appBarBg;
    var cardBg = shiftColor(panelBg, isLight ? -6 : 6);
    var elevated = shiftColor(panelBg, isLight ? -14 : 12);
    var hover = shiftColor(panelBg, isLight ? -22 : 20);
    var inputBg = shiftColor(panelBg, isLight ? 18 : -10);
    var border = shiftColor(panelBg, isLight ? -36 : 26);
    var borderSubtle = shiftColor(panelBg, isLight ? -22 : 14);

    // Ensure strong readable text contrast even on mid-gray AE brightness settings
    var textPrimary = isLight ? "#1b1b1b" : lum > 85 ? "#ebebeb" : "#d8d8d8";
    var textSecondary = isLight ? "#444444" : lum > 85 ? "#c2c2c2" : "#a0a0a0";
    var textMuted = isLight ? "#666666" : lum > 85 ? "#9e9e9e" : "#767676";

    var tokens = {
      isLight: isLight,
      luminance: Math.round(lum),
      "--bg-app": toRgb(panelBg),
      "--bg-surface": toRgb(surface),
      "--bg-card": toRgb(cardBg),
      "--bg-elevated": toRgb(elevated),
      "--bg-hover": toRgb(hover),
      "--bg-input": toRgb(inputBg),
      "--border-color": toRgb(border),
      "--border-subtle": toRgb(borderSubtle),
      "--text-primary": textPrimary,
      "--text-secondary": textSecondary,
      "--text-muted": textMuted,
      "--accent": toRgb(highlight),
      "--accent-hover": toRgb(accentHover),
      "--accent-soft": toRgba(highlight, isLight ? 0.14 : 0.18),
      "--scrollbar-track": "transparent",
      "--scrollbar-thumb": isLight ? "rgba(0, 0, 0, 0.22)" : "rgba(255, 255, 255, 0.16)",
      "--scrollbar-thumb-hover": isLight ? "rgba(0, 0, 0, 0.38)" : "rgba(255, 255, 255, 0.32)",
      "--scrollbar-thumb-active": toRgb(highlight),
      "--modal-backdrop": isLight ? "rgba(0, 0, 0, 0.28)" : "rgba(0, 0, 0, 0.45)"
    };

    if (skin.baseFontFamily) {
      tokens["--font-family"] = skin.baseFontFamily + ', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }
    if (skin.baseFontSize && Number(skin.baseFontSize) >= 9 && Number(skin.baseFontSize) <= 16) {
      tokens["--font-size-base"] = Number(skin.baseFontSize) + "px";
    }

    return tokens;
  }

  function apply(csInterface) {
    if (typeof document === "undefined") return null;
    try {
      var env = csInterface && typeof csInterface.getHostEnvironment === "function" ? csInterface.getHostEnvironment() : null;
      var tokens = computeThemeTokens(env && env.appSkinInfo);

      if (tokens.isLight) {
        document.body.classList.remove("theme-dark");
        document.body.classList.add("theme-light");
      } else {
        document.body.classList.remove("theme-light");
        document.body.classList.add("theme-dark");
      }

      var rootStyle = document.documentElement.style;
      Object.keys(tokens).forEach(function (k) {
        if (k.indexOf("--") === 0) {
          rootStyle.setProperty(k, tokens[k]);
        }
      });
      return tokens;
    } catch (e) {
      return null;
    }
  }

  function init(csInterface) {
    apply(csInterface);
    if (csInterface && typeof csInterface.addEventListener === "function" && global.CSInterface) {
      csInterface.addEventListener(global.CSInterface.THEME_COLOR_CHANGED_EVENT, function () {
        apply(csInterface);
      });
    }
  }

  global.AETheme = {
    computeThemeTokens: computeThemeTokens,
    apply: apply,
    init: init
  };
})(typeof window !== "undefined" ? window : global);
