// ── page-sector-wheel.js — Sector Rotation Wheel ────────────────────────────
// Renders an interactive SVG sector wheel combining:
//   • Implied MF sector exposure (from MF_CAT_SECTOR_WEIGHTS in analytics)
//   • Direct stock sector exposure
// Shows rotation signals: overweight / neutral / underweight vs equal-weight benchmark.

// ── Sector config ──────────────────────────────────────────────
const SW_SECTORS = [
  { key: 'Banking',         label: 'Banking',       color: '#f0883e', icon: '🏦' },
  { key: 'IT',              label: 'IT',             color: '#79c0ff', icon: '💻' },
  { key: 'Energy/PSU',      label: 'Energy',         color: '#3fb950', icon: '⚡' },
  { key: 'FMCG',            label: 'FMCG',           color: '#e3b341', icon: '🛒' },
  { key: 'Metals/Mining',   label: 'Metals',         color: '#d4a843', icon: '⛏' },
  { key: 'Finance/PSU',     label: 'Finance',        color: '#a371f7', icon: '📈' },
  { key: 'Infra/PSU',       label: 'Infra',          color: '#58a6ff', icon: '🏗' },
  { key: 'Defence',         label: 'Defence',        color: '#56d364', icon: '🛡' },
  { key: 'Renewables',      label: 'Renew.',         color: '#40d080', icon: '🌱' },
  { key: 'Speculative',     label: 'Specul.',        color: '#f85149', icon: '🎲' },
  { key: 'Consumer Tech',   label: 'ConsTech',       color: '#ff7eb6', icon: '📱' },
  { key: 'Other',           label: 'Other',          color: '#7d8590', icon: '◎'  },
];

// Reuse MF_CAT_SECTOR_WEIGHTS from page-analytics.js (loaded earlier)
const _SW_CAT_WEIGHTS = typeof MF_CAT_SECTOR_WEIGHTS !== 'undefined'
  ? MF_CAT_SECTOR_WEIGHTS
  : {
    'Large Cap':  { Banking:0.30, IT:0.18, 'Energy/PSU':0.12, FMCG:0.10, 'Metals/Mining':0.08, Other:0.22 },
    'Mid Cap':    { Banking:0.15, IT:0.12, 'Infra/PSU':0.12,  'Metals/Mining':0.10, Defence:0.08, Other:0.43 },
    'Small Cap':  { 'Infra/PSU':0.12, 'Metals/Mining':0.10, Defence:0.09, Renewables:0.08, Other:0.61 },
    'Flexi Cap':  { Banking:0.22, IT:0.16, FMCG:0.10, 'Energy/PSU':0.10, Other:0.42 },
    'ELSS':       { Banking:0.25, IT:0.16, FMCG:0.10, Other:0.49 },
    'Value':      { Banking:0.20, 'Energy/PSU':0.14, FMCG:0.12, Other:0.54 },
    'Index':      { Banking:0.33, IT:0.17, 'Energy/PSU':0.12, FMCG:0.09, Other:0.29 },
    'Other':      { Banking:0.20, IT:0.15, Other:0.65 },
  };

// ── Main render entry ─────────────────────────────────────────
function renderSectorWheel() {
  const container = document.getElementById('sector-wheel-wrap');
  if (!container) return;

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
  const mfExp = {}; // implied ₹ via MF categories
  DATA.funds.forEach(f => {
    const weights = _SW_CAT_WEIGHTS[f.Category] || _SW_CAT_WEIGHTS['Other'];
    Object.entries(weights).forEach(([sec, w]) => {
      mfExp[sec] = (mfExp[sec] || 0) + f.Invested * w;
    });
  });

  const stExp = {}; // direct ₹ from stocks
  DATA.stocks.forEach(s => {
    stExp[s.Sector] = (stExp[s.Sector] || 0) + s.Invested;
  });

  // Combined per sector
  const combined = {};
  SW_SECTORS.forEach(({ key }) => {
    combined[key] = (mfExp[key] || 0) + (stExp[key] || 0);
  });

  const grandTotal = Object.values(combined).reduce((a, v) => a + v, 0) || 1;

  // ── 2. Equal-weight benchmark ─────────────────────────────
  const activeSectors = SW_SECTORS.filter(s => combined[s.key] > 0);
  const equalWeight   = activeSectors.length > 0 ? 100 / activeSectors.length : 0;

  // ── 3. Rotation signal per sector ─────────────────────────
  function getSignal(pct) {
    if (pct > equalWeight * 1.5)  return { label: 'OVERWEIGHT',   color: '#f85149', arrow: '▲▲' };
    if (pct > equalWeight * 1.15) return { label: 'SLIGHT OW',    color: '#e3b341', arrow: '▲'  };
    if (pct < equalWeight * 0.5)  return { label: 'UNDERWEIGHT',  color: '#58a6ff', arrow: '▼▼' };
    if (pct < equalWeight * 0.85) return { label: 'SLIGHT UW',    color: '#a371f7', arrow: '▼'  };
    return                               { label: 'NEUTRAL',       color: '#3fb950', arrow: '◆'  };
  }

  // Sector data array with % of total
  const sectorData = SW_SECTORS.map(s => {
    const val  = combined[s.key] || 0;
    const pct  = (val / grandTotal) * 100;
    const mfV  = (mfExp[s.key] || 0);
    const stV  = (stExp[s.key] || 0);
    const sig  = getSignal(pct);
    return { ...s, val, pct, mfV, stV, signal: sig };
  }).filter(s => s.val > 0).sort((a, b) => b.pct - a.pct);

  // ── 4. Build HTML ─────────────────────────────────────────
  container.innerHTML = `
    <!-- KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px" id="sw-kpis"></div>

    <!-- Main layout: wheel + legend side by side -->
    <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;margin-bottom:20px">

      <!-- SVG wheel -->
      <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">
          Sector exposure wheel — combined MF + Stocks
        </div>
        <div id="sw-svg-wrap" style="position:relative"></div>
        <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center" id="sw-signal-legend"></div>
      </div>

      <!-- Radar chart -->
      <div style="flex:1;min-width:260px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">
          Radar — actual vs equal-weight benchmark
        </div>
        <div style="position:relative;height:300px;max-width:400px">
          <canvas id="chart-sector-radar"></canvas>
        </div>
      </div>
    </div>

    <!-- Sector detail table -->
    <div style="margin-bottom:16px">
      <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
        Per-sector breakdown with rotation signals
      </div>
      <div id="sw-detail-rows"></div>
    </div>

    <!-- Insights -->
    <div id="sw-insights" style="margin-top:4px"></div>
  `;

  // ── 5. Populate KPIs ──────────────────────────────────────
  const overweight  = sectorData.filter(s => s.signal.label.includes('OW') || s.signal.label === 'OVERWEIGHT');
  const underweight = sectorData.filter(s => s.signal.label.includes('UW') || s.signal.label === 'UNDERWEIGHT');
  const topSec      = sectorData[0];
  const mostConc    = sectorData.reduce((a, s) => s.pct > a.pct ? s : a, sectorData[0]);

  document.getElementById('sw-kpis').innerHTML = [
    { l: 'Sectors tracked',   v: sectorData.length,                         s: 'Active in your portfolio',   a: '#58a6ff' },
    { l: 'Largest exposure',  v: topSec ? topSec.label : '—',               s: topSec ? topSec.pct.toFixed(1) + '% of portfolio' : '—', a: topSec?.color || '#d4a843' },
    { l: 'Overweight sectors',v: overweight.length || '—',                  s: overweight.length ? overweight.map(s=>s.label).join(', ') : 'None — balanced', a: '#f85149' },
    { l: 'Underweight',       v: underweight.length || '—',                 s: underweight.length ? underweight.map(s=>s.label).join(', ') : 'None', a: '#58a6ff' },
    { l: 'Equal weight ref',  v: equalWeight.toFixed(1) + '%',              s: 'Per sector, if equally split', a: '#7d8590' },
    { l: 'MF implied',        v: fmtL(Math.round(totalMFInv)),              s: 'Capital in funds',            a: '#a371f7' },
  ].map(c =>
    `<div class="kpi-card" style="--accent:${c.a}">
      <div class="kpi-label">${c.l}</div>
      <div class="kpi-value" style="font-size:18px">${c.v}</div>
      <div class="kpi-sub">${c.s}</div>
    </div>`
  ).join('');

  // ── 6. Draw SVG donut wheel ───────────────────────────────
  _drawSectorWheel(sectorData, grandTotal);

  // ── 7. Radar chart ────────────────────────────────────────
  _drawSectorRadar(sectorData, equalWeight);

  // ── 8. Signal legend ──────────────────────────────────────
  document.getElementById('sw-signal-legend').innerHTML = [
    { label: 'OVERWEIGHT',  color: '#f85149', desc: '>150% of EW' },
    { label: 'SLIGHT OW',   color: '#e3b341', desc: '115–150%' },
    { label: 'NEUTRAL',     color: '#3fb950', desc: '85–115%' },
    { label: 'SLIGHT UW',   color: '#a371f7', desc: '50–85%' },
    { label: 'UNDERWEIGHT', color: '#58a6ff', desc: '<50% of EW' },
  ].map(s =>
    `<div style="display:flex;align-items:center;gap:5px;font-size:9px">
      <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
      <span style="color:${s.color};font-weight:600">${s.label}</span>
      <span style="color:var(--muted2)">${s.desc}</span>
    </div>`
  ).join('');

  // ── 9. Detail rows ────────────────────────────────────────
  const maxPct = sectorData[0]?.pct || 1;
  document.getElementById('sw-detail-rows').innerHTML = sectorData.map(s => {
    const mfPct = totalMFInv > 0 ? (s.mfV / totalMFInv * 100).toFixed(1) : 0;
    const stPct = totalSTInv > 0 ? (s.stV / totalSTInv * 100).toFixed(1) : 0;
    const barW  = Math.round(s.pct / maxPct * 100);
    const mfBarW = Math.round(s.mfV / (mfExp[s.key] > 0 ? grandTotal : 1) * 100);
    const stBarW = Math.round(s.stV / (stExp[s.key] > 0 ? grandTotal : 1) * 100);

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
        <!-- Sub-bars: MF implied vs direct stock -->
        ${s.mfV > 0 ? `
        <div style="display:flex;align-items:center;gap:6px;margin-left:26px;margin-bottom:3px">
          <span style="font-size:9px;color:var(--muted2);min-width:80px">MF implied</span>
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;max-width:200px">
            <div style="height:100%;width:${Math.min(100,s.mfV/grandTotal*100/0.01|0)}%;background:#58a6ff;border-radius:2px"></div>
          </div>
          <span style="font-size:10px;color:var(--muted);min-width:56px;text-align:right">${fmtL(Math.round(s.mfV))}</span>
          <span style="font-size:9px;color:var(--muted2);">(${mfPct}% of MF)</span>
        </div>` : ''}
        ${s.stV > 0 ? `
        <div style="display:flex;align-items:center;gap:6px;margin-left:26px">
          <span style="font-size:9px;color:var(--muted2);min-width:80px">Direct stock</span>
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;max-width:200px">
            <div style="height:100%;width:${Math.min(100,s.stV/grandTotal*100/0.01|0)}%;background:#a371f7;border-radius:2px"></div>
          </div>
          <span style="font-size:10px;color:var(--muted);min-width:56px;text-align:right">${fmtL(Math.round(s.stV))}</span>
          <span style="font-size:9px;color:var(--muted2);">(${stPct}% of stocks)</span>
        </div>` : ''}
      </div>`;
  }).join('');

  // ── 10. Insights ─────────────────────────────────────────
  _renderWheelInsights(sectorData, equalWeight, grandTotal);
}

// ── Draw SVG donut wheel ──────────────────────────────────────
function _drawSectorWheel(sectorData, grandTotal) {
  const wrap = document.getElementById('sw-svg-wrap');
  if (!wrap) return;

  const SIZE  = 300;
  const CX    = SIZE / 2;
  const CY    = SIZE / 2;
  const R_OUT = 120;     // outer ring
  const R_IN  = 68;      // inner hole
  const R_MID = 94;      // midpoint for signal ring
  const GAP   = 1.5;     // degrees gap between segments

  let angle = -90; // start at top
  let paths = '';
  let labels = '';

  const toRad = d => d * Math.PI / 180;
  const polar = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  sectorData.forEach((s, i) => {
    const sweep   = s.pct / 100 * 360 - GAP;
    if (sweep <= 0) return;
    const a1 = angle + GAP / 2;
    const a2 = a1 + sweep;
    angle    = a2 + GAP / 2;

    const p1 = polar(CX, CY, R_IN,  a1);
    const p2 = polar(CX, CY, R_OUT, a1);
    const p3 = polar(CX, CY, R_OUT, a2);
    const p4 = polar(CX, CY, R_IN,  a2);
    const la = sweep > 180 ? 1 : 0;
    const sigClr = s.signal.color;

    // Outer signal ring accent (thin band at edge)
    const p2s = polar(CX, CY, R_OUT - 6, a1);
    const p3s = polar(CX, CY, R_OUT - 6, a2);
    const p2e = polar(CX, CY, R_OUT,     a1);
    const p3e = polar(CX, CY, R_OUT,     a2);

    paths += `
      <path
        d="M${p1.x.toFixed(2)},${p1.y.toFixed(2)}
           L${p2.x.toFixed(2)},${p2.y.toFixed(2)}
           A${R_OUT},${R_OUT} 0 ${la},1 ${p3.x.toFixed(2)},${p3.y.toFixed(2)}
           L${p4.x.toFixed(2)},${p4.y.toFixed(2)}
           A${R_IN},${R_IN}   0 ${la},0 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}Z"
        fill="${s.color}" opacity="0.85"
        class="sw-segment" data-sector="${esc(s.key)}"
        style="cursor:pointer;transition:opacity .2s"
        onmouseenter="swHighlight(this,'${esc(s.key)}')"
        onmouseleave="swUnhighlight()"
      />
      <!-- Signal accent ring -->
      <path
        d="M${p2s.x.toFixed(2)},${p2s.y.toFixed(2)}
           A${R_OUT-6},${R_OUT-6} 0 ${la},1 ${p3s.x.toFixed(2)},${p3s.y.toFixed(2)}
           L${p3e.x.toFixed(2)},${p3e.y.toFixed(2)}
           A${R_OUT},${R_OUT}     0 ${la},0 ${p2e.x.toFixed(2)},${p2e.y.toFixed(2)}Z"
        fill="${sigClr}" opacity="0.70" pointer-events="none"
      />`;

    // Label at midpoint of arc (only if segment is large enough)
    if (sweep > 18) {
      const midAngle = a1 + sweep / 2;
      const lp = polar(CX, CY, (R_IN + R_OUT) / 2, midAngle);
      labels += `
        <text
          x="${lp.x.toFixed(2)}" y="${lp.y.toFixed(2)}"
          text-anchor="middle" dominant-baseline="middle"
          font-size="${sweep > 30 ? 9 : 8}"
          fill="#fff" font-family="DM Mono,monospace"
          font-weight="600" pointer-events="none"
          style="text-shadow:0 1px 3px rgba(0,0,0,.6)"
        >${s.label.slice(0, 7)}</text>`;
    }
  });

  // Centre text
  const topSec = sectorData[0];
  const centre = `
    <text x="${CX}" y="${CY - 14}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="DM Mono,monospace">TOP SECTOR</text>
    <text x="${CX}" y="${CY + 4}"  text-anchor="middle" font-size="13" fill="${topSec?.color || '#d4a843'}" font-family="Syne,sans-serif" font-weight="700">${topSec?.label || '—'}</text>
    <text x="${CX}" y="${CY + 20}" text-anchor="middle" font-size="11" fill="${topSec?.color || '#7d8590'}" font-family="DM Mono,monospace">${topSec ? topSec.pct.toFixed(1) + '%' : ''}</text>
    `;

  wrap.innerHTML = `
    <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg" id="sw-svg">
      ${paths}
      <circle cx="${CX}" cy="${CY}" r="${R_IN}" fill="var(--bg2)"/>
      ${centre}
      ${labels}
    </svg>
    <div id="sw-tooltip" style="
      position:fixed;background:var(--bg3);border:1px solid var(--border2);
      border-radius:8px;padding:10px 14px;font-size:11px;pointer-events:none;
      z-index:1000;display:none;min-width:160px;box-shadow:0 4px 16px rgba(0,0,0,.3)
    "></div>`;

  // Store sector data for tooltip
  window._swSectorData = sectorData;
}

// ── Wheel interaction ──────────────────────────────────────────
function swHighlight(el, sectorKey) {
  document.querySelectorAll('.sw-segment').forEach(s => {
    s.style.opacity = s.dataset.sector === sectorKey ? '1' : '0.35';
  });

  const s   = (window._swSectorData || []).find(d => d.key === sectorKey);
  const tt  = document.getElementById('sw-tooltip');
  if (!s || !tt) return;

  tt.innerHTML = `
    <div style="font-weight:700;color:${s.color};margin-bottom:6px;font-size:13px">${s.icon} ${s.label}</div>
    <div style="color:var(--muted);margin-bottom:3px">Total exposure: <span style="color:var(--text);font-weight:600">${s.pct.toFixed(2)}%</span></div>
    <div style="color:var(--muted);margin-bottom:3px">Amount: <span style="color:var(--gold);font-weight:600">${fmtL(Math.round(s.val))}</span></div>
    ${s.mfV > 0 ? `<div style="color:var(--muted);margin-bottom:2px">Via MF: <span style="color:#58a6ff">${fmtL(Math.round(s.mfV))}</span></div>` : ''}
    ${s.stV > 0 ? `<div style="color:var(--muted);margin-bottom:4px">Direct: <span style="color:#a371f7">${fmtL(Math.round(s.stV))}</span></div>` : ''}
    <div style="font-size:9px;font-weight:700;color:${s.signal.color};margin-top:6px;padding:3px 0;border-top:1px solid var(--border)">
      ${s.signal.arrow} ${s.signal.label}
    </div>`;
  tt.style.display = 'block';

  // Position relative to SVG wrap
  const wrap = document.getElementById('sw-svg-wrap');
  if (wrap) {
    const rect = wrap.getBoundingClientRect();
    tt.style.left = (rect.right + 12) + 'px';
    tt.style.top  = (rect.top + rect.height / 2 - 60) + 'px';
  }
}

function swUnhighlight() {
  document.querySelectorAll('.sw-segment').forEach(s => s.style.opacity = '0.85');
  const tt = document.getElementById('sw-tooltip');
  if (tt) tt.style.display = 'none';
}

// ── Radar chart ────────────────────────────────────────────────
function _drawSectorRadar(sectorData, equalWeight) {
  const el = document.getElementById('chart-sector-radar');
  if (!el || !window.Chart) return;
  if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }

  const labels = sectorData.map(s => s.label);
  const actuals = sectorData.map(s => parseFloat(s.pct.toFixed(2)));
  const benchmark = sectorData.map(() => parseFloat(equalWeight.toFixed(2)));
  const colors = sectorData.map(s => s.color);

  el._chartInst = new Chart(el, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'Your portfolio %',
          data: actuals,
          borderColor: '#d4a843',
          backgroundColor: 'rgba(212,168,67,.15)',
          borderWidth: 2,
          pointBackgroundColor: colors,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Equal-weight benchmark',
          data: benchmark,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88,166,255,.05)',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointBackgroundColor: '#58a6ff',
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
          display: true, position: 'top',
          labels: { color: '#7d8590', font: { size: 10 }, boxWidth: 12, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%',
          },
          backgroundColor: '#1c2330', titleColor: '#e6edf3',
          bodyColor: '#7d8590', borderColor: '#30363d', borderWidth: 1,
        },
      },
      scales: {
        r: {
          ticks: {
            font: { size: 8 }, color: '#7d8590',
            backdropColor: 'transparent',
            callback: v => v + '%',
          },
          grid:        { color: 'rgba(255,255,255,.08)' },
          angleLines:  { color: 'rgba(255,255,255,.06)' },
          pointLabels: { color: '#7d8590', font: { size: 9 } },
        },
      },
    },
  });
}

// ── Narrative insights ─────────────────────────────────────────
function _renderWheelInsights(sectorData, equalWeight, grandTotal) {
  const el = document.getElementById('sw-insights');
  if (!el) return;

  const insights = [];
  const overweight  = sectorData.filter(s => s.signal.label === 'OVERWEIGHT');
  const underweight = sectorData.filter(s => s.signal.label === 'UNDERWEIGHT');
  const neutral     = sectorData.filter(s => s.signal.label === 'NEUTRAL');

  if (overweight.length) {
    const names = overweight.map(s => s.label).join(', ');
    const amt   = overweight.reduce((a, s) => a + s.val, 0);
    insights.push({
      icon: '⚠',
      color: '#f85149',
      title: `${overweight.length} overweight sector${overweight.length > 1 ? 's' : ''}`,
      body: `${names} collectively hold ${fmtL(Math.round(amt))} — more than 1.5× the equal-weight benchmark of ${equalWeight.toFixed(1)}%. A sector-specific downturn (regulation, earnings miss, commodity cycle) would disproportionately impact your portfolio.`,
    });
  }

  if (underweight.length) {
    const names = underweight.map(s => s.label).join(', ');
    insights.push({
      icon: '◎',
      color: '#58a6ff',
      title: `${underweight.length} underweight sector${underweight.length > 1 ? 's' : ''}`,
      body: `${names} are underrepresented vs a balanced portfolio. This may be intentional (bearish view) or a blind spot in your MF selection. Consider whether you want explicit exposure or if your current MFs already provide it.`,
    });
  }

  const topTwo   = sectorData.slice(0, 2);
  const topTwoPct = topTwo.reduce((a, s) => a + s.pct, 0);
  if (topTwoPct > 40) {
    insights.push({
      icon: '📊',
      color: '#e3b341',
      title: `Top 2 sectors are ${topTwoPct.toFixed(1)}% of your portfolio`,
      body: `${topTwo.map(s => s.label).join(' + ')} dominate your combined exposure. High concentration in 2 sectors increases correlation risk — when one falls the other often follows.`,
    });
  }

  if (neutral.length >= 4) {
    insights.push({
      icon: '✓',
      color: '#3fb950',
      title: `${neutral.length} sectors are neutrally weighted`,
      body: `Good balance across ${neutral.map(s => s.label).join(', ')}. These are near your equal-weight benchmark — efficient risk diversification with no blind spots.`,
    });
  }

  // Check for banking+finance double concentration
  const bankSec    = sectorData.find(s => s.key === 'Banking');
  const financeSec = sectorData.find(s => s.key === 'Finance/PSU');
  if (bankSec && financeSec) {
    const combined = bankSec.pct + financeSec.pct;
    if (combined > 30) {
      insights.push({
        icon: '🏦',
        color: '#f0883e',
        title: `Banking + Finance = ${combined.toFixed(1)}% combined`,
        body: `These two closely correlated sectors together form a very large share of your portfolio. An RBI policy shift, NPA cycle, or credit tightening would hit both simultaneously. Consider diversifying into uncorrelated sectors like IT or FMCG.`,
      });
    }
  }

  if (!insights.length) {
    insights.push({
      icon: '🏆',
      color: '#3fb950',
      title: 'Well-balanced sector allocation',
      body: 'No major over- or under-weights detected. Your portfolio has broad sector diversification.',
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
    `).join('')}
    <div style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6;padding:8px;background:var(--bg3);border-radius:6px;border:1px solid var(--border)">
      ⓘ MF sector exposure is estimated from typical index category weights — actual fund holdings vary.
      For precision, check your latest fund factsheet. Equal-weight benchmark divides 100% equally
      across all sectors you hold.
    </div>`;
}
