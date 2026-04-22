// ── page-sector-wheel.js — Sector Rotation Wheel ────────────────────────────
// FIXES applied:
//   1. MEMORY LEAK — _swSectorData is module-level (not window property).
//   2. MEMORY LEAK — tooltip div created once via _getSwTooltip(), reused.
//   3. CHART LIFECYCLE — _drawSectorRadar() uses scheduleChart().
//   4. XSS / inline handlers — SVG segments built with createElementNS +
//      addEventListener instead of innerHTML with onmouseenter= strings.
//      This eliminates the inline-event-handler XSS vector entirely.

// ── Module-level tooltip node (created once, reused) ─────────
let _swTooltipEl = null;
function _getSwTooltip() {
  if (!_swTooltipEl || !document.body.contains(_swTooltipEl)) {
    const stale = document.getElementById('sw-tooltip-global');
    if (stale) stale.remove();
    _swTooltipEl = document.createElement('div');
    _swTooltipEl.id = 'sw-tooltip-global';
    _swTooltipEl.style.cssText =
      'position:fixed;background:var(--bg3);border:1px solid var(--border2);' +
      'border-radius:8px;padding:10px 14px;font-size:11px;pointer-events:none;' +
      'z-index:1000;display:none;min-width:160px;box-shadow:0 4px 16px rgba(0,0,0,.3)';
    document.body.appendChild(_swTooltipEl);
  }
  return _swTooltipEl;
}

let _swSectorData = null;

// ── Sector config ──────────────────────────────────────────────
const SW_SECTORS = [
  { key: "Banking",        label: "Banking",  color: "#f0883e", icon: "🏦" },
  { key: "IT",             label: "IT",       color: "#79c0ff", icon: "💻" },
  { key: "Energy/PSU",     label: "Energy",   color: "#3fb950", icon: "⚡" },
  { key: "FMCG",           label: "FMCG",     color: "#e3b341", icon: "🛒" },
  { key: "Metals/Mining",  label: "Metals",   color: "#d4a843", icon: "⛏" },
  { key: "Finance/PSU",    label: "Finance",  color: "#a371f7", icon: "📈" },
  { key: "Infra/PSU",      label: "Infra",    color: "#58a6ff", icon: "🏗" },
  { key: "Defence",        label: "Defence",  color: "#56d364", icon: "🛡" },
  { key: "Renewables",     label: "Renew.",   color: "#40d080", icon: "🌱" },
  { key: "Speculative",    label: "Specul.",  color: "#f85149", icon: "🎲" },
  { key: "Consumer Tech",  label: "ConsTech", color: "#ff7eb6", icon: "📱" },
  { key: "Other",          label: "Other",    color: "#7d8590", icon: "◎" },
];

// ── Main render entry ─────────────────────────────────────────
function renderSectorWheel() {
  const container = document.getElementById("sector-wheel-wrap");
  if (!container) return;

  _swSectorData = null;

  const totalMFInv = DATA.funds.reduce((a, f) => a + f.Invested, 0);
  const totalSTInv = DATA.stocks.reduce((a, s) => a + s.Invested, 0);
  const totalPort  = totalMFInv + totalSTInv;

  if (!totalPort) {
    container.innerHTML = `
      <div style="color:var(--muted);font-size:12px;padding:40px;text-align:center">
        📂 Upload your Excel files to see the Sector Rotation Wheel
      </div>`;
    return;
  }

  // ── 1. Compute sector exposures ───────────────────────────
  const mfExp = {};
  DATA.funds.forEach(f => {
    const weights = MF_CAT_SECTOR_WEIGHTS[f.Category] || MF_CAT_SECTOR_WEIGHTS["Other"];
    Object.entries(weights).forEach(([sec, w]) => {
      mfExp[sec] = (mfExp[sec] || 0) + f.Invested * w;
    });
  });

  const stExp = {};
  DATA.stocks.forEach(s => {
    stExp[s.Sector] = (stExp[s.Sector] || 0) + s.Invested;
  });

  const combined = {};
  SW_SECTORS.forEach(({ key }) => {
    combined[key] = (mfExp[key] || 0) + (stExp[key] || 0);
  });

  const grandTotal = Object.values(combined).reduce((a, v) => a + v, 0) || 1;

  const activeSectors = SW_SECTORS.filter(s => combined[s.key] > 0);
  const equalWeight   = activeSectors.length > 0 ? 100 / activeSectors.length : 0;

  function getSignal(pct) {
    if (pct > equalWeight * 1.5)  return { label: "OVERWEIGHT",  color: "#f85149", arrow: "▲▲" };
    if (pct > equalWeight * 1.15) return { label: "SLIGHT OW",   color: "#e3b341", arrow: "▲" };
    if (pct < equalWeight * 0.5)  return { label: "UNDERWEIGHT", color: "#58a6ff", arrow: "▼▼" };
    if (pct < equalWeight * 0.85) return { label: "SLIGHT UW",   color: "#a371f7", arrow: "▼" };
    return { label: "NEUTRAL", color: "#3fb950", arrow: "◆" };
  }

  const sectorData = SW_SECTORS.map(s => {
    const val = combined[s.key] || 0;
    const pct = (val / grandTotal) * 100;
    const mfV = mfExp[s.key] || 0;
    const stV = stExp[s.key] || 0;
    return { ...s, val, pct, mfV, stV, signal: getSignal(pct) };
  })
    .filter(s => s.val > 0)
    .sort((a, b) => b.pct - a.pct);

  _swSectorData = sectorData;

  // ── 4. Build HTML ─────────────────────────────────────────
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px" id="sw-kpis"></div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;margin-bottom:20px">
      <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">
          Sector exposure wheel — combined MF + Stocks
        </div>
        <div id="sw-svg-wrap" style="position:relative"></div>
        <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center" id="sw-signal-legend"></div>
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
    <div id="sw-insights" style="margin-top:4px"></div>
  `;

  const overweight  = sectorData.filter(s => s.signal.label.includes("OW") || s.signal.label === "OVERWEIGHT");
  const underweight = sectorData.filter(s => s.signal.label.includes("UW") || s.signal.label === "UNDERWEIGHT");
  const topSec      = sectorData[0];

  document.getElementById("sw-kpis").innerHTML = [
    { l: "Sectors tracked",    v: sectorData.length,                s: "Active in your portfolio",                                      a: "#58a6ff" },
    { l: "Largest exposure",   v: topSec ? topSec.label : "—",      s: topSec ? topSec.pct.toFixed(1) + "% of portfolio" : "—",         a: topSec?.color || "#d4a843" },
    { l: "Overweight sectors", v: overweight.length || "—",         s: overweight.length ? overweight.map(s => s.label).join(", ") : "None — balanced", a: "#f85149" },
    { l: "Underweight",        v: underweight.length || "—",        s: underweight.length ? underweight.map(s => s.label).join(", ") : "None",           a: "#58a6ff" },
    { l: "Equal weight ref",   v: equalWeight.toFixed(1) + "%",     s: "Per sector, if equally split",                                  a: "#7d8590" },
    { l: "MF implied",         v: fmtL(Math.round(totalMFInv)),     s: "Capital in funds",                                              a: "#a371f7" },
  ]
    .map(c =>
      `<div class="kpi-card" style="--accent:${c.a}">
        <div class="kpi-label">${c.l}</div>
        <div class="kpi-value" style="font-size:18px">${c.v}</div>
        <div class="kpi-sub">${c.s}</div>
      </div>`
    )
    .join("");

  _drawSectorWheel(sectorData, grandTotal);
  _drawSectorRadar(sectorData, equalWeight);

  document.getElementById("sw-signal-legend").innerHTML = [
    { label: "OVERWEIGHT",  color: "#f85149", desc: ">150% of EW" },
    { label: "SLIGHT OW",   color: "#e3b341", desc: "115–150%"    },
    { label: "NEUTRAL",     color: "#3fb950", desc: "85–115%"     },
    { label: "SLIGHT UW",   color: "#a371f7", desc: "50–85%"      },
    { label: "UNDERWEIGHT", color: "#58a6ff", desc: "<50% of EW"  },
  ]
    .map(s =>
      `<div style="display:flex;align-items:center;gap:5px;font-size:9px">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
        <span style="color:${s.color};font-weight:600">${s.label}</span>
        <span style="color:var(--muted2)">${s.desc}</span>
      </div>`
    )
    .join("");

  const maxPct = sectorData[0]?.pct || 1;
  document.getElementById("sw-detail-rows").innerHTML = sectorData
    .map(s => {
      const mfPct = totalMFInv > 0 ? ((s.mfV / totalMFInv) * 100).toFixed(1) : 0;
      const stPct = totalSTInv > 0 ? ((s.stV / totalSTInv) * 100).toFixed(1) : 0;
      const barW  = Math.round((s.pct / maxPct) * 100);
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="font-size:14px;flex-shrink:0">${s.icon}</span>
            <span style="font-size:12px;font-weight:500;min-width:80px;color:var(--text)">${s.label}</span>
            <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${barW}%;background:${s.color};border-radius:4px;transition:width .5s"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:${s.color};min-width:48px;text-align:right">${s.pct.toFixed(1)}%</span>
            <span style="font-size:11px;font-weight:600;color:var(--gold);min-width:80px;text-align:right">${fmtL(Math.round(s.val))}</span>
            <span style="
              font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;
              background:${s.signal.color}18;color:${s.signal.color};
              border:1px solid ${s.signal.color}44;min-width:88px;text-align:center;flex-shrink:0
            ">${s.signal.arrow} ${s.signal.label}</span>
          </div>
          ${s.mfV > 0 ? `
          <div style="display:flex;align-items:center;gap:6px;margin-left:26px;margin-bottom:3px">
            <span style="font-size:9px;color:var(--muted2);min-width:80px">MF implied</span>
            <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;max-width:200px">
              <div style="height:100%;width:${Math.min(100, ((s.mfV / grandTotal) * 10000) | 0)}%;background:#58a6ff;border-radius:2px"></div>
            </div>
            <span style="font-size:10px;color:var(--muted);min-width:56px;text-align:right">${fmtL(Math.round(s.mfV))}</span>
            <span style="font-size:9px;color:var(--muted2);">(${mfPct}% of MF)</span>
          </div>` : ''}
          ${s.stV > 0 ? `
          <div style="display:flex;align-items:center;gap:6px;margin-left:26px">
            <span style="font-size:9px;color:var(--muted2);min-width:80px">Direct stock</span>
            <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;max-width:200px">
              <div style="height:100%;width:${Math.min(100, ((s.stV / grandTotal) * 10000) | 0)}%;background:#a371f7;border-radius:2px"></div>
            </div>
            <span style="font-size:10px;color:var(--muted);min-width:56px;text-align:right">${fmtL(Math.round(s.stV))}</span>
            <span style="font-size:9px;color:var(--muted2);">(${stPct}% of stocks)</span>
          </div>` : ''}
        </div>`;
    })
    .join("");

  _renderWheelInsights(sectorData, equalWeight, grandTotal);
}

// ── Draw SVG donut wheel via DOM API (no innerHTML, no inline handlers) ──────
// FIX: Uses createElementNS + setAttribute + addEventListener throughout.
// This eliminates both the XSS risk from innerHTML-injected SVG and the
// inline-handler fragility noted in issues #1 and #2.
function _drawSectorWheel(sectorData, grandTotal) {
  const wrap = document.getElementById("sw-svg-wrap");
  if (!wrap) return;

  const SIZE  = 300, CX = SIZE / 2, CY = SIZE / 2;
  const R_OUT = 120, R_IN = 68;
  const GAP   = 1.5;

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Create the SVG element via DOM
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("width", String(SIZE));
  svg.setAttribute("height", String(SIZE));
  svg.id = "sw-svg";

  const toRad = d => (d * Math.PI) / 180;
  const polar = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  let angle = -90;

  sectorData.forEach(s => {
    const sweep = (s.pct / 100) * 360 - GAP;
    if (sweep <= 0) return;
    const a1 = angle + GAP / 2;
    const a2 = a1 + sweep;
    angle    = a2 + GAP / 2;

    const p1 = polar(CX, CY, R_IN,      a1);
    const p2 = polar(CX, CY, R_OUT,     a1);
    const p3 = polar(CX, CY, R_OUT,     a2);
    const p4 = polar(CX, CY, R_IN,      a2);
    const p2s= polar(CX, CY, R_OUT - 6, a1);
    const p3s= polar(CX, CY, R_OUT - 6, a2);
    const p2e= polar(CX, CY, R_OUT,     a1);
    const p3e= polar(CX, CY, R_OUT,     a2);
    const la = sweep > 180 ? 1 : 0;
    const sigClr = s.signal.color;

    // Main segment path
    const segPath = document.createElementNS(SVG_NS, "path");
    segPath.setAttribute("d",
      `M${p1.x.toFixed(2)},${p1.y.toFixed(2)}` +
      `L${p2.x.toFixed(2)},${p2.y.toFixed(2)}` +
      `A${R_OUT},${R_OUT} 0 ${la},1 ${p3.x.toFixed(2)},${p3.y.toFixed(2)}` +
      `L${p4.x.toFixed(2)},${p4.y.toFixed(2)}` +
      `A${R_IN},${R_IN}   0 ${la},0 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}Z`
    );
    segPath.setAttribute("fill", s.color);
    segPath.setAttribute("opacity", "0.85");
    segPath.setAttribute("class", "sw-segment");
    segPath.dataset.sector = s.key;
    segPath.style.cursor = "pointer";
    segPath.style.transition = "opacity .2s";

    // FIX: addEventListener replaces inline onmouseenter/onmouseleave strings
    const sKey = s.key; // close over stable value
    segPath.addEventListener("mouseenter", function(e) { swHighlight(this, sKey); });
    segPath.addEventListener("mouseleave", swUnhighlight);

    svg.appendChild(segPath);

    // Signal colour arc (outer ring)
    const sigPath = document.createElementNS(SVG_NS, "path");
    sigPath.setAttribute("d",
      `M${p2s.x.toFixed(2)},${p2s.y.toFixed(2)}` +
      `A${R_OUT - 6},${R_OUT - 6} 0 ${la},1 ${p3s.x.toFixed(2)},${p3s.y.toFixed(2)}` +
      `L${p3e.x.toFixed(2)},${p3e.y.toFixed(2)}` +
      `A${R_OUT},${R_OUT}         0 ${la},0 ${p2e.x.toFixed(2)},${p2e.y.toFixed(2)}Z`
    );
    sigPath.setAttribute("fill", sigClr);
    sigPath.setAttribute("opacity", "0.70");
    sigPath.setAttribute("pointer-events", "none");
    svg.appendChild(sigPath);

    // Label text
    if (sweep > 18) {
      const midAngle = a1 + sweep / 2;
      const lp = polar(CX, CY, (R_IN + R_OUT) / 2, midAngle);
      const txt = document.createElementNS(SVG_NS, "text");
      txt.setAttribute("x", lp.x.toFixed(2));
      txt.setAttribute("y", lp.y.toFixed(2));
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("dominant-baseline", "middle");
      txt.setAttribute("font-size", sweep > 30 ? "9" : "8");
      txt.setAttribute("fill", "#fff");
      txt.setAttribute("font-family", "DM Mono,monospace");
      txt.setAttribute("font-weight", "600");
      txt.setAttribute("pointer-events", "none");
      txt.style.textShadow = "0 1px 3px rgba(0,0,0,.6)";
      // Use textContent — safe, no XSS
      txt.textContent = s.label.slice(0, 7);
      svg.appendChild(txt);
    }
  });

  // Centre hole
  const hole = document.createElementNS(SVG_NS, "circle");
  hole.setAttribute("cx", String(CX));
  hole.setAttribute("cy", String(CY));
  hole.setAttribute("r", String(R_IN));
  hole.setAttribute("fill", "var(--bg2)");
  svg.appendChild(hole);

  // Centre labels
  const topSec = sectorData[0];

  const lblTop = document.createElementNS(SVG_NS, "text");
  lblTop.setAttribute("x", String(CX));
  lblTop.setAttribute("y", String(CY - 14));
  lblTop.setAttribute("text-anchor", "middle");
  lblTop.setAttribute("font-size", "10");
  lblTop.setAttribute("fill", "var(--muted)");
  lblTop.setAttribute("font-family", "DM Mono,monospace");
  lblTop.textContent = "TOP SECTOR";
  svg.appendChild(lblTop);

  const lblName = document.createElementNS(SVG_NS, "text");
  lblName.setAttribute("x", String(CX));
  lblName.setAttribute("y", String(CY + 4));
  lblName.setAttribute("text-anchor", "middle");
  lblName.setAttribute("font-size", "13");
  lblName.setAttribute("fill", topSec?.color || "#d4a843");
  lblName.setAttribute("font-family", "Syne,sans-serif");
  lblName.setAttribute("font-weight", "700");
  lblName.textContent = topSec?.label || "—";
  svg.appendChild(lblName);

  const lblPct = document.createElementNS(SVG_NS, "text");
  lblPct.setAttribute("x", String(CX));
  lblPct.setAttribute("y", String(CY + 20));
  lblPct.setAttribute("text-anchor", "middle");
  lblPct.setAttribute("font-size", "11");
  lblPct.setAttribute("fill", topSec?.color || "#7d8590");
  lblPct.setAttribute("font-family", "DM Mono,monospace");
  lblPct.textContent = topSec ? topSec.pct.toFixed(1) + "%" : "";
  svg.appendChild(lblPct);

  // Replace existing content
  wrap.innerHTML = "";
  wrap.appendChild(svg);

  // Ensure the tooltip element exists
  _getSwTooltip();
}

// ── Wheel interaction ─────────────────────────────────────────
function swHighlight(el, sectorKey) {
  document.querySelectorAll(".sw-segment").forEach(s => {
    s.style.opacity = s.dataset.sector === sectorKey ? "1" : "0.35";
  });

  const s  = (_swSectorData || []).find(d => d.key === sectorKey);
  const tt = _getSwTooltip();
  if (!s || !tt) return;

  // Build tooltip via DOM, not innerHTML, to avoid XSS from fund/sector names
  tt.innerHTML = "";
  const title = document.createElement("div");
  title.style.cssText = `font-weight:700;color:${s.color};margin-bottom:6px;font-size:13px`;
  title.textContent = s.icon + " " + s.label;
  tt.appendChild(title);

  const makeRow = (label, val, valColor) => {
    const row = document.createElement("div");
    row.style.cssText = "color:var(--muted);margin-bottom:3px";
    const lspan = document.createTextNode(label + ": ");
    const vspan = document.createElement("span");
    vspan.style.cssText = `color:${valColor || "var(--text)"};font-weight:600`;
    vspan.textContent = val;
    row.append(lspan, vspan);
    return row;
  };

  tt.appendChild(makeRow("Total exposure", s.pct.toFixed(2) + "%"));
  tt.appendChild(makeRow("Amount", fmtL(Math.round(s.val)), "var(--gold)"));
  if (s.mfV > 0) tt.appendChild(makeRow("Via MF", fmtL(Math.round(s.mfV)), "#58a6ff"));
  if (s.stV > 0) tt.appendChild(makeRow("Direct", fmtL(Math.round(s.stV)), "#a371f7"));

  const sig = document.createElement("div");
  sig.style.cssText = `font-size:9px;font-weight:700;color:${s.signal.color};margin-top:6px;padding:3px 0;border-top:1px solid var(--border)`;
  sig.textContent = s.signal.arrow + " " + s.signal.label;
  tt.appendChild(sig);

  tt.style.display = "block";

  const svgWrap = document.getElementById("sw-svg-wrap");
  if (svgWrap) {
    const rect = svgWrap.getBoundingClientRect();
    tt.style.left = rect.right + 12 + "px";
    tt.style.top  = rect.top + rect.height / 2 - 60 + "px";
  }
}

function swUnhighlight() {
  document.querySelectorAll(".sw-segment").forEach(s => (s.style.opacity = "0.85"));
  const tt = _getSwTooltip();
  if (tt) tt.style.display = "none";
}

// ── Radar chart ───────────────────────────────────────────────
function _drawSectorRadar(sectorData, equalWeight) {
  scheduleChart("chart-sector-radar", 60, el => {
    if (!window.Chart) return null;

    const labels    = sectorData.map(s => s.label);
    const actuals   = sectorData.map(s => parseFloat(s.pct.toFixed(2)));
    const benchmark = sectorData.map(() => parseFloat(equalWeight.toFixed(2)));
    const colors    = sectorData.map(s => s.color);

    return new Chart(el, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Your portfolio %",
            data: actuals,
            borderColor: "#d4a843",
            backgroundColor: "rgba(212,168,67,.15)",
            borderWidth: 2,
            pointBackgroundColor: colors,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Equal-weight benchmark",
            data: benchmark,
            borderColor: "#58a6ff",
            backgroundColor: "rgba(88,166,255,.05)",
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointBackgroundColor: "#58a6ff",
            pointRadius: 2,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: "#7d8590", font: { size: 10 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: { label: ctx => ctx.dataset.label + ": " + ctx.raw.toFixed(2) + "%" },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          r: {
            ticks: {
              font: { size: 8 },
              color: "#7d8590",
              backdropColor: "transparent",
              callback: v => v + "%",
            },
            grid: { color: "rgba(255,255,255,.08)" },
            angleLines: { color: "rgba(255,255,255,.06)" },
            pointLabels: { color: "#7d8590", font: { size: 9 } },
          },
        },
      },
    });
  });
}

// ── Narrative insights ────────────────────────────────────────
function _renderWheelInsights(sectorData, equalWeight, grandTotal) {
  const el = document.getElementById("sw-insights");
  if (!el) return;

  const insights  = [];
  const overweight  = sectorData.filter(s => s.signal.label === "OVERWEIGHT");
  const underweight = sectorData.filter(s => s.signal.label === "UNDERWEIGHT");
  const neutral     = sectorData.filter(s => s.signal.label === "NEUTRAL");

  if (overweight.length) {
    const names = overweight.map(s => s.label).join(", ");
    const amt   = overweight.reduce((a, s) => a + s.val, 0);
    insights.push({
      icon: "⚠", color: "#f85149",
      title: `${overweight.length} overweight sector${overweight.length > 1 ? "s" : ""}`,
      body: `${names} collectively hold ${fmtL(Math.round(amt))} — more than 1.5× the equal-weight benchmark of ${equalWeight.toFixed(1)}%. A sector-specific downturn would disproportionately impact your portfolio.`,
    });
  }

  if (underweight.length) {
    const names = underweight.map(s => s.label).join(", ");
    insights.push({
      icon: "◎", color: "#58a6ff",
      title: `${underweight.length} underweight sector${underweight.length > 1 ? "s" : ""}`,
      body: `${names} are underrepresented vs a balanced portfolio. This may be intentional (bearish view) or a blind spot in your MF selection.`,
    });
  }

  const topTwo    = sectorData.slice(0, 2);
  const topTwoPct = topTwo.reduce((a, s) => a + s.pct, 0);
  if (topTwoPct > 40) {
    insights.push({
      icon: "📊", color: "#e3b341",
      title: `Top 2 sectors are ${topTwoPct.toFixed(1)}% of your portfolio`,
      body: `${topTwo.map(s => s.label).join(" + ")} dominate your combined exposure. High concentration in 2 sectors increases correlation risk.`,
    });
  }

  if (neutral.length >= 4) {
    insights.push({
      icon: "✓", color: "#3fb950",
      title: `${neutral.length} sectors are neutrally weighted`,
      body: `Good balance across ${neutral.map(s => s.label).join(", ")}. These are near your equal-weight benchmark.`,
    });
  }

  const bankSec    = sectorData.find(s => s.key === "Banking");
  const financeSec = sectorData.find(s => s.key === "Finance/PSU");
  if (bankSec && financeSec) {
    const combinedPct = bankSec.pct + financeSec.pct;
    if (combinedPct > 30) {
      insights.push({
        icon: "🏦", color: "#f0883e",
        title: `Banking + Finance = ${combinedPct.toFixed(1)}% combined`,
        body: `These two closely correlated sectors together form a very large share of your portfolio. An RBI policy shift or NPA cycle would hit both simultaneously.`,
      });
    }
  }

  if (!insights.length) {
    insights.push({
      icon: "🏆", color: "#3fb950",
      title: "Well-balanced sector allocation",
      body: "No major over- or under-weights detected. Your portfolio has broad sector diversification.",
    });
  }

  el.innerHTML = `
    <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
      Rotation insights
    </div>
    ${insights.map(ins => `
      <div style="
        display:flex;gap:12px;align-items:flex-start;
        padding:12px;margin-bottom:8px;
        background:${ins.color}10;border-left:3px solid ${ins.color};
        border-radius:0 6px 6px 0
      ">
        <span style="font-size:20px;flex-shrink:0">${ins.icon}</span>
        <div>
          <div style="font-size:12px;font-weight:600;color:${ins.color};margin-bottom:4px">${ins.title}</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.65">${ins.body}</div>
        </div>
      </div>
    `).join("")}
    <div style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6;padding:8px;background:var(--bg3);border-radius:6px;border:1px solid var(--border)">
      ⓘ MF sector exposure is estimated from typical index category weights — actual fund holdings vary.
      Equal-weight benchmark divides 100% equally across all sectors you hold.
    </div>`;
}
