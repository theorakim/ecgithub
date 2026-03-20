/**
 * ECG Rendering Engine
 * GitHub contribution graph를 심전도(ECG) 파형으로 시각화
 *
 * 원본: byminseok.com heartbeat.js
 * 적응: GitHub contribution level(0~4) → ECG peak height
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.EcgEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Constants ---
  var NS = 'http://www.w3.org/2000/svg';
  var DEFAULT_VIEWBOX_W = 720;
  var DEFAULT_VIEWBOX_H = 128;

  // Baseline / peak positions (ratios of VIEWBOX_H)
  var BASELINE_RATIO = 0.775;
  var PEAK_TOP_RATIO = 0.175;

  // Peak heights per contribution level (0~4)
  // 0 = flat baseline, 4 = full peak
  var LEVEL_PEAK_FACTORS = [0, 0.25, 0.5, 0.75, 1.0];

  // Default colors
  var DEFAULT_COLORS = {
    line: '#39d353',
    background: 'transparent',
  };

  // --- Seeded random (deterministic noise for baseline) ---
  function seeded(seed) {
    var x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  // --- ECG QRS+T waveform for one peak ---
  // cx: center x, peakY: peak top y, baseline: baseline y
  // scale: horizontal scale factor (1.0 = original 24px width, <1 = compressed)
  //
  // 원본(블로그): 70px/day 기준 설계 → peak 폭 24px (비율 0.34)
  // GitHub 적응: unitW에 맞춰 scale 조절 — 피크끼리 겹치지 않도록
  var DEFAULT_PEAK_WIDTH = 24; // cx-8 ~ cx+16 = 24px at scale 1.0

  function ecgPeak(cx, peakY, baseline, scale) {
    var s = scale || 1.0;
    var b = baseline;
    // Q dip
    var d = ' C ' + (cx - 8 * s) + ',' + b + ' ' + (cx - 6 * s) + ',' + (b + 1) + ' ' + (cx - 4 * s) + ',' + (b + 4);
    // Q → R peak
    d += ' C ' + (cx - 3 * s) + ',' + (b + 5) + ' ' + (cx - 1.5 * s) + ',' + (peakY + 5) + ' ' + cx + ',' + peakY;
    // R → S dip
    d += ' C ' + (cx + 1.5 * s) + ',' + (peakY + 5) + ' ' + (cx + 3 * s) + ',' + (b + 5) + ' ' + (cx + 4 * s) + ',' + (b + 4);
    // S → T wave
    d += ' C ' + (cx + 5 * s) + ',' + (b + 2) + ' ' + (cx + 7 * s) + ',' + (b - 8) + ' ' + (cx + 10 * s) + ',' + (b - 7);
    // T wave → baseline
    d += ' C ' + (cx + 12 * s) + ',' + (b - 5) + ' ' + (cx + 14 * s) + ',' + (b - 1) + ' ' + (cx + 16 * s) + ',' + b;
    return d;
  }

  // Calculate peak scale factor from available width per unit
  // Keeps peak within unitW while maintaining recognizable QRS+T shape
  function calcPeakScale(unitW) {
    // Target: peak occupies ~80% of unit width (leave 20% breathing room)
    var ideal = (unitW * 0.8) / DEFAULT_PEAK_WIDTH;
    // Clamp: min 0.05 (thin spikes for dense daily), max 1.2 (don't over-stretch)
    // At 0.05: peak = 1.2px → thin but visible vertical spike
    // At 0.46: peak = 11px → weekly mode, clear QRS+T shape
    return Math.max(0.05, Math.min(1.2, ideal));
  }

  // --- Parse contribution data from GitHub DOM ---
  // GitHub uses <table> with td.ContributionCalendar-day (not <svg> with <rect>)
  function parseContributionData(graphElement) {
    var container = graphElement || document.querySelector('.js-calendar-graph');
    if (!container) return null;

    // Try new GitHub DOM: <td> cells with data-date
    var cells = container.querySelectorAll('td.ContributionCalendar-day[data-date]');

    // Fallback: try older <rect> based DOM
    if (cells.length === 0) {
      cells = container.querySelectorAll('rect[data-date]');
    }
    if (cells.length === 0) return null;

    // Collect tooltip elements for count extraction
    var tooltipEls = container.querySelectorAll('tool-tip');
    var tooltipMap = {};
    for (var t = 0; t < tooltipEls.length; t++) {
      var tipId = tooltipEls[t].getAttribute('for');
      if (tipId) {
        tooltipMap[tipId] = tooltipEls[t].textContent || '';
      }
    }

    // Group cells into weeks by column index
    var weekColumns = {};
    var allDays = [];

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var date = cell.getAttribute('data-date');
      if (!date) continue;

      var level = parseInt(cell.getAttribute('data-level') || '0', 10);

      // Extract count from:
      // 1. data-count attribute (if present)
      // 2. tool-tip element (matched by cell id)
      // 3. aria-label fallback
      var count = 0;
      var dataCount = cell.getAttribute('data-count');
      if (dataCount !== null) {
        count = parseInt(dataCount, 10) || 0;
      } else {
        // Try tool-tip
        var cellId = cell.getAttribute('id');
        var tipText = cellId ? tooltipMap[cellId] : '';
        if (!tipText) {
          // Try aria-label or span text inside the cell
          tipText = cell.getAttribute('aria-label') || '';
          if (!tipText) {
            var span = cell.querySelector('span');
            if (span) tipText = span.textContent || '';
          }
        }
        var countMatch = tipText.match(/(\d+)\s+contributions?/i);
        if (countMatch) {
          count = parseInt(countMatch[1], 10);
        }
      }

      // Determine week grouping:
      // For <td>: use parent <tr>'s sibling index or column position
      // For <rect>: use x attribute
      // Group by ISO week key (works for both table-based and SVG-based DOM)
      var colKey = getWeekKey(date);

      var day = { date: date, count: count, level: level };
      allDays.push(day);

      if (!weekColumns[colKey]) {
        weekColumns[colKey] = [];
      }
      weekColumns[colKey].push(day);
    }

    // Sort weeks chronologically
    var weekKeys = Object.keys(weekColumns).sort();
    var weeks = weekKeys.map(function (key) {
      return {
        days: weekColumns[key].sort(function (a, b) {
          return a.date.localeCompare(b.date);
        }),
      };
    });

    // Total contributions
    var total = 0;
    for (var j = 0; j < allDays.length; j++) {
      total += allDays[j].count;
    }

    var username = extractUsername();

    return {
      weeks: weeks,
      days: allDays,
      totalContributions: total,
      username: username,
    };
  }

  // Get ISO week key from date string (YYYY-WNN)
  function getWeekKey(dateStr) {
    var d = new Date(dateStr + 'T00:00:00Z');
    var dayOfWeek = d.getUTCDay(); // 0=Sun
    // Adjust to Monday-based week start for grouping
    var thursday = new Date(d);
    thursday.setUTCDate(d.getUTCDate() - dayOfWeek + 3);
    var yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
    return thursday.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
  }

  function extractUsername() {
    // Method 1: profile page vcard
    var vcard = document.querySelector('.vcard-username, [itemprop="additionalName"]');
    if (vcard) return (vcard.textContent || '').trim();

    // Method 2: URL path
    var pathMatch = window.location.pathname.match(/^\/([^/]+)/);
    return pathMatch ? pathMatch[1] : 'unknown';
  }

  // --- Build ECG SVG path from weekly data ---
  // options: { mode: 'weekly'|'daily', viewBoxW, viewBoxH }
  function buildEcgPath(weeklyData, options) {
    var opts = options || {};
    var mode = opts.mode || 'weekly';
    var W = opts.viewBoxW || DEFAULT_VIEWBOX_W;
    var H = opts.viewBoxH || DEFAULT_VIEWBOX_H;

    var baseline = H * BASELINE_RATIO;
    var peakTop = H * PEAK_TOP_RATIO;
    var peakRange = baseline - peakTop;

    var peaks = [];

    if (mode === 'weekly') {
      return buildWeeklyPath(weeklyData, W, H, baseline, peakTop, peakRange, peaks);
    } else {
      return buildDailyPath(weeklyData, W, H, baseline, peakTop, peakRange, peaks);
    }
  }

  function buildWeeklyPath(weeklyData, W, H, baseline, peakTop, peakRange, peaks) {
    var weeks = weeklyData.weeks || weeklyData;
    var numWeeks = weeks.length;
    if (numWeeks === 0) return { d: '', peaks: [] };

    var weekW = W / numWeeks;
    var scale = calcPeakScale(weekW);
    var d = 'M 0,' + baseline;

    for (var i = 0; i < numWeeks; i++) {
      var week = weeks[i];
      var days = week.days || [];

      // Compute max level for this week
      var maxLevel = 0;
      var totalCount = 0;
      var bestDay = null;
      for (var j = 0; j < days.length; j++) {
        if (days[j].level > maxLevel) {
          maxLevel = days[j].level;
          bestDay = days[j];
        }
        totalCount += days[j].count;
      }

      var cx = i * weekW + weekW / 2;

      if (maxLevel === 0) {
        // No contributions this week — baseline with slight noise
        var n1 = seeded(i * 3) * 3 - 1.5;
        var n2 = seeded(i * 3 + 1) * 2 - 1;
        var endX = (i + 1) * weekW;
        d += ' Q ' + cx + ',' + (baseline + n1) + ' ' + endX + ',' + (baseline + n2 * 0.3);
      } else {
        // ECG peak — height proportional to max level, width scaled to fit
        var factor = LEVEL_PEAK_FACTORS[maxLevel] || 0;
        var peakY = baseline - peakRange * factor;
        d += ecgPeak(cx, peakY, baseline, scale);
        peaks.push({
          cx: cx,
          cy: peakY,
          level: maxLevel,
          totalCount: totalCount,
          days: days,
          bestDay: bestDay,
          weekIndex: i,
        });
      }
    }

    // Close path to end
    d += ' Q ' + (W - 15) + ',' + (baseline + 0.5) + ' ' + W + ',' + baseline;

    // Pulse dot at last activity (not end of line)
    // "Here is where the heart last beat"
    var lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : null;
    var endpoint = lastPeak
      ? { x: lastPeak.cx, y: lastPeak.cy, alive: true }
      : { x: W, y: baseline, alive: false };

    return { d: d, peaks: peaks, endpoint: endpoint, baseline: baseline };
  }

  function buildDailyPath(weeklyData, W, H, baseline, peakTop, peakRange, peaks) {
    var weeks = weeklyData.weeks || weeklyData;
    var allDays = [];
    for (var wi = 0; wi < weeks.length; wi++) {
      var days = weeks[wi].days || [];
      for (var di = 0; di < days.length; di++) {
        allDays.push(days[di]);
      }
    }

    var numDays = allDays.length;
    if (numDays === 0) return { d: '', peaks: [] };

    var dayW = W / numDays;
    var scale = calcPeakScale(dayW);
    var d = 'M 0,' + baseline;

    for (var i = 0; i < numDays; i++) {
      var day = allDays[i];
      var cx = i * dayW + dayW / 2;

      if (day.level === 0) {
        var n1 = seeded(i * 3) * 3 - 1.5;
        var n2 = seeded(i * 3 + 1) * 2 - 1;
        var endX = (i + 1) * dayW;
        d += ' Q ' + cx + ',' + (baseline + n1) + ' ' + endX + ',' + (baseline + n2 * 0.3);
      } else {
        var factor = LEVEL_PEAK_FACTORS[day.level] || 0;
        var peakY = baseline - peakRange * factor;
        d += ecgPeak(cx, peakY, baseline, scale);
        peaks.push({
          cx: cx,
          cy: peakY,
          level: day.level,
          totalCount: day.count,
          date: day.date,
          dayIndex: i,
        });
      }
    }

    d += ' Q ' + (W - 15) + ',' + (baseline + 0.5) + ' ' + W + ',' + baseline;
    return { d: d, peaks: peaks };
  }

  // --- Create SVG element ---
  function createEcgSvg(pathD, container, options) {
    var opts = options || {};
    var W = opts.viewBoxW || DEFAULT_VIEWBOX_W;
    var H = opts.viewBoxH || DEFAULT_VIEWBOX_H;
    var lineColor = opts.lineColor || DEFAULT_COLORS.line;
    var lineWidth = opts.lineWidth || 1.5;

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'ecg-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'ECG contribution visualization');

    var path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'ecg-line');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', lineColor);
    path.setAttribute('stroke-width', String(lineWidth));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', pathD);
    svg.appendChild(path);

    // Pulse dot — hidden initially, revealed after line animation
    if (opts.endpoint) {
      var ep = opts.endpoint;
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', String(ep.x));
      dot.setAttribute('cy', String(ep.y));
      dot.setAttribute('r', ep.alive ? '3' : '2');
      dot.setAttribute('fill', lineColor);
      dot.setAttribute('class',
        'ecg-pulse-dot ecg-pulse-dot--hidden' +
        (ep.alive ? ' ecg-pulse-dot--alive' : ''));
      svg.appendChild(dot);
    }

    if (container) {
      container.appendChild(svg);
    }

    return svg;
  }

  // --- Line drawing animation (stroke-dashoffset) ---
  function revealPulseDot(svg) {
    var dot = svg.querySelector('.ecg-pulse-dot--hidden');
    if (dot) dot.classList.remove('ecg-pulse-dot--hidden');
  }

  function animateLine(svg, callback) {
    var path = svg.querySelector('.ecg-line');
    if (!path) {
      revealPulseDot(svg);
      if (callback) callback();
      return;
    }

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      revealPulseDot(svg);
      if (callback) callback();
      return;
    }

    var length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;

    // Small delay before starting animation
    setTimeout(function () {
      path.style.transition = 'stroke-dashoffset 1.2s ease-in-out';
      path.style.strokeDashoffset = '0';

      setTimeout(function () {
        // Clean up dash properties to avoid resize glitches
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        path.style.transition = '';
        // Reveal pulse dot after line finishes drawing
        revealPulseDot(svg);
        if (callback) callback();
      }, 1250);
    }, 200);
  }

  // --- Hover tooltips ---
  function createTooltips(peaks, container, options) {
    var opts = options || {};
    var svg = container.querySelector('.ecg-svg');
    if (!svg || peaks.length === 0) return [];

    var tooltipEls = [];

    for (var i = 0; i < peaks.length; i++) {
      var peak = peaks[i];

      var dot = document.createElement('div');
      dot.className = 'ecg-peak-dot';
      dot.style.cssText = 'position:absolute;opacity:0;';
      dot.setAttribute('data-peak-index', String(i));

      var tooltip = document.createElement('div');
      tooltip.className = 'ecg-tooltip';

      // Build tooltip content
      var tooltipContent = '';
      if (peak.date) {
        // Daily mode
        tooltipContent =
          '<span class="ecg-tooltip__count">' + peak.totalCount + ' contributions</span>' +
          '<span class="ecg-tooltip__date">' + formatDate(peak.date) + '</span>';
      } else if (peak.days && peak.days.length > 0) {
        // Weekly mode
        var dateRange = peak.days[0].date + ' ~ ' + peak.days[peak.days.length - 1].date;
        tooltipContent =
          '<span class="ecg-tooltip__count">' + peak.totalCount + ' contributions</span>' +
          '<span class="ecg-tooltip__date">' + dateRange + '</span>';
      }

      tooltip.innerHTML = tooltipContent;
      dot.appendChild(tooltip);
      container.appendChild(dot);

      tooltipEls.push({
        el: dot,
        cx: peak.cx,
        cy: peak.cy,
        peak: peak,
      });
    }

    // Position dots
    positionDots(tooltipEls, container, svg);

    // Animate dots appearance (after line animation)
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      for (var j = 0; j < tooltipEls.length; j++) {
        if (reduced) {
          tooltipEls[j].el.style.opacity = '1';
        } else {
          var delay = (j * 0.06) + 's';
          tooltipEls[j].el.style.transition = 'opacity 0.3s ease ' + delay;
          tooltipEls[j].el.style.opacity = '1';
        }
      }
    }, reduced ? 0 : 1500);

    // Resize handler
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        positionDots(tooltipEls, container, svg);
      }, 100);
    });

    return tooltipEls;
  }

  function positionDots(tooltipEls, container, svg) {
    var svgRect = svg.getBoundingClientRect();
    var containerRect = container.getBoundingClientRect();
    var offsetX = svgRect.left - containerRect.left;
    var offsetY = svgRect.top - containerRect.top;
    var W = parseFloat(svg.getAttribute('viewBox').split(' ')[2]) || DEFAULT_VIEWBOX_W;
    var H = parseFloat(svg.getAttribute('viewBox').split(' ')[3]) || DEFAULT_VIEWBOX_H;
    var scaleX = svgRect.width / W;
    var scaleY = svgRect.height / H;

    for (var i = 0; i < tooltipEls.length; i++) {
      var t = tooltipEls[i];
      var px = offsetX + t.cx * scaleX;
      var py = offsetY + t.cy * scaleY;
      t.el.style.left = px + 'px';
      t.el.style.top = py + 'px';
    }

    // Adjust tooltips at edges
    adjustTooltipPositions(tooltipEls, container);
  }

  function adjustTooltipPositions(tooltipEls, container) {
    var cw = container.offsetWidth;
    for (var i = 0; i < tooltipEls.length; i++) {
      var el = tooltipEls[i].el;
      var left = parseFloat(el.style.left);
      var tooltipW = 160;
      var halfTip = tooltipW / 2;

      var offset = '-50%';
      if (left - halfTip < 0) {
        offset = 'calc(-50% + ' + (halfTip - left) + 'px)';
      } else if (left + halfTip > cw) {
        offset = 'calc(-50% - ' + (left + halfTip - cw) + 'px)';
      }
      el.style.setProperty('--ecg-tooltip-offset', offset);
    }
  }

  function formatDate(dateStr) {
    var parts = dateStr.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[parseInt(parts[1], 10) - 1] || parts[1];
    var day = parseInt(parts[2], 10);
    return month + ' ' + day + ', ' + parts[0];
  }

  // --- Theme detection ---
  function getThemeInfo() {
    var html = document.documentElement;
    var mode = html.getAttribute('data-color-mode') || 'auto';
    var current = mode === 'light' ? 'light' : 'dark';
    if (mode === 'auto') {
      current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return { mode: mode, current: current };
  }

  // --- Public API ---
  return {
    parseContributionData: parseContributionData,
    buildEcgPath: buildEcgPath,
    createEcgSvg: createEcgSvg,
    animateLine: animateLine,
    createTooltips: createTooltips,
    getThemeInfo: getThemeInfo,

    // Expose constants for external use
    DEFAULTS: {
      VIEWBOX_W: DEFAULT_VIEWBOX_W,
      VIEWBOX_H: DEFAULT_VIEWBOX_H,
      BASELINE_RATIO: BASELINE_RATIO,
      PEAK_TOP_RATIO: PEAK_TOP_RATIO,
      LEVEL_PEAK_FACTORS: LEVEL_PEAK_FACTORS,
      COLORS: DEFAULT_COLORS,
    },
  };
});
