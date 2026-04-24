// ── common/04-chart-lifecycle.js ────────────────────────────────────────────
// Safe Chart.js lifecycle helpers.
//
// scheduleChart() debounces chart creation so rapid re-renders (slider moves,
// page switches) cannot stack up multiple Chart instances on the same canvas.
// destroyChart() is available for manual cleanup when needed.

// ── Timer registry (canvasId → timeoutId) ────────────────────
const _chartTimers = {};

/**
 * Destroy any existing Chart instance on a canvas and cancel any pending
 * scheduled build for it.
 */
function destroyChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }
  if (_chartTimers[canvasId]) {
    clearTimeout(_chartTimers[canvasId]);
    delete _chartTimers[canvasId];
  }
}

/**
 * Schedule a Chart.js build after `delay` ms.
 * If called again before the delay fires, the previous timer is cancelled —
 * only the most recent call wins.
 *
 * @param {string}   canvasId - id of the <canvas> element
 * @param {number}   delay    - ms to wait before building (typically 50–100)
 * @param {Function} buildFn  - receives the canvas element, must return a Chart instance
 */
function scheduleChart(canvasId, delay, buildFn) {
  if (_chartTimers[canvasId]) clearTimeout(_chartTimers[canvasId]);

  _chartTimers[canvasId] = setTimeout(() => {
    delete _chartTimers[canvasId];
    const el = document.getElementById(canvasId);
    if (!el || !window.Chart) return;
    if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }
    el._chartInst = buildFn(el);
  }, delay);
}
