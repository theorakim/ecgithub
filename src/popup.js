/**
 * ECGithub Popup Script
 * Manages settings UI and persists to chrome.storage.sync
 */
(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    theme: 'github-green',
    customColors: null,
    animation: true,
    showStats: true,
    dataUnit: 'weekly',
    viewMode: 'ecg',
    enabled: true,
  };

  // ── DOM References ─────────────────────────────────────────────
  const enabledToggle = document.getElementById('enabledToggle');
  const themeGrid = document.getElementById('themeGrid');
  const customColorInput = document.getElementById('customColor');
  const applyCustomBtn = document.getElementById('applyCustomColor');
  const clearCustomBtn = document.getElementById('clearCustomColor');
  const animationToggle = document.getElementById('animationToggle');
  const statsToggle = document.getElementById('statsToggle');

  // ── Load Settings ──────────────────────────────────────────────
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    // Theme selection
    const themeButtons = themeGrid.querySelectorAll('.theme-btn');
    themeButtons.forEach((btn) => {
      if (btn.dataset.theme === settings.theme && !settings.customColors) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // Custom color
    if (settings.customColors) {
      customColorInput.value = settings.customColors[4] || '#40c463';
      // Deactivate all theme buttons
      themeButtons.forEach((btn) => btn.classList.remove('is-active'));
    }

    // Toggles
    enabledToggle.checked = settings.enabled !== false;
    animationToggle.checked = settings.animation;
    statsToggle.checked = settings.showStats;

    // Dim settings when disabled
    updateDisabledState(enabledToggle.checked);
  });

  // ── Theme Selection ────────────────────────────────────────────
  const COLOR_THEMES = {
    'github-green': ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    blue: ['#ebedf0', '#9ecae1', '#4292c6', '#2171b5', '#084594'],
    purple: ['#ebedf0', '#b4a7d6', '#8e7cc3', '#674ea7', '#351c75'],
    sunset: ['#ebedf0', '#fdd49e', '#fdbb84', '#fc8d59', '#d7301f'],
    halloween: ['#ebedf0', '#ffee4a', '#ffc501', '#fe9600', '#03001c'],
  };

  themeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-btn');
    if (!btn) return;

    const theme = btn.dataset.theme;

    // Update active state
    themeGrid.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    // Save
    chrome.storage.sync.set({
      theme,
      customColors: null,
    });
  });

  // ── Custom Color ───────────────────────────────────────────────
  applyCustomBtn.addEventListener('click', () => {
    const color = customColorInput.value;
    // Generate a 5-color palette from the chosen color
    const palette = generatePalette(color);

    // Deactivate theme buttons
    themeGrid.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('is-active'));

    chrome.storage.sync.set({
      customColors: palette,
      theme: 'custom',
    });
  });

  clearCustomBtn.addEventListener('click', () => {
    chrome.storage.sync.set({ customColors: null, theme: 'github-green' });
    // Re-activate GitHub Green
    const greenBtn = themeGrid.querySelector('[data-theme="github-green"]');
    themeGrid.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('is-active'));
    if (greenBtn) greenBtn.classList.add('is-active');
  });

  function generatePalette(hexColor) {
    // Convert hex to HSL, then create 5 shades from light to dark
    const rgb = hexToRgb(hexColor);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    return [
      '#ebedf0', // level 0 always neutral
      hslToHex(hsl.h, Math.max(hsl.s * 0.6, 0.15), Math.min(hsl.l + 0.25, 0.85)),
      hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 0.1, 0.7)),
      hslToHex(hsl.h, Math.min(hsl.s + 0.1, 1), hsl.l),
      hslToHex(hsl.h, Math.min(hsl.s + 0.15, 1), Math.max(hsl.l - 0.15, 0.15)),
    ];
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (x) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  // ── Enabled Toggle ────────────────────────────────────────────
  enabledToggle.addEventListener('change', () => {
    const on = enabledToggle.checked;
    chrome.storage.sync.set({ enabled: on });
    updateDisabledState(on);
  });

  function updateDisabledState(on) {
    // Dim all settings sections when extension is off
    const sections = document.querySelectorAll('.popup-section');
    sections.forEach((s) => {
      s.style.opacity = on ? '' : '0.4';
      s.style.pointerEvents = on ? '' : 'none';
    });
  }

  // ── Toggles ────────────────────────────────────────────────────
  animationToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ animation: animationToggle.checked });
  });

  statsToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showStats: statsToggle.checked });
  });

})();
