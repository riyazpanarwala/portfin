// ── page-overview/05-drawdown-analyzer.js ───────────────────────────────────
// Drawdown Analyzer.
// Simulates a portfolio value series via GBM (with real Indian crash overlays),
// computes peak-to-trough drawdown stats, renders the Chart.js drawdown chart,
// and displays a contextual insight card.
//
// The GBM series is cached in DATA._cachedDrawdownSeries and is only recomputed
// after a fresh Excel upload (cache cleared in page-tools/04-data-applier.js).

// ── Entry point ───────────────────────────────────────────────
function renderDrawdownAnalyzer() {
  const series = buildDrawdownSeriesFromTimeline();

  if (!series.length) {
    renderDrawdownSummary({ maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true });
    renderDrawdownInsight(0, 0);
    return;
  }

  const stats    = calculateDrawdown(series);
  const ddResult = calculateDrawdownWithPeriod(series);

  renderDrawdownSummary(stats);
  renderDrawdownInsight(stats.maxDD, stats.currentDD);
  renderDrawdownChart(series, ddResult);
}

// ── GBM series builder (cached) ───────────────────────────────
// FIX Issue #3: result is cached in DATA._cachedDrawdownSeries;
// cleared on every upload via tryApplyData().
function buildDrawdownSeriesFromTimeline() {
  if (DATA._cachedDrawdownSeries) return DATA._cachedDrawdownSeries;

  const allMonths = buildCombinedMonthly();
  if (!allMonths.length) return [];
  const k = DATA.kpis;
  if (!k || !k.totalInvested) return [];

  const series = _simulateGBMSeries(allMonths, k);

  DATA._cachedDrawdownSeries = series;
  return series;
}

function _simulateGBMSeries(allMonths, k) {
  const first    = allMonths[0].m;
  const last     = allMonths[allMonths.length - 1].m;
  const monthMap = {};
  allMonths.forEach(({ m, v }) => (monthMap[m] = v));

  const mfCAGR      = k.mfCAGR > 0 ? k.mfCAGR : 12;
  const monthlyDrift = (mfCAGR / 100) / 12;
  const monthlySigma = 0.18 / Math.sqrt(12);

  // Historical Indian market crash shocks overlaid on GBM
  const CRASH_SHOCKS = {
    "2008-10": -0.24, "2011-12": -0.08, "2013-08": -0.07,
    "2015-08": -0.09, "2016-11": -0.06, "2018-09": -0.08,
    "2020-03": -0.32, "2022-06": -0.10, "2024-06": -0.06,
  };

  // Deterministic seeded PRNG (same seed → same series for same data)
  const [sy, sm] = first.split("-").map(Number);
  let seed = sy * 100 + sm;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randn = () => {
    let u, v;
    do { u = rand(); v = rand(); } while (u === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const series = [];
  let [fy, fm] = [parseInt(first.slice(0, 4)), parseInt(first.slice(5))];
  const [ey, em] = [parseInt(last.slice(0, 4)), parseInt(last.slice(5))];
  let portfolioValue = 0;

  while (fy < ey || (fy === ey && fm <= em)) {
    const mk = fy + "-" + String(fm).padStart(2, "0");
    portfolioValue += monthMap[mk] || 0;
    portfolioValue *= 1 + monthlyDrift + monthlySigma * randn();
    if (CRASH_SHOCKS[mk] !== undefined) portfolioValue *= 1 + CRASH_SHOCKS[mk];
    portfolioValue = Math.max(portfolioValue, 0);
    series.push({ date: mk, value: Math.round(portfolioValue) });
    if (++fm > 12) { fm = 1; fy++; }
  }

  // Blend simulated end-value toward actual portfolio value
  const actualEnd = k.totalValue || 0;
  if (actualEnd > 0 && series.length > 0) {
    const simEnd = series[series.length - 1].value;
    if (simEnd > 0) {
      const scale = actualEnd / simEnd;
      const n     = series.length;
      series.forEach((pt, i) => {
        const blendedScale = 1 + (scale - 1) * (i / Math.max(n - 1, 1));
        pt.value = Math.round(pt.value * blendedScale);
      });
    }
  }

  return series;
}

// ── Drawdown statistics ───────────────────────────────────────
function calculateDrawdown(series) {
  if (!series.length)
    return { maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true };

  const values      = series.map((s) => s.value);
  let runningPeak   = values[0];
  let maxDD         = 0;
  let maxDDPeak     = runningPeak;
  let maxDDTroughIdx = 0;
  let curPeakIdx    = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? (values[i] - runningPeak) / runningPeak : 0;
    if (dd < maxDD) { maxDD = dd; maxDDPeak = runningPeak; maxDDTroughIdx = i; }
  }

  const finalVal   = values[values.length - 1];
  const allTimePeak = Math.max(...values);
  const currentDD  = allTimePeak > 0 ? (finalVal - allTimePeak) / allTimePeak : 0;

  let recoveryMonths = 0, recovered = true;
  if (maxDD < -0.001) {
    recovered = false;
    for (let i = maxDDTroughIdx + 1; i < values.length; i++) {
      recoveryMonths++;
      if (values[i] >= maxDDPeak) { recovered = true; break; }
    }
    if (!recovered) recoveryMonths = values.length - 1 - maxDDTroughIdx;
  }

  return { maxDD, currentDD, peak: allTimePeak, recoveryMonths, recovered };
}

function calculateDrawdownWithPeriod(series) {
  if (!series.length) return { peakIndex: 0, troughIndex: 0, maxDD: 0, ddSeries: [] };

  const values    = series.map((s) => s.value);
  let runningPeak = values[0];
  let maxDD       = 0;
  let peakIdx     = 0;
  let troughIdx   = 0;
  let curPeakIdx  = 0;
  const ddSeries  = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? ((values[i] - runningPeak) / runningPeak) * 100 : 0;
    ddSeries.push(parseFloat(dd.toFixed(2)));
    if (dd < maxDD) { maxDD = dd; peakIdx = curPeakIdx; troughIdx = i; }
  }

  return { peakIndex: peakIdx, troughIndex: troughIdx, maxDD, ddSeries };
}

// ── KPI summary tiles ─────────────────────────────────────────
function renderDrawdownSummary(stats) {
  const { maxDD, currentDD, peak, recoveryMonths, recovered } = stats;
  const noData = !peak;

  const set = (id, text, color) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = text; if (color) el.style.color = color; }
  };

  set("dd-max",  noData ? "—" : (maxDD * 100).toFixed(1) + "%",
      noData ? "var(--muted)" : "var(--red)");
  set("dd-max-note", noData ? "Upload data" : "Worst peak-to-trough fall");

  if (noData) {
    set("dd-cur",  "—",       "var(--muted)");
    set("dd-cur-note", "Upload data");
  } else if (currentDD >= -0.001) {
    set("dd-cur",  "At Peak", "var(--green)");
    set("dd-cur-note", "Portfolio at all-time high");
  } else {
    set("dd-cur",  (currentDD * 100).toFixed(1) + "%",
        currentDD < -0.15 ? "var(--red)" : "var(--amber)");
    set("dd-cur-note", "Below all-time high");
  }

  if (noData) {
    set("dd-recovery",      "—",     "var(--muted)");
    set("dd-recovery-note", "Upload data");
  } else if (recoveryMonths === 0) {
    set("dd-recovery",      "None",  "var(--green)");
    set("dd-recovery-note", "No significant drawdown");
  } else {
    set("dd-recovery",      recoveryMonths + " mo",
        recovered ? "var(--green)" : "var(--amber)");
    set("dd-recovery-note", recovered ? "Fully recovered" : "Still recovering");
  }

  set("dd-peak",      noData ? "—" : fmtL(peak),
      noData ? "var(--muted)" : "var(--gold)");
  set("dd-peak-note", noData ? "Upload data" : "All-time portfolio high");
}

// ── Chart ─────────────────────────────────────────────────────
function renderDrawdownChart(series, ddResult) {
  scheduleChart("chart-drawdown", 100, (canvas) => {
    if (!series.length) {
      canvas.parentElement.innerHTML =
        '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see drawdown chart</div>';
      return null;
    }

    const { ddSeries, peakIndex, troughIndex } = ddResult;
    const labels  = series.map((s) => s.date);
    const skip    = Math.max(1, Math.ceil(labels.length / 18));
    const minDD   = Math.min(...ddSeries, -0.5);
    const yMin    = Math.floor(minDD * 1.25);

    const pointRadius = labels.map((_, i) =>
      i === peakIndex || i === troughIndex ? 5 : 0);
    const pointBg = labels.map((_, i) =>
      i === peakIndex ? "#d4a843" : i === troughIndex ? "#f85149" : "rgba(0,0,0,0)");

    return new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label:              "Drawdown %",
          data:               ddSeries,
          borderColor:        "#f85149",
          backgroundColor:    "rgba(248,81,73,0.10)",
          borderWidth:        2,
          fill:               true,
          tension:            0.3,
          pointRadius,
          pointBackgroundColor: pointBg,
          pointBorderColor:     pointBg,
          pointBorderWidth:     2,
          pointHoverRadius:     5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => labels[items[0].dataIndex],
              label: (ctx) => {
                const tag = ctx.dataIndex === peakIndex   ? " 🔺 Peak"
                          : ctx.dataIndex === troughIndex ? " 🔻 Trough"
                          : "";
                return "Drawdown: " + ctx.raw.toFixed(2) + "%" + tag;
              },
            },
            backgroundColor: "#1c2330", titleColor: "#e6edf3",
            bodyColor: "#7d8590", borderColor: "#30363d", borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 9 }, color: "#7d8590", maxRotation: 45,
              callback: (_, i) => (i % skip === 0 ? labels[i] : ""),
            },
            grid: { color: "#21262d" },
          },
          y: {
            min: yMin,
            max: 1,
            ticks: {
              font: { size: 9 }, color: "#7d8590",
              callback: (v) => v.toFixed(1) + "%",
            },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });
}

// ── Insight card ──────────────────────────────────────────────
function renderDrawdownInsight(maxDD, currentDD) {
  const el = document.getElementById("dd-insight");
  if (!el) return;
  if (!maxDD) { el.innerHTML = ""; return; }

  const pct    = maxDD * 100;
  const curPct = currentDD * 100;
  let accent, icon, title, note;

  if (pct <= -30) {
    accent = "var(--red)";   icon = "⚠"; title = "High Drawdown Warning";
    note   = `Portfolio experienced a severe drawdown of ${pct.toFixed(1)}% — exceeding 30%. Review position sizing and consider enforcing stop-loss discipline on speculative holdings.`;
  } else if (pct <= -15) {
    accent = "var(--amber)"; icon = "◈"; title = "Moderate Drawdown Observed";
    note   = `A pullback of ${pct.toFixed(1)}% was recorded. This is within the acceptable range for an equity-heavy portfolio. Monitor sector concentration to limit future drawdowns.`;
  } else if (curPct < -5) {
    accent = "var(--blue)";  icon = "ℹ"; title = "Currently Below Peak";
    note   = `Portfolio is ${Math.abs(curPct).toFixed(1)}% below its all-time high. Continue regular SIPs to benefit from rupee cost averaging during this recovery phase.`;
  } else {
    accent = "var(--green)"; icon = "✓"; title = "Healthy Drawdown Profile";
    note   = `Max drawdown is under 15% — a sign of disciplined, diversified investing. Capital preservation is strong across your investment history.`;
  }

  el.innerHTML = `
    <div class="insight-card" style="--ic-accent:${accent}">
      <div class="insight-label">${icon} ${title}</div>
      <div class="insight-value" style="color:${accent}">${pct.toFixed(1)}%</div>
      <div class="insight-note">${note}</div>
    </div>`;
}
