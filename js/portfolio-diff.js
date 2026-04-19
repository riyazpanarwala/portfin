// ── portfolio-diff.js — Data diff on upload ─────────────────────────────────
// Compares the portfolio state BEFORE and AFTER an Excel upload and renders
// a rich "what changed" summary panel inside the Upload page.
//
// Public API:
//   capturePreUploadSnapshot()   → call before tryApplyData() merges new data
//   renderUploadDiff(oldSnap)     → call after DATA is updated; oldSnap from above

// ── Capture current DATA into a plain comparable object ──────
function capturePreUploadSnapshot() {
  if (!DATA.kpis.totalInvested) return null;
  return {
    kpis: { ...DATA.kpis },
    funds: DATA.funds.map(f => ({
      name: f.name,
      Category: f.Category,
      Invested: f.Invested,
      Current: f.Current,
      Gain: f.Gain,
      RetPct: f.RetPct,
      CAGR: f.CAGR,
      Lots: f.Lots,
    })),
    stocks: DATA.stocks.map(s => ({
      name: s.name,
      Sector: s.Sector,
      Invested: s.Invested,
      Current: s.Current,
      Gain: s.Gain,
      RetPct: s.RetPct,
      CAGR: s.CAGR,
      Qty: s.Qty,
      Latest_Price: s.Latest_Price,
    })),
  };
}

// ── Core diff engine ──────────────────────────────────────────
function computePortfolioDiff(oldSnap, newData) {
  if (!oldSnap) return null;

  const diff = {
    // Portfolio-level KPI deltas
    kpis: {
      totalValue:    newData.kpis.totalValue    - oldSnap.kpis.totalValue,
      totalInvested: newData.kpis.totalInvested - oldSnap.kpis.totalInvested,
      totalGain:     newData.kpis.totalGain     - oldSnap.kpis.totalGain,
      totalReturn:   newData.kpis.totalReturn   - oldSnap.kpis.totalReturn,
      mfGain:        newData.kpis.mfGain        - oldSnap.kpis.mfGain,
      stGain:        newData.kpis.stGain        - oldSnap.kpis.stGain,
      mfCAGR:        (newData.kpis.mfCAGR || 0) - (oldSnap.kpis.mfCAGR || 0),
    },

    // MF changes
    mf: _diffHoldings(oldSnap.funds, newData.funds, 'name'),

    // Stock changes
    stocks: _diffHoldings(oldSnap.stocks, newData.stocks, 'name'),
  };

  return diff;
}

function _diffHoldings(oldList, newList, key) {
  const oldMap = {};
  const newMap = {};
  oldList.forEach(h => oldMap[h[key]] = h);
  newList.forEach(h => newMap[h[key]] = h);

  const added    = [];   // in new, not in old
  const exited   = [];   // in old, not in new
  const improved = [];   // significant positive moves
  const declined = [];   // significant negative moves
  const lotsChanged = []; // lot count / qty changed (SIP top-up)
  const unchanged = [];

  // New entries
  Object.keys(newMap).forEach(name => {
    if (!oldMap[name]) {
      added.push({ ...newMap[name], _type: 'added' });
    }
  });

  // Exited entries
  Object.keys(oldMap).forEach(name => {
    if (!newMap[name]) {
      exited.push({ ...oldMap[name], _type: 'exited' });
    }
  });

  // Changed entries
  Object.keys(newMap).forEach(name => {
    if (!oldMap[name]) return; // already handled as added
    const o = oldMap[name];
    const n = newMap[name];

    const gainDelta   = n.Gain     - o.Gain;
    const retDelta    = n.RetPct   - o.RetPct;
    const invDelta    = n.Invested - o.Invested;
    const lotsOrQty   = (n.Lots || n.Qty || 0) - (o.Lots || o.Qty || 0);

    const entry = {
      ...n,
      _gainDelta:   gainDelta,
      _retDelta:    retDelta,
      _invDelta:    invDelta,
      _lotsQtyDelta: lotsOrQty,
      _old: o,
    };

    // Classify: >5pp return change = significant
    if (retDelta >= 5) {
      improved.push({ ...entry, _type: 'improved' });
    } else if (retDelta <= -5) {
      declined.push({ ...entry, _type: 'declined' });
    } else if (lotsOrQty > 0) {
      lotsChanged.push({ ...entry, _type: 'topped_up' });
    } else if (Math.abs(gainDelta) > 1000 || Math.abs(retDelta) > 2) {
      // Minor change — lump into improved/declined by sign
      if (gainDelta >= 0) improved.push({ ...entry, _type: 'improved' });
      else declined.push({ ...entry, _type: 'declined' });
    } else {
      unchanged.push({ ...entry, _type: 'unchanged' });
    }
  });

  // Sort by magnitude
  improved.sort((a, b) => b._retDelta - a._retDelta);
  declined.sort((a, b) => a._retDelta - b._retDelta);

  return { added, exited, improved, declined, lotsChanged, unchanged };
}

// ── Render the diff panel ─────────────────────────────────────
function renderUploadDiff(oldSnap) {
  const container = document.getElementById('diff-panel-container');
  if (!container) return;

  const diff = computePortfolioDiff(oldSnap, {
    kpis:   DATA.kpis,
    funds:  DATA.funds,
    stocks: DATA.stocks,
  });

  if (!diff) {
    container.innerHTML = '';
    return;
  }

  const hasAnyChange =
    diff.mf.added.length     || diff.mf.exited.length     ||
    diff.mf.improved.length  || diff.mf.declined.length   ||
    diff.mf.lotsChanged.length ||
    diff.stocks.added.length  || diff.stocks.exited.length ||
    diff.stocks.improved.length || diff.stocks.declined.length ||
    diff.stocks.lotsChanged.length;

  if (!hasAnyChange) {
    container.innerHTML = `
      <div class="diff-panel">
        <div class="diff-header">
          <span class="diff-header-icon">🔄</span>
          <span class="diff-header-title">WHAT CHANGED</span>
          <span class="diff-header-badge diff-badge-neutral">No significant changes detected</span>
        </div>
        <div style="font-size:11px;color:var(--muted);padding:10px 0">
          Portfolio data refreshed. All positions and returns are within ±2% of the previous upload.
        </div>
      </div>`;
    return;
  }

  // ── KPI delta strip ───────────────────────────────────────
  const k = diff.kpis;
  const kpiStrip = [
    { l: 'Portfolio value', v: k.totalValue,    fmt: fmtL },
    { l: 'Capital deployed', v: k.totalInvested, fmt: fmtL },
    { l: 'Total gain',       v: k.totalGain,     fmt: fmtL },
    { l: 'Return',           v: k.totalReturn,   fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + 'pp' },
    { l: 'MF CAGR',          v: k.mfCAGR,        fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) + 'pp' },
  ].map(c => {
    const color = c.v > 0 ? 'var(--green)' : c.v < 0 ? 'var(--red)' : 'var(--muted)';
    const sign  = c.v > 0 ? '▲' : c.v < 0 ? '▼' : '—';
    const valStr = Math.abs(c.v) < 0.001 ? '—' : c.fmt(c.v);
    return `<div class="diff-kpi-tile">
      <div class="diff-kpi-label">${c.l}</div>
      <div class="diff-kpi-val" style="color:${color}">${sign} ${valStr}</div>
    </div>`;
  }).join('');

  // ── Section builders ──────────────────────────────────────
  const sections = [];

  // New positions
  const allAdded = [
    ...diff.mf.added.map(h => ({ ...h, _asset: 'MF' })),
    ...diff.stocks.added.map(h => ({ ...h, _asset: 'Stock' })),
  ];
  if (allAdded.length) {
    sections.push(_buildSection('NEW POSITIONS', '🟢', 'diff-section-green', allAdded.map(h =>
      _holdingRow(h, h._asset, 'new', null)
    )));
  }

  // Exited positions
  const allExited = [
    ...diff.mf.exited.map(h => ({ ...h, _asset: 'MF' })),
    ...diff.stocks.exited.map(h => ({ ...h, _asset: 'Stock' })),
  ];
  if (allExited.length) {
    sections.push(_buildSection('EXITED POSITIONS', '⚪', 'diff-section-muted', allExited.map(h =>
      _holdingRow(h, h._asset, 'exited', null)
    )));
  }

  // Top movers — improved
  const allImproved = [
    ...diff.mf.improved.map(h => ({ ...h, _asset: 'MF' })),
    ...diff.stocks.improved.map(h => ({ ...h, _asset: 'Stock' })),
  ].sort((a, b) => b._retDelta - a._retDelta).slice(0, 6);
  if (allImproved.length) {
    sections.push(_buildSection('TOP MOVERS — GAINED', '📈', 'diff-section-green', allImproved.map(h =>
      _holdingRow(h, h._asset, 'improved', h._retDelta)
    )));
  }

  // Top movers — declined
  const allDeclined = [
    ...diff.mf.declined.map(h => ({ ...h, _asset: 'MF' })),
    ...diff.stocks.declined.map(h => ({ ...h, _asset: 'Stock' })),
  ].sort((a, b) => a._retDelta - b._retDelta).slice(0, 6);
  if (allDeclined.length) {
    sections.push(_buildSection('TOP MOVERS — DECLINED', '📉', 'diff-section-red', allDeclined.map(h =>
      _holdingRow(h, h._asset, 'declined', h._retDelta)
    )));
  }

  // SIP top-ups / qty increases
  const allToppedUp = [
    ...diff.mf.lotsChanged.map(h => ({ ...h, _asset: 'MF' })),
    ...diff.stocks.lotsChanged.map(h => ({ ...h, _asset: 'Stock' })),
  ];
  if (allToppedUp.length) {
    sections.push(_buildSection('NEW LOTS ADDED', '💰', 'diff-section-blue', allToppedUp.map(h =>
      _holdingRow(h, h._asset, 'topped_up', null)
    )));
  }

  // ── Assemble total change count ────────────────────────────
  const totalChanges = allAdded.length + allExited.length +
    allImproved.length + allDeclined.length + allToppedUp.length;
  const badgeText = `${totalChanges} change${totalChanges !== 1 ? 's' : ''} detected`;

  container.innerHTML = `
    <div class="diff-panel" id="diff-panel-inner">
      <div class="diff-header">
        <span class="diff-header-icon">🔄</span>
        <span class="diff-header-title">WHAT CHANGED</span>
        <span class="diff-header-badge diff-badge-amber">${badgeText}</span>
        <button class="diff-collapse-btn" onclick="toggleDiffPanel()" id="diff-collapse-btn">▲ collapse</button>
      </div>

      <div id="diff-panel-body">
        <!-- KPI delta strip -->
        <div class="diff-kpi-strip">${kpiStrip}</div>

        <!-- Change sections -->
        ${sections.join('')}

        <div style="font-size:10px;color:var(--muted2);margin-top:14px;line-height:1.6;padding-top:10px;border-top:1px solid var(--border)">
          ⓘ Significant move = ±5pp return change between uploads. Positions with &lt;₹1,000 gain delta are marked unchanged.
        </div>
      </div>
    </div>`;
}

function _buildSection(title, icon, cls, rowsHTML) {
  return `
    <div class="diff-section ${cls}">
      <div class="diff-section-title">${icon} ${title}</div>
      <div class="diff-rows">${rowsHTML.join('')}</div>
    </div>`;
}

function _holdingRow(h, assetType, changeType, retDelta) {
  const assetPill = assetType === 'MF'
    ? `<span class="diff-asset-pill diff-pill-mf">MF</span>`
    : `<span class="diff-asset-pill diff-pill-st">STOCK</span>`;

  let deltaChip = '';
  if (retDelta !== null) {
    const sign  = retDelta >= 0 ? '+' : '';
    const color = retDelta >= 0 ? 'var(--green)' : 'var(--red)';
    deltaChip = `<span class="diff-delta-chip" style="color:${color};border-color:${color}40">${sign}${retDelta.toFixed(1)}pp</span>`;
  }

  let meta = '';
  if (changeType === 'new') {
    meta = `<span style="color:var(--green);font-size:10px">NEW · ${fmtL(h.Invested)} invested · ${fmtP(h.RetPct)}</span>`;
  } else if (changeType === 'exited') {
    meta = `<span style="color:var(--muted);font-size:10px">EXITED · was ${fmtL(h.Invested)} invested · final return ${fmtP(h.RetPct)}</span>`;
  } else if (changeType === 'topped_up') {
    const delta = h._invDelta || 0;
    const lqd   = h._lotsQtyDelta || 0;
    meta = `<span style="color:var(--blue);font-size:10px">+${fmtL(delta)} added · ${lqd > 0 ? (assetType === 'MF' ? lqd + ' new lots' : '+' + fmtN(lqd) + ' shares') : 'qty updated'}</span>`;
  } else {
    // improved / declined
    const gainD = h._gainDelta || 0;
    const sign  = gainD >= 0 ? '+' : '';
    const color = gainD >= 0 ? 'var(--green)' : 'var(--red)';
    meta = `<span style="color:${color};font-size:10px">${sign}${fmtL(gainD)} gain · now ${fmtP(h.RetPct)} (was ${fmtP(h._old?.RetPct)})</span>`;
  }

  return `
    <div class="diff-row">
      ${assetPill}
      <div class="diff-row-name">${esc(h.name)}</div>
      <div class="diff-row-meta">${meta}</div>
      ${deltaChip}
    </div>`;
}

function toggleDiffPanel() {
  const body = document.getElementById('diff-panel-body');
  const btn  = document.getElementById('diff-collapse-btn');
  if (!body || !btn) return;
  const collapsed = body.style.display === 'none';
  body.style.display = collapsed ? 'block' : 'none';
  btn.textContent = collapsed ? '▲ collapse' : '▼ expand';
}
