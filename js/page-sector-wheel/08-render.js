// ── page-sector-wheel/08-render.js ──────────────────────────────────────────
// Main renderSectorWheel() orchestrator.
// Depends on: all sibling modules 01–07, common DATA store.
//
// Load order in index.html:
//   page-sector-wheel/01-constants.js
//   page-sector-wheel/02-data.js
//   page-sector-wheel/03-tooltip.js
//   page-sector-wheel/04-wheel-svg.js
//   page-sector-wheel/05-radar-chart.js
//   page-sector-wheel/06-detail-rows.js
//   page-sector-wheel/07-insights.js
//   page-sector-wheel/08-render.js   ← this file (must be last)

// ══════════════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════════════

function renderSectorWheel() {
  const container = document.getElementById("sector-wheel-wrap");
  if (!container) return;

  _swSectorData = null;

  const totalMFInv = DATA.funds.reduce((a, f)  => a + f.Invested, 0);
  const totalSTInv = DATA.stocks.reduce((a, s) => a + s.Invested, 0);
  const totalPort  = totalMFInv + totalSTInv;

  if (!totalPort) {
    container.innerHTML = `
      <div style="color:var(--muted);font-size:12px;padding:40px;text-align:center">
        📂 Upload your Excel files to see the Sector Rotation Wheel
      </div>`;
    return;
  }

  const { mfExp, stExp, combined, grandTotal } = _calcExposures();

  const activeSectors = SW_SECTORS.filter((s) => combined[s.key] > 0);
  const equalWeight   = activeSectors.length > 0 ? 100 / activeSectors.length : 0;
  const sectorData    = _buildSectorData(mfExp, stExp, combined, grandTotal, equalWeight);

  // Store for hover handlers
  _swSectorData = sectorData;

  // Build the page shell first so all target elements exist
  _renderShell(container);

  // Populate each section independently
  _renderKpiCards(sectorData, equalWeight, totalMFInv);
  _drawSectorWheel(sectorData);
  _drawSectorRadar(sectorData, equalWeight);
  _renderSignalLegend();
  _renderDetailRows(sectorData, grandTotal, totalMFInv, totalSTInv);
  _renderWheelInsights(sectorData, equalWeight, grandTotal);

  // Ensure tooltip singleton is in the DOM
  _getSwTooltip();
}

// ══════════════════════════════════════════════════════════════
// SHELL HTML
// ══════════════════════════════════════════════════════════════

function _renderShell(container) {
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px"
         id="sw-kpis"></div>

    <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;margin-bottom:20px">
      <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">
          Sector exposure wheel — combined MF + Stocks
        </div>
        <div id="sw-svg-wrap" style="position:relative"></div>
        <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center"
             id="sw-signal-legend"></div>
      </div>

      <div style="flex:1;min-width:260px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">
          Radar — actual vs equal-weight benchmark
        </div>
        <div style="position:relative;height:300px;max-width:400px">
          <canvas id="chart-sector-radar"></canvas>
        </div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
        Per-sector breakdown with rotation signals
      </div>
      <div id="sw-detail-rows"></div>
    </div>

    <div id="sw-insights" style="margin-top:4px"></div>`;
}

// ══════════════════════════════════════════════════════════════
// KPI CARDS
// ══════════════════════════════════════════════════════════════

function _renderKpiCards(sectorData, equalWeight, totalMFInv) {
  const overweight  = sectorData.filter((s) => s.signal.label.includes("OW") || s.signal.label === "OVERWEIGHT");
  const underweight = sectorData.filter((s) => s.signal.label.includes("UW") || s.signal.label === "UNDERWEIGHT");
  const topSec      = sectorData[0];

  const cards = [
    { l: "Sectors tracked",    v: sectorData.length,            s: "Active in your portfolio",                                     a: "#58a6ff" },
    { l: "Largest exposure",   v: topSec?.label ?? "—",         s: topSec ? `${topSec.pct.toFixed(1)}% of portfolio` : "—",        a: topSec?.color ?? "#d4a843" },
    { l: "Overweight sectors", v: overweight.length  || "—",    s: overweight.length  ? overweight.map((s) => s.label).join(", ")  : "None — balanced", a: "#f85149" },
    { l: "Underweight",        v: underweight.length || "—",    s: underweight.length ? underweight.map((s) => s.label).join(", ") : "None",            a: "#58a6ff" },
    { l: "Equal weight ref",   v: `${equalWeight.toFixed(1)}%`, s: "Per sector, if equally split",                                 a: "#7d8590" },
    { l: "MF implied",         v: fmtL(Math.round(totalMFInv)), s: "Capital in funds",                                            a: "#a371f7" },
  ];

  document.getElementById("sw-kpis").innerHTML = cards
    .map((c) => `
      <div class="kpi-card" style="--accent:${c.a}">
        <div class="kpi-label">${c.l}</div>
        <div class="kpi-value" style="font-size:18px">${c.v}</div>
        <div class="kpi-sub">${c.s}</div>
      </div>`)
    .join("");
}

// ══════════════════════════════════════════════════════════════
// SIGNAL LEGEND
// ══════════════════════════════════════════════════════════════

function _renderSignalLegend() {
  const LEGEND = [
    { label: "OVERWEIGHT",  color: "#f85149", desc: ">150% of EW" },
    { label: "SLIGHT OW",   color: "#e3b341", desc: "115–150%"    },
    { label: "NEUTRAL",     color: "#3fb950", desc: "85–115%"     },
    { label: "SLIGHT UW",   color: "#a371f7", desc: "50–85%"      },
    { label: "UNDERWEIGHT", color: "#58a6ff", desc: "<50% of EW"  },
  ];

  document.getElementById("sw-signal-legend").innerHTML = LEGEND
    .map((s) => `
      <div style="display:flex;align-items:center;gap:5px;font-size:9px">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
        <span style="color:${s.color};font-weight:600">${s.label}</span>
        <span style="color:var(--muted2)">${s.desc}</span>
      </div>`)
    .join("");
}
