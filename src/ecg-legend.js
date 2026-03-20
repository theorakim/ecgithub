/**
 * ECG Legend Module
 * Less → More 범례를 ECG 미니 파형으로 표현
 * (GitHub의 사각형 범례 대신 ECG 피크 높이로 level 표현)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.EcgLegend = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // Mini waveform SVG paths for each level (0~4)
  // viewBox: 0 0 28 14, baseline at y=12
  var WAVE_PATHS = {
    // Level 0: flat baseline with tiny noise
    0: 'M 0,12 Q 7,11.5 14,12 Q 21,12.3 28,12',
    // Level 1: very small peak
    1: 'M 0,12 C 8,12 10,10 12,9 C 13,8.5 14,9.5 15,10.5 C 16,11 17,11.5 18,11 C 20,10.5 22,12 28,12',
    // Level 2: medium peak
    2: 'M 0,12 C 8,12 10,9 12,7 C 13,6 14,7.5 15,9 C 16,10 17,10.5 18,9.5 C 20,9 22,12 28,12',
    // Level 3: tall peak
    3: 'M 0,12 C 8,12 10,7 12,4 C 13,3 14,5 15,8 C 16,9.5 17,10 18,8.5 C 20,8 22,12 28,12',
    // Level 4: maximum peak
    4: 'M 0,12 C 8,12 10,5 12,2 C 13,1 14,3 15,7 C 16,9 17,9.5 18,7.5 C 20,7 22,12 28,12',
  };

  /**
   * Render the ECG legend.
   * @param {HTMLElement} container - where to append
   * @param {Object} [options] - { lineColor }
   * @returns {HTMLElement}
   */
  function renderLegend(container, options) {
    var opts = options || {};
    var lineColor = opts.lineColor || '#39d353';

    var legend = document.createElement('div');
    legend.className = 'ecg-legend';

    // "Less" label
    var lessLabel = document.createElement('span');
    lessLabel.className = 'ecg-legend__label';
    lessLabel.textContent = 'Less';
    legend.appendChild(lessLabel);

    // 5 mini waveforms (level 0~4)
    for (var level = 0; level <= 4; level++) {
      var item = document.createElement('span');
      item.className = 'ecg-legend__item';
      item.setAttribute('title', 'Level ' + level);

      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 28 14');
      svg.setAttribute('aria-hidden', 'true');

      var path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'ecg-legend-wave');
      path.setAttribute('d', WAVE_PATHS[level]);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', lineColor);

      // Opacity scales with level for visual hierarchy
      var opacity = level === 0 ? 0.2 : 0.2 + (level / 4) * 0.8;
      path.setAttribute('stroke-opacity', String(opacity));

      svg.appendChild(path);
      item.appendChild(svg);
      legend.appendChild(item);
    }

    // "More" label
    var moreLabel = document.createElement('span');
    moreLabel.className = 'ecg-legend__label';
    moreLabel.textContent = 'More';
    legend.appendChild(moreLabel);

    if (container) {
      container.appendChild(legend);
    }

    return legend;
  }

  /**
   * Update legend colors (when user changes theme).
   * @param {HTMLElement} legendEl
   * @param {string} newColor
   */
  function updateLegendColor(legendEl, newColor) {
    var paths = legendEl.querySelectorAll('.ecg-legend-wave');
    for (var i = 0; i < paths.length; i++) {
      paths[i].setAttribute('stroke', newColor);
    }
  }

  return {
    renderLegend: renderLegend,
    updateLegendColor: updateLegendColor,
    WAVE_PATHS: WAVE_PATHS,
  };
});
