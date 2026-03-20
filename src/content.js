/**
 * ECGithub Content Script
 * Detects GitHub profile pages and replaces contribution graph with ECG visualization.
 * Handles: lazy-loaded graphs, year tab switches, SPA navigation (turbo/pjax).
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────
  const ECG_CONTAINER_ID = 'ecgithub-container';
  const VIEW_MODES = ['normal', 'ecg', 'both'];
  let currentMode = 'ecg';
  let settings = {};
  let domObserver = null;       // single persistent observer on body
  let knownGraphEl = null;      // tracks current .js-calendar-graph instance
  let isRendering = false;
  let debounceTimer = null;
  let enabled = true;

  // ── Default Settings ───────────────────────────────────────────
  const DEFAULT_SETTINGS = {
    theme: 'github-green',
    customColors: null,
    animation: true,
    showStats: true,
    dataUnit: 'weekly',
    viewMode: 'ecg',
    enabled: true,
  };

  // ── Color Themes ───────────────────────────────────────────────
  const COLOR_THEMES = {
    'github-green': ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    blue: ['#ebedf0', '#9ecae1', '#4292c6', '#2171b5', '#084594'],
    purple: ['#ebedf0', '#b4a7d6', '#8e7cc3', '#674ea7', '#351c75'],
    sunset: ['#ebedf0', '#fdd49e', '#fdbb84', '#fc8d59', '#d7301f'],
    halloween: ['#ebedf0', '#ffee4a', '#ffc501', '#fe9600', '#03001c'],
  };

  // ── Profile Page Detection ─────────────────────────────────────
  function isProfilePage() {
    const path = window.location.pathname;
    if (/^\/[^/]+\/?$/.test(path) || /^\/[^/]+\?/.test(path + window.location.search)) {
      const excluded = [
        'settings', 'notifications', 'login', 'signup', 'explore',
        'marketplace', 'pulls', 'issues', 'codespaces', 'sponsors',
        'new', 'organizations', 'topics', 'trending', 'collections',
        'events', 'features', 'pricing', 'enterprise', 'team',
        'about', 'security', 'customer-stories',
      ];
      const firstSegment = path.split('/').filter(Boolean)[0];
      if (firstSegment && !excluded.includes(firstSegment.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  // ── Find contribution graph and section ─────────────────────────
  function getGraph() {
    return document.querySelector('.js-calendar-graph');
  }

  function getContributionSection() {
    const graph = getGraph();
    if (!graph) return null;
    return graph.closest('.js-yearly-contributions')
      || graph.closest('[aria-label="User contribution graph"]')
      || graph.parentElement;
  }

  // ── View Toggle Button ─────────────────────────────────────────
  function createToggleButton() {
    const existing = document.getElementById('ecgithub-toggle');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'ecgithub-toggle';
    btn.className = 'ecgithub-toggle-btn';
    btn.setAttribute('aria-label', 'Toggle ECG view');
    updateToggleLabel(btn);

    btn.addEventListener('click', () => {
      const idx = VIEW_MODES.indexOf(currentMode);
      currentMode = VIEW_MODES[(idx + 1) % VIEW_MODES.length];
      updateToggleLabel(btn);
      applyViewMode();
      chrome.storage.sync.set({ viewMode: currentMode });
    });

    return btn;
  }

  function updateToggleLabel(btn) {
    const labels = { normal: 'Normal', ecg: 'ECG', both: 'Both' };
    btn.textContent = labels[currentMode] || 'ECG';
    btn.title = `View: ${labels[currentMode]} (click to switch)`;
  }

  // ── View Mode Application ──────────────────────────────────────
  function applyViewMode() {
    const section = getContributionSection();
    const ecgContainer = document.getElementById(ECG_CONTAINER_ID);
    if (!section) return;

    switch (currentMode) {
      case 'normal':
        section.classList.remove('ecgithub-hidden');
        if (ecgContainer) ecgContainer.classList.add('ecgithub-hidden');
        break;
      case 'ecg':
        section.classList.add('ecgithub-hidden');
        if (ecgContainer) ecgContainer.classList.remove('ecgithub-hidden');
        break;
      case 'both':
        section.classList.remove('ecgithub-hidden');
        if (ecgContainer) ecgContainer.classList.remove('ecgithub-hidden');
        break;
    }
  }

  // ── ECG Rendering ──────────────────────────────────────────────
  function renderECG() {
    if (isRendering || !enabled) return;
    isRendering = true;

    try {
      const graphParent = getGraph();
      if (!graphParent) { return; }

      // Parse contribution data
      const data = (typeof EcgEngine !== 'undefined')
        ? EcgEngine.parseContributionData()
        : null;
      if (!data) { return; }

      // Remove existing ECG container
      const existing = document.getElementById(ECG_CONTAINER_ID);
      if (existing) existing.remove();

      // Create ECG container
      const container = document.createElement('div');
      container.id = ECG_CONTAINER_ID;
      container.className = 'ecgithub-wrapper ecg-container';

      // Resolve color palette
      const colors = settings.customColors ||
        COLOR_THEMES[settings.theme] ||
        COLOR_THEMES['github-green'];
      const lineColor = colors[4] || '#216e39';
      const animation = settings.animation !== false;
      const showStats = settings.showStats !== false;

      // Set CSS variable for theme color cascade
      container.style.setProperty('--ecg-line-color', lineColor);

      // Build ECG visualization
      if (typeof EcgEngine !== 'undefined') {
        const pathResult = EcgEngine.buildEcgPath(data, { mode: 'weekly' });
        const svg = EcgEngine.createEcgSvg(pathResult.d, container, {
          lineColor,
          endpoint: pathResult.endpoint,
        });

        EcgEngine.createTooltips(pathResult.peaks, container, {
          viewBoxW: EcgEngine.DEFAULTS.VIEWBOX_W,
          viewBoxH: EcgEngine.DEFAULTS.VIEWBOX_H,
        });

        if (animation) {
          EcgEngine.animateLine(svg);
        }
      }

      // Stats panel
      if (showStats && typeof EcgStats !== 'undefined') {
        const contributions = EcgStats.calcContributionStats(data);
        const streaks = EcgStats.calcStreaks(data);
        EcgStats.renderStatsPanel({ contributions, streaks }, container);
      }

      // Legend
      if (typeof EcgLegend !== 'undefined') {
        EcgLegend.renderLegend(container, { lineColor });
      }

      // Insert ECG container AFTER the contribution section
      const section = getContributionSection();
      if (section && section.parentNode) {
        section.parentNode.insertBefore(container, section.nextSibling);
      } else {
        graphParent.parentNode.insertBefore(container, graphParent.nextSibling);
      }

      // Toolbar: [export] [toggle] — right-aligned
      const toggleBtn = createToggleButton();
      const btnWrapper = document.createElement('div');
      btnWrapper.className = 'ecgithub-toggle-wrapper';

      if (typeof ECGExport !== 'undefined') {
        const exportBtn = ECGExport.createButton(container);
        exportBtn.classList.add('ecgithub-export-btn');
        btnWrapper.appendChild(exportBtn);
      }
      btnWrapper.appendChild(toggleBtn);

      const toggleParent = section ? section.parentNode : graphParent.parentNode;
      if (toggleParent) {
        const existingWrapper = toggleParent.querySelector('.ecgithub-toggle-wrapper');
        if (existingWrapper) existingWrapper.remove();
        // Insert toolbar row before the contribution section
        toggleParent.insertBefore(btnWrapper, section || graphParent);
      }

      applyViewMode();

      // Track this graph element instance
      knownGraphEl = graphParent;
    } finally {
      isRendering = false;
    }
  }

  // ── Disable / cleanup ──────────────────────────────────────────
  function removeECG() {
    const existing = document.getElementById(ECG_CONTAINER_ID);
    if (existing) existing.remove();
    const wrapper = document.querySelector('.ecgithub-toggle-wrapper');
    if (wrapper) wrapper.remove();
    const section = getContributionSection();
    if (section) section.classList.remove('ecgithub-hidden');
  }

  // ── Debounced render ───────────────────────────────────────────
  function scheduleRender() {
    if (isRendering) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderECG(), 300);
  }

  // ── Single persistent DOM observer ─────────────────────────────
  // Watches document.body for:
  // 1. .js-calendar-graph appearing (lazy load / SPA navigation)
  // 2. .js-calendar-graph being REPLACED (year tab switch)
  // 3. Content inside .js-calendar-graph changing
  function startDomObserver() {
    if (domObserver) return; // already running

    domObserver = new MutationObserver(() => {
      if (isRendering || !enabled) return;

      const currentGraph = getGraph();

      if (!currentGraph && !knownGraphEl) {
        // No graph yet, still waiting
        return;
      }

      if (currentGraph && !knownGraphEl) {
        // Graph just appeared (lazy load) → first render
        scheduleRender();
        return;
      }

      if (!currentGraph && knownGraphEl) {
        // Graph was removed (navigated away?) → clean up
        knownGraphEl = null;
        return;
      }

      if (currentGraph !== knownGraphEl) {
        // Graph element was REPLACED (year switch)
        // Immediately hide new section if in ECG mode (prevent flash)
        if (currentMode === 'ecg') {
          const section = getContributionSection();
          if (section) section.classList.add('ecgithub-hidden');
        }
        scheduleRender();
        return;
      }

      // Same element but content may have changed (unlikely but safe)
      // Only re-render if contribution cells actually changed
      // Skip to avoid unnecessary re-renders from our own DOM changes
    });

    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function stopDomObserver() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    knownGraphEl = null;
    clearTimeout(debounceTimer);
  }

  // ── Settings ───────────────────────────────────────────────────
  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
        settings = { ...DEFAULT_SETTINGS, ...stored };
        currentMode = settings.viewMode || 'ecg';
        enabled = settings.enabled !== false;
        resolve(settings);
      });
    });
  }

  // Listen for settings changes from popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    let needsRerender = false;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;

      if (key === 'enabled') {
        enabled = newValue !== false;
        if (!enabled) {
          removeECG();
        } else {
          needsRerender = true;
        }
      } else if (key === 'viewMode') {
        currentMode = newValue;
        const btn = document.getElementById('ecgithub-toggle');
        if (btn) updateToggleLabel(btn);
        applyViewMode();
      } else {
        needsRerender = true;
      }
    }

    if (needsRerender && enabled) {
      renderECG();
    }
  });

  // ── Initialization ─────────────────────────────────────────────
  function init() {
    if (!isProfilePage()) return;
    loadSettings().then(() => {
      if (!enabled) return;

      // Try to render immediately if graph exists
      if (getGraph()) {
        renderECG();
      }

      // Start persistent observer (catches lazy load + year switch)
      startDomObserver();
    });
  }

  function cleanup() {
    stopDomObserver();
    removeECG();
  }

  // ── SPA Navigation ─────────────────────────────────────────────
  document.addEventListener('turbo:load', () => { cleanup(); init(); });
  document.addEventListener('pjax:end', () => { cleanup(); init(); });

  // ── Initial Run ────────────────────────────────────────────────
  init();
})();
