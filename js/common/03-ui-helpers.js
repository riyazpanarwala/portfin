// ── common/03-ui-helpers.js ──────────────────────────────────────────────────
// Reusable UI primitives used across multiple pages.
// Depends on: 01-data-store.js, 02-formatters.js

// ══════════════════════════════════════════════════════════════
// MINI BAR — inline progress bar + percentage chip
// ══════════════════════════════════════════════════════════════

function miniBar(pct, max) {
  const w  = Math.min(100, max > 0 ? (Math.abs(pct) / max) * 100 : 0);
  const up = pct >= 0;
  return `<div class="bar-wrap">
    <div class="bar-track">
      <div class="bar-fill ${up ? 'up' : 'dn'}" style="width:${w}%"></div>
    </div>
    <span class="bar-pct ${up ? 'up' : 'dn'}">${fmtP(pct)}</span>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// RISK BADGE — pill shown in the Stocks table
// ══════════════════════════════════════════════════════════════

function riskBadge(s) {
  if (s.Sector === 'Speculative' || s.RetPct < -30)
    return '<span class="pill pill-h">HIGH RISK</span>';
  if (s.RetPct < -10)
    return '<span class="pill pill-m">WATCH</span>';
  return '<span class="pill pill-l">SAFE</span>';
}

// ══════════════════════════════════════════════════════════════
// DONUT CHART — SVG pie drawn directly into an <svg> element
// ══════════════════════════════════════════════════════════════

/**
 * @param {string} svgId   - id of the <svg> element to paint into
 * @param {string} legId   - id of the legend container
 * @param {Array}  data    - [{ k: string, v: number }]
 * @param {object} colorMap - key → hex colour
 */
function donut(svgId, legId, data, colorMap) {
  const svg = document.getElementById(svgId);
  const leg = document.getElementById(legId);
  if (!svg || !leg) return;

  const total = data.reduce((s, d) => s + d.v, 0);
  if (!total) return;

  const cx = 55, cy = 55, r = 42;
  let angle = -90;
  let paths = '';

  data.forEach(d => {
    const pct = d.v / total;
    const a1  = angle;
    const a2  = angle + pct * 360;
    angle     = a2;

    const rad = deg => deg * Math.PI / 180;
    const x1  = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
    const x2  = cx + r * Math.cos(rad(a2)), y2 = cy + r * Math.sin(rad(a2));
    const lg  = a2 - a1 > 180 ? 1 : 0;

    paths += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z"
                    fill="${gc(d.k, colorMap)}" opacity=".9"/>`;
  });

  paths += `<circle cx="${cx}" cy="${cy}" r="26" fill="var(--bg2)"/>`;
  svg.innerHTML = paths;

  // Legend rows
  leg.innerHTML = '';
  data.forEach(d => {
    const row  = document.createElement('div');
    row.className = 'legend-row';

    const dot  = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = gc(d.k, colorMap);

    const name = document.createElement('span');
    name.className   = 'legend-name';
    name.textContent = d.k;

    const pctEl = document.createElement('span');
    pctEl.className   = 'legend-pct';
    pctEl.textContent = Math.round((d.v / total) * 100) + '%';

    row.append(dot, name, pctEl);
    leg.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════
// KPI CARD GRID
// ══════════════════════════════════════════════════════════════

/**
 * Renders a grid of KPI cards.
 * @param {Array} cards - [{ l, v, s, sc, a }]
 *   l  = label, v = value, s = sub-text, sc = sub-class (up/dn/gold), a = accent colour
 */
function renderKpiCards(cards) {
  return cards.map(c =>
    `<div class="kpi-card" style="--accent:${c.a || 'var(--gold)'}">
      <div class="kpi-label">${esc(c.l)}</div>
      <div class="kpi-value">${c.v}</div>
      <div class="kpi-sub ${c.sc || ''}">${c.s || ''}</div>
    </div>`
  ).join('');
}

// ══════════════════════════════════════════════════════════════
// DRILL-DOWN TOGGLE — expand / collapse table rows
// ══════════════════════════════════════════════════════════════

function toggleDrill(type, i) {
  const row = document.getElementById(`drill-${type}-${i}`);
  const btn = document.getElementById(`drill-btn-${type}-${i}`);
  if (!row) return;
  const open = row.style.display === 'none';
  row.style.display = open ? 'table-row' : 'none';
  if (btn) btn.textContent = open ? '▼' : '▶';
}

// ══════════════════════════════════════════════════════════════
// DRILL TAB SWITCHER — Lots / Monthly tabs inside a drill row
// ══════════════════════════════════════════════════════════════

function switchDrillTab(tabGroupId, tabId) {
  const group = document.getElementById(tabGroupId);
  if (!group) return;

  group.querySelectorAll('.drill-tab-panel').forEach(p => (p.style.display = 'none'));
  group.querySelectorAll('.drill-tab-btn').forEach(b => {
    b.style.background       = 'transparent';
    b.style.color            = 'var(--muted)';
    b.style.borderBottomColor = 'transparent';
  });

  const panel = document.getElementById(tabId);
  if (panel) panel.style.display = 'block';

  const btn = group.querySelector(`[data-tab="${tabId}"]`);
  if (btn) {
    btn.style.background       = 'var(--bg4)';
    btn.style.color            = 'var(--gold)';
    btn.style.borderBottomColor = 'var(--gold)';
  }
}

/** Build the tab button bar for a drill-down section */
function buildDrillTabBar(drillId, tabs) {
  const base = 'padding:7px 16px;font-size:11px;font-family:var(--mono);' +
    'border:none;border-bottom:2px solid transparent;background:transparent;' +
    'color:var(--muted);cursor:pointer;transition:all .15s;';

  return `<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px">` +
    tabs.map((tab, i) => {
      const active = i === 0
        ? 'background:var(--bg4);color:var(--gold);border-bottom-color:var(--gold);'
        : '';
      return `<button class="drill-tab-btn" data-tab="${drillId}-${tab.id}"
                style="${base}${active}"
                onclick="switchDrillTab('${drillId}','${drillId}-${esc(tab.id)}')">${esc(tab.label)}</button>`;
    }).join('') +
    '</div>';
}
