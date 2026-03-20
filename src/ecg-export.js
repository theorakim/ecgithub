/**
 * ECG Export Module
 * Exports ECG visualization (SVG + stats panel) as PNG image.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ECGExport = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PADDING = 20;
  var BG_DARK = '#0d1117';
  var BG_LIGHT = '#ffffff';

  /**
   * Create the export/download button element.
   * @param {HTMLElement} ecgContainer - The ECG wrapper container
   * @returns {HTMLButtonElement}
   */
  function createButton(ecgContainer) {
    var btn = document.createElement('button');
    btn.className = 'ecgithub-export-btn';
    btn.title = 'Download as PNG';
    btn.setAttribute('aria-label', 'Download ECG as PNG image');

    // Camera/download icon SVG
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/>' +
      '</svg>';

    btn.addEventListener('click', function () {
      exportAsPng(ecgContainer);
    });

    return btn;
  }

  /**
   * Export the ECG container as a PNG image.
   * @param {HTMLElement} container - The ECG wrapper element
   */
  function exportAsPng(container) {
    var svg = container.querySelector('.ecg-svg');
    if (!svg) return;

    // Detect theme for background
    var html = document.documentElement;
    var isDark = html.getAttribute('data-color-mode') !== 'light';
    if (html.getAttribute('data-color-mode') === 'auto') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var bgColor = isDark ? BG_DARK : BG_LIGHT;

    // Get SVG dimensions
    var viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    var svgW = viewBox[2] || 813;
    var svgH = viewBox[3] || 128;

    // Scale factor for high-res export
    var scale = 2;

    // Check if stats panel exists
    var statsPanel = container.querySelector('.ecg-stats-panel');
    var statsHeight = 0;
    if (statsPanel) {
      statsHeight = statsPanel.getBoundingClientRect().height * scale;
    }

    // Canvas dimensions
    var canvasW = (svgW + PADDING * 2) * scale;
    var canvasH = (svgH + PADDING * 2) * scale + (statsHeight > 0 ? statsHeight + PADDING * scale : 0);

    var canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    var ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Serialize SVG to image
    var svgClone = svg.cloneNode(true);
    // Inline computed styles for the path
    var origPath = svg.querySelector('.ecg-line');
    var clonePath = svgClone.querySelector('.ecg-line');
    if (origPath && clonePath) {
      var cs = window.getComputedStyle(origPath);
      clonePath.setAttribute('stroke', cs.stroke);
      clonePath.setAttribute('stroke-width', cs.strokeWidth);
      // Remove animation properties for static export
      clonePath.style.strokeDasharray = '';
      clonePath.style.strokeDashoffset = '';
      clonePath.style.transition = '';
    }

    var svgData = new XMLSerializer().serializeToString(svgClone);
    var svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);

    var img = new Image();
    img.onload = function () {
      // Draw SVG
      ctx.drawImage(img, PADDING * scale, PADDING * scale, svgW * scale, svgH * scale);
      URL.revokeObjectURL(url);

      // Draw stats panel if present
      if (statsPanel && statsHeight > 0) {
        drawStatsToCanvas(ctx, statsPanel, PADDING * scale, (svgH + PADDING * 1.5) * scale, canvasW - PADDING * 2 * scale, isDark);
      }

      // Trigger download
      triggerDownload(canvas);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      // Fallback: try without stats
      triggerDownload(canvas);
    };
    img.src = url;
  }

  /**
   * Draw stats panel text onto canvas.
   */
  function drawStatsToCanvas(ctx, statsPanel, x, y, maxWidth, isDark) {
    var items = statsPanel.querySelectorAll('.ecg-stats-item');
    if (items.length === 0) return;

    var textColor = isDark ? '#e6edf3' : '#24292f';
    var mutedColor = isDark ? '#848d97' : '#57606a';
    var accentColor = isDark ? '#39d353' : '#216e39';

    // Draw a subtle separator line
    ctx.strokeStyle = isDark ? '#21262d' : '#d0d7de';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + maxWidth, y);
    ctx.stroke();

    y += 24;

    // Draw each stat block
    var blocks = statsPanel.querySelectorAll('.ecg-stats-block');
    var blockX = x;

    blocks.forEach(function (block) {
      // Block title
      var title = block.querySelector('.ecg-stats-block__title');
      if (title) {
        ctx.font = 'bold 18px -apple-system, sans-serif';
        ctx.fillStyle = mutedColor;
        ctx.fillText(title.textContent, blockX, y);
        y += 24;
      }

      // Stat items
      var blockItems = block.querySelectorAll('.ecg-stats-item');
      blockItems.forEach(function (item) {
        var value = item.querySelector('.ecg-stats-item__value');
        var label = item.querySelector('.ecg-stats-item__label');

        if (value) {
          ctx.font = 'bold 24px -apple-system, sans-serif';
          ctx.fillStyle = accentColor;
          ctx.fillText(value.textContent, blockX, y);
          blockX += ctx.measureText(value.textContent).width + 8;
        }

        if (label) {
          ctx.font = '16px -apple-system, sans-serif';
          ctx.fillStyle = mutedColor;
          ctx.fillText(label.textContent, blockX, y);
          blockX += ctx.measureText(label.textContent).width + 20;
        }
      });

      y += 28;
      blockX = x;
    });
  }

  /**
   * Trigger file download from canvas.
   */
  function triggerDownload(canvas) {
    var dataUrl = canvas.toDataURL('image/png');
    var link = document.createElement('a');
    link.download = 'ecgithub-contribution.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Public API ---
  return {
    createButton: createButton,
    exportAsPng: exportAsPng,
  };
});
