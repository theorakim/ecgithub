/**
 * ECG Stats Module
 * Contribution 데이터에서 통계 계산 + 통계 패널 DOM 생성
 *
 * 참조: Isometric Contributions (iso.js) 통계 항목
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.EcgStats = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Contribution Statistics ---

  /**
   * Calculate contribution statistics from parsed data.
   * @param {Object} data - { weeks: [{ days: [{ date, count, level }] }], days: [...] }
   * @returns {{ total, bestDay: { date, count }, average }}
   */
  function calcContributionStats(data) {
    var allDays = getAllDays(data);
    if (allDays.length === 0) {
      return { total: 0, bestDay: { date: '', count: 0 }, average: 0 };
    }

    var total = 0;
    var bestDay = { date: '', count: 0 };

    for (var i = 0; i < allDays.length; i++) {
      var day = allDays[i];
      total += day.count;
      if (day.count > bestDay.count) {
        bestDay = { date: day.date, count: day.count };
      }
    }

    // Average: total / number of days in the range
    var firstDate = allDays[0].date;
    var lastDate = allDays[allDays.length - 1].date;
    var daysBetween = dateDiffDays(firstDate, lastDate) + 1;
    var average = daysBetween > 0 ? total / daysBetween : 0;

    return {
      total: total,
      bestDay: bestDay,
      average: Math.round(average * 100) / 100,
    };
  }

  // --- Streak Statistics ---

  /**
   * Calculate streak statistics.
   * @param {Object} data - contribution data
   * @returns {{ longest: { start, end, days }, current: { start, end, days } }}
   */
  function calcStreaks(data) {
    var allDays = getAllDays(data);
    if (allDays.length === 0) {
      return {
        longest: { start: '', end: '', days: 0 },
        current: { start: '', end: '', days: 0 },
      };
    }

    // Sort by date ascending
    allDays.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });

    var longest = { start: '', end: '', days: 0 };
    var current = { start: '', end: '', days: 0 };

    // Temporary streak tracking
    var streakStart = '';
    var streakDays = 0;

    for (var i = 0; i < allDays.length; i++) {
      var day = allDays[i];

      if (day.count > 0) {
        if (streakDays === 0) {
          streakStart = day.date;
        }
        streakDays++;

        // Update longest
        if (streakDays > longest.days) {
          longest = { start: streakStart, end: day.date, days: streakDays };
        }
      } else {
        streakDays = 0;
        streakStart = '';
      }
    }

    // Current streak: walk backwards from the last day
    var currentDays = 0;
    var currentEnd = '';
    var currentStart = '';

    // Allow today to have 0 contributions (streak may still be active from yesterday)
    var startIdx = allDays.length - 1;
    var today = getTodayISO();
    if (allDays[startIdx].date === today && allDays[startIdx].count === 0) {
      startIdx--;
    }

    for (var j = startIdx; j >= 0; j--) {
      if (allDays[j].count > 0) {
        if (currentDays === 0) {
          currentEnd = allDays[j].date;
        }
        currentStart = allDays[j].date;
        currentDays++;
      } else {
        break;
      }
    }

    current = { start: currentStart, end: currentEnd, days: currentDays };

    return { longest: longest, current: current };
  }

  // --- Stats Panel DOM ---

  /**
   * Render statistics panel into container.
   * @param {{ contributions: { total, bestDay, average }, streaks: { longest, current } }} stats
   * @param {HTMLElement} container
   * @returns {HTMLElement} the panel element
   */
  function renderStatsPanel(stats, container) {
    var panel = document.createElement('div');
    panel.className = 'ecg-stats-panel';

    // --- Contributions block ---
    var contribBlock = document.createElement('div');
    contribBlock.className = 'ecg-stats-block';

    var contribTitle = document.createElement('div');
    contribTitle.className = 'ecg-stats-block__title';
    contribTitle.textContent = 'Contributions';
    contribBlock.appendChild(contribTitle);

    var contribGrid = document.createElement('div');
    contribGrid.className = 'ecg-stats-grid';

    // Total
    contribGrid.appendChild(createStatItem(
      formatNumber(stats.contributions.total),
      'Total'
    ));

    // Best Day
    var bestDayValue = stats.contributions.bestDay.count > 0
      ? formatNumber(stats.contributions.bestDay.count)
      : '-';
    var bestDayLabel = stats.contributions.bestDay.date
      ? 'Best day (' + formatDateShort(stats.contributions.bestDay.date) + ')'
      : 'Best day';
    contribGrid.appendChild(createStatItem(bestDayValue, bestDayLabel));

    // Average
    contribGrid.appendChild(createStatItem(
      String(stats.contributions.average),
      'Average / day'
    ));

    contribBlock.appendChild(contribGrid);
    panel.appendChild(contribBlock);

    // --- Streaks block ---
    var streakBlock = document.createElement('div');
    streakBlock.className = 'ecg-stats-block';

    var streakTitle = document.createElement('div');
    streakTitle.className = 'ecg-stats-block__title';
    streakTitle.textContent = 'Streaks';
    streakBlock.appendChild(streakTitle);

    var streakGrid = document.createElement('div');
    streakGrid.className = 'ecg-stats-grid';

    // Longest
    var longestValue = stats.streaks.longest.days > 0
      ? stats.streaks.longest.days + ' days'
      : '-';
    var longestLabel = stats.streaks.longest.start
      ? 'Longest (' + formatDateShort(stats.streaks.longest.start) + ' \u2192 ' + formatDateShort(stats.streaks.longest.end) + ')'
      : 'Longest';
    streakGrid.appendChild(createStatItem(longestValue, longestLabel));

    // Current
    var currentValue = stats.streaks.current.days > 0
      ? stats.streaks.current.days + ' days'
      : '-';
    var currentLabel = stats.streaks.current.start
      ? 'Current (' + formatDateShort(stats.streaks.current.start) + ' \u2192 ' + formatDateShort(stats.streaks.current.end) + ')'
      : 'Current';
    streakGrid.appendChild(createStatItem(currentValue, currentLabel));

    streakBlock.appendChild(streakGrid);
    panel.appendChild(streakBlock);

    if (container) {
      container.appendChild(panel);
    }

    return panel;
  }

  // --- Helpers ---

  function createStatItem(value, label) {
    var item = document.createElement('div');
    item.className = 'ecg-stats-item';

    var valueEl = document.createElement('span');
    valueEl.className = 'ecg-stats-item__value';
    valueEl.textContent = value;

    var labelEl = document.createElement('span');
    labelEl.className = 'ecg-stats-item__label';
    labelEl.textContent = label;

    item.appendChild(valueEl);
    item.appendChild(labelEl);
    return item;
  }

  function getAllDays(data) {
    if (data.days && data.days.length > 0) {
      return data.days;
    }
    var allDays = [];
    var weeks = data.weeks || data;
    if (!Array.isArray(weeks)) return allDays;
    for (var i = 0; i < weeks.length; i++) {
      var days = weeks[i].days || [];
      for (var j = 0; j < days.length; j++) {
        allDays.push(days[j]);
      }
    }
    return allDays;
  }

  function dateDiffDays(dateStr1, dateStr2) {
    var d1 = new Date(dateStr1 + 'T00:00:00Z');
    var d2 = new Date(dateStr2 + 'T00:00:00Z');
    return Math.round(Math.abs(d2 - d1) / 86400000);
  }

  function getTodayISO() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function formatNumber(n) {
    if (n >= 1000) {
      return n.toLocaleString();
    }
    return String(n);
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[parseInt(parts[1], 10) - 1] || parts[1];
    var day = parseInt(parts[2], 10);
    return month + ' ' + day;
  }

  // --- Public API ---
  return {
    calcContributionStats: calcContributionStats,
    calcStreaks: calcStreaks,
    renderStatsPanel: renderStatsPanel,
  };
});
