// ── common.js — shared data, formatters, helpers, router, boot ──────────────

// ══════════════════════════════════════════════════════════════
// DATA — seed / fallback; fully replaced when Excel uploaded
// ══════════════════════════════════════════════════════════════
const DATA = {
  kpis:{totalInvested:0,totalValue:0,totalGain:0,totalReturn:0,
        mfInvested:0,mfValue:0,mfGain:0,mfReturn:0,mfCAGR:0,
        stInvested:0,stValue:0,stGain:0,stReturn:0,
        earliestMF:'', earliestST:''},
  funds:[], mfCategories:[], stocks:[], sectors:[],
  monthlyMF:[],
  mfLots:[], stLots:[],
  _cachedMonthly: null
};

// ── Formatters ────────────────────────────────────────────────
// fmtL: Indian lakh/crore — 2 decimal places throughout
const fmtL = n => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2) + ' L';
  return s + '₹' + a.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
};

// fmtP: percentage always 2 decimal places
const fmtP = n => (n == null || isNaN(n)) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

// fmtN: whole-number quantities
const fmtN = n => Math.round(n).toLocaleString('en-IN');

// fmtPrice: rupee price with exactly 2 decimal places
const fmtPrice = n => (n == null || isNaN(n) || n <= 0) ? '—' : '₹' + Number(n).toFixed(2);

const cls   = n => n >= 0 ? 'td-up' : 'td-dn';
const pSign = n => n >= 0 ? '+' : '';
const esc   = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const CAT_CLR = {Value:'#d4a843','Large Cap':'#58a6ff','Mid Cap':'#3fb950','Small Cap':'#f0883e','Flexi Cap':'#a371f7',ELSS:'#e3b341',Index:'#79c0ff',Other:'#7d8590'};
const SEC_CLR = {Defence:'#58a6ff','Energy/PSU':'#3fb950',Speculative:'#f85149',Renewables:'#56d364','Finance/PSU':'#a371f7',FMCG:'#e3b341','Metals/Mining':'#d4a843',Banking:'#f0883e','Infra/PSU':'#79c0ff','Commodities ETF':'#7d8590','Index ETF':'#484f58',Other:'#7d8590'};
const gc = (k,m) => m[k] || '#7d8590';

function miniBar(pct, max) {
  const w = Math.min(100, max > 0 ? Math.abs(pct) / max * 100 : 0), up = pct >= 0;
  return `<div class="bar-wrap"><div class="bar-track"><div class="bar-fill ${up?'up':'dn'}" style="width:${w}%"></div></div><span class="bar-pct ${up?'up':'dn'}">${fmtP(pct)}</span></div>`;
}
function riskBadge(s) {
  if (s.Sector === 'Speculative' || s.RetPct < -30) return '<span class="pill pill-h">HIGH RISK</span>';
  if (s.RetPct < -10) return '<span class="pill pill-m">WATCH</span>';
  return '<span class="pill pill-l">SAFE</span>';
}
function donut(svgId, legId, data, colorMap) {
  const svg = document.getElementById(svgId), leg = document.getElementById(legId);
  if (!svg || !leg) return;
  const total = data.reduce((s,d) => s + d.v, 0); if (!total) return;
  let angle = -90; const cx = 55, cy = 55, r = 42; let paths = '';
  data.forEach(d => {
    const pct = d.v/total, a1 = angle, a2 = angle + pct*360; angle = a2;
    const tr = deg => deg * Math.PI / 180;
    const x1 = cx+r*Math.cos(tr(a1)), y1 = cy+r*Math.sin(tr(a1));
    const x2 = cx+r*Math.cos(tr(a2)), y2 = cy+r*Math.sin(tr(a2));
    const lg = a2-a1 > 180 ? 1 : 0;
    paths += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${gc(d.k,colorMap)}" opacity=".9"/>`;
  });
  paths += `<circle cx="${cx}" cy="${cy}" r="26" fill="var(--bg2)"/>`;
  svg.innerHTML = paths;
  leg.innerHTML = data.map(d => `<div class="legend-row"><div class="legend-dot" style="background:${gc(d.k,colorMap)}"></div><span class="legend-name">${d.k}</span><span class="legend-pct">${Math.round(d.v/total*100)}%</span></div>`).join('');
}
function fmtDate(d){ return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function fmtMonthYear(d){ return d ? new Date(d).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'; }

// ── XIRR via Newton-Raphson ───────────────────────────────────
function calcXIRR(cashflows, dates) {
  if (!cashflows.length) return null;
  const base = dates[0];
  const t = dates.map(d => (d - base) / (365.25*24*3600*1000));
  let r = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let f = 0, df = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const v = cashflows[i] * Math.pow(1+r, -t[i]);
      f += v; df += (-t[i]) * cashflows[i] * Math.pow(1+r, -t[i]-1);
    }
    if (Math.abs(df) < 1e-12) break;
    const rn = r - f/df;
    if (Math.abs(rn-r) < 1e-8) { r = rn; break; }
    r = rn;
    if (r < -0.9) r = -0.5;
  }
  return isFinite(r) ? parseFloat((r*100).toFixed(2)) : null;
}

// ── State ─────────────────────────────────────────────────────
let mfSort='RetPct', mfAsc=false, mfFil='All';
let stSort='RetPct', stAsc=false, stFil='All';

const _chartTimers = {};
function destroyChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }
  if (_chartTimers[canvasId]) { clearTimeout(_chartTimers[canvasId]); delete _chartTimers[canvasId]; }
}
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
let chartInst = null;
let _fundAnalysisCache = null;

// ── buildCombinedMonthly — cached ─────────────────────────────
function buildCombinedMonthly() {
  if (DATA._cachedMonthly) return DATA._cachedMonthly;
  const map = {};
  DATA.monthlyMF.forEach(({m,v}) => { map[m] = (map[m]||0) + v; });
  DATA.stLots.forEach(l => {
    if (!l.date || !l.amt) return;
    const d = new Date(l.date); if (isNaN(d)) return;
    const mk = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    map[mk] = (map[mk]||0) + l.amt;
  });
  DATA._cachedMonthly = Object.entries(map)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([m,v]) => ({m, v: Math.round(v)}));
  return DATA._cachedMonthly;
}

// ── Ticker ────────────────────────────────────────────────────
function buildTicker() {
  if (!DATA.stocks.length && !DATA.funds.length) {
    document.getElementById('ticker-inner').innerHTML =
      '<span class="tick-item"><span class="tick-name">Upload your Excel files</span><span class="tick-price" style="color:var(--gold)">→ Import Excel tab</span></span>'.repeat(6);
    return;
  }
  const stItems = DATA.stocks.filter(s => s.Latest_Price > 0).map(s =>
    `<span class="tick-item"><span class="tick-name">${esc(s.name)}</span><span class="tick-price">₹${s.Latest_Price.toFixed(2)}</span><span class="tick-chg ${s.Gain>=0?'up':'dn'}">${fmtP(s.RetPct)}</span></span>`);
  const mfItems = DATA.funds.slice(0,6).map(f =>
    `<span class="tick-item"><span class="tick-name">${esc(f.name).split(' ').slice(0,2).join(' ')}</span><span class="tick-price">${fmtL(f.Current)}</span><span class="tick-chg ${f.Gain>=0?'up':'dn'}">${fmtP(f.RetPct)}</span></span>`);
  const all = [...stItems, ...mfItems].join('');
  document.getElementById('ticker-inner').innerHTML = all + all;
}
document.addEventListener('visibilitychange', () => {
  const el = document.getElementById('ticker-inner');
  if (!el) return;
  el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
});

function buildStrip() {
  const tot = DATA.mfCategories.reduce((s,c) => s + c.Invested, 0);
  if (!tot) { document.getElementById('cat-strip').innerHTML = ''; return; }
  document.getElementById('cat-strip').innerHTML = DATA.mfCategories.map(c =>
    `<div style="background:${CAT_CLR[c.Category]||'#444'};flex:${c.Invested/tot*100}"></div>`).join('');
}

// ── Topbar + sidebar ──────────────────────────────────────────
function updateChrome() {
  const k = DATA.kpis;
  document.getElementById('sb-total-val').textContent = k.totalValue ? fmtL(k.totalValue) : '—';
  const pnlEl = document.getElementById('sb-pnl');
  pnlEl.textContent = k.totalReturn ? (pSign(k.totalReturn) + k.totalReturn.toFixed(2) + '%') : '—';
  pnlEl.style.color = k.totalGain >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('sb-cagr').textContent = k.mfCAGR ? (k.mfCAGR.toFixed(2) + '% p.a.') : '—';
  const dateStr = k.latestDate ? fmtDate(k.latestDate) : (k.totalValue ? fmtDate(new Date()) : '—');
  document.getElementById('sb-date').textContent = dateStr;

  const mfCount = DATA.funds.length, stCount = DATA.stocks.length;
  if (mfCount || stCount) {
    const since = k.earliestMF ? (' · Since ' + fmtMonthYear(k.earliestMF)) : '';
    document.getElementById('topbar-meta').textContent = `${mfCount} mutual funds · ${stCount} equity stocks${since}`;
  }

  const badges = [];
  if (k.mfReturn !== undefined && mfCount) {
    badges.push(`<span class="badge ${k.mfReturn>=0?'badge-g':'badge-r'}">MF ${pSign(k.mfReturn)}${k.mfReturn.toFixed(2)}%</span>`);
  }
  if (k.stReturn !== undefined && stCount) {
    badges.push(`<span class="badge ${k.stReturn>=0?'badge-g':'badge-r'}">Stocks ${pSign(k.stReturn)}${k.stReturn.toFixed(2)}%</span>`);
  }
  if (k.totalReturn !== undefined && (mfCount || stCount)) {
    badges.push(`<span class="badge badge-a">Combined ${pSign(k.totalReturn)}${k.totalReturn.toFixed(2)}%</span>`);
  }
  document.getElementById('topbar-badges').innerHTML = badges.join('');
}

// ═══════════════════════════════════════════════════════════════
// LOCALSTORAGE PERSISTENCE
// ═══════════════════════════════════════════════════════════════
const LS_KEY = 'portfin-data-v1';
const LS_SNAPSHOTS_KEY = 'portfin-snapshots-v1';
const MAX_SNAPSHOTS = 24;

function saveDataToStorage() {
  try {
    const payload = {
      kpis: { ...DATA.kpis,
        earliestMF: DATA.kpis.earliestMF ? new Date(DATA.kpis.earliestMF).toISOString() : null,
        earliestST: DATA.kpis.earliestST ? new Date(DATA.kpis.earliestST).toISOString() : null,
        latestDate: DATA.kpis.latestDate  ? new Date(DATA.kpis.latestDate).toISOString()  : null },
      funds:        DATA.funds.map(f  => ({...f, dates:f.dates.map(d=>new Date(d).toISOString()), rawLots:f.rawLots.map(l=>({...l,date:new Date(l.date).toISOString()}))})),
      mfCategories: DATA.mfCategories,
      stocks:       DATA.stocks.map(s => ({...s, dates:s.dates.map(d=>new Date(d).toISOString()), rawLots:s.rawLots.map(l=>({...l,date:new Date(l.date).toISOString()}))})),
      sectors:      DATA.sectors,
      monthlyMF:    DATA.monthlyMF,
      mfLots:       DATA.mfLots.map(l => ({...l, date:new Date(l.date).toISOString()})),
      stLots:       DATA.stLots.map(l => ({...l, date:new Date(l.date).toISOString()})),
      savedAt:      new Date().toISOString()
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    return true;
  } catch(e) { console.warn('PortFin: Could not save to localStorage', e); return false; }
}

function loadDataFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || !payload.funds) return false;
    const reDate = v => v ? new Date(v) : null;
    DATA.kpis         = { ...payload.kpis, earliestMF:reDate(payload.kpis.earliestMF), earliestST:reDate(payload.kpis.earliestST), latestDate:reDate(payload.kpis.latestDate) };
    DATA.funds         = payload.funds.map(f  => ({...f, dates:(f.dates||[]).map(d=>new Date(d)), rawLots:(f.rawLots||[]).map(l=>({...l,date:new Date(l.date)}))}));
    DATA.mfCategories  = payload.mfCategories || [];
    DATA.stocks        = payload.stocks.map(s => ({...s, dates:(s.dates||[]).map(d=>new Date(d)), rawLots:(s.rawLots||[]).map(l=>({...l,date:new Date(l.date)}))}));
    DATA.sectors       = payload.sectors   || [];
    DATA.monthlyMF     = payload.monthlyMF || [];
    DATA.mfLots        = (payload.mfLots||[]).map(l => ({...l, date:new Date(l.date)}));
    DATA.stLots        = (payload.stLots||[]).map(l => ({...l, date:new Date(l.date)}));
    DATA._cachedMonthly = null;
    _fundAnalysisCache  = null;
    return payload.savedAt || true;
  } catch(e) { console.warn('PortFin: Could not load from localStorage', e); return false; }
}
function clearStoredData() { localStorage.removeItem(LS_KEY); }

// ── Snapshots ─────────────────────────────────────────────────
function saveSnapshot() {
  try {
    const k = DATA.kpis; if (!k.totalInvested) return;
    const snapshots = getSnapshots(), now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const snap = { monthKey, savedAt:now.toISOString(),
      label:now.toLocaleDateString('en-IN',{month:'short',year:'numeric'}),
      totalInvested:k.totalInvested, totalValue:k.totalValue, totalGain:k.totalGain, totalReturn:k.totalReturn,
      mfInvested:k.mfInvested, mfValue:k.mfValue, mfCAGR:k.mfCAGR,
      stInvested:k.stInvested, stValue:k.stValue,
      fundCount:DATA.funds.length, stockCount:DATA.stocks.length };
    const idx = snapshots.findIndex(s => s.monthKey === monthKey);
    if (idx >= 0) snapshots[idx] = snap; else snapshots.push(snap);
    snapshots.sort((a,b) => a.monthKey.localeCompare(b.monthKey));
    while (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
    localStorage.setItem(LS_SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch(e) { console.warn('PortFin: Could not save snapshot', e); }
}
function getSnapshots() {
  try { return JSON.parse(localStorage.getItem(LS_SNAPSHOTS_KEY) || '[]'); }
  catch(e) { return []; }
}
function clearSnapshots() { localStorage.removeItem(LS_SNAPSHOTS_KEY); }

function showPersistBanner(savedAt) {
  const existing = document.getElementById('persist-banner');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'persist-banner';
  const dateStr = savedAt && savedAt !== true
    ? new Date(savedAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
    : 'previous session';
  bar.innerHTML = `<span style="flex:1">📂 Showing portfolio saved on <strong>${dateStr}</strong>. Upload new files to refresh.</span>
    <button onclick="clearAndReset()" style="background:transparent;border:1px solid var(--border2);border-radius:4px;color:var(--muted);padding:3px 10px;font-size:10px;cursor:pointer;flex-shrink:0">Clear data</button>`;
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--amber-bg);border-bottom:1px solid #4a3500;color:var(--amber);font-size:11px;padding:7px 20px;font-family:var(--mono)';
  const ticker = document.querySelector('.ticker');
  if (ticker) ticker.after(bar);
}
function clearAndReset() {
  if (!confirm('Clear all saved portfolio data and snapshots? This cannot be undone.')) return;
  clearStoredData(); clearSnapshots(); location.reload();
}

// ── Shared helpers ────────────────────────────────────────────
function fmtHoldPeriod(days) {
  if (!days || days <= 0) return '—';
  const y = Math.floor(days/365), m = Math.floor((days%365)/30);
  if (y > 0 && m > 0) return `${y}y ${m}m`;
  if (y > 0) return `${y}y`;
  if (m > 0) return `${m}m`;
  return `${days}d`;
}

// ══════════════════════════════════════════════════════════════
// buildMFDrillHTML — lot table + fund-level & per-lot XIRR
// ══════════════════════════════════════════════════════════════
function buildMFDrillHTML(f) {
  if (!f.rawLots || !f.rawLots.length)
    return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';

  const lots = [...f.rawLots].sort((a,b) => a.date - b.date);

  // ── Fund-level XIRR ──────────────────────────────────────────
  let fundXirr = null;
  try {
    const cfAmounts = [], cfDates = [];
    lots.forEach(l => {
      if (l.date && l.amt > 0) { cfAmounts.push(-l.amt); cfDates.push(new Date(l.date)); }
    });
    const currentValue = f.Current || (f.Invested + (f.Gain || 0));
    if (currentValue > 0 && cfAmounts.length) {
      cfAmounts.push(currentValue); cfDates.push(new Date());
      fundXirr = calcXIRR(cfAmounts, cfDates);
    }
  } catch(e) { fundXirr = null; }

  const xirrColor = fundXirr === null ? 'var(--muted)'
    : fundXirr >= 15 ? 'var(--green)'
    : fundXirr >=  8 ? 'var(--gold)'
    : 'var(--red)';
  const xirrDisplay = fundXirr !== null
    ? `<span style="color:${xirrColor};font-weight:600">${fundXirr >= 0 ? '+' : ''}${fundXirr.toFixed(2)}%</span>`
    : '<span style="color:var(--muted)">—</span>';

  const cagrDelta = fundXirr !== null ? (fundXirr - f.CAGR) : null;
  const deltaBadge = cagrDelta !== null && Math.abs(cagrDelta) > 1 ? `
    <span style="font-size:10px;color:var(--muted2);margin-left:6px">
      vs CAGR ${f.CAGR >= 0 ? '+' : ''}${f.CAGR.toFixed(2)}%
      <span style="color:${cagrDelta > 0 ? 'var(--green)' : 'var(--red)'}">
        (${cagrDelta > 0 ? '+' : ''}${cagrDelta.toFixed(2)}pp)
      </span>
    </span>` : '';

  const xiBadge = fundXirr !== null ? `
    <div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);
                border-radius:5px;padding:6px 12px;margin-bottom:10px;font-size:11px">
      <span style="color:var(--muted)">Fund XIRR (money-weighted):</span>
      <span style="color:${xirrColor};font-weight:700;font-family:var(--sans);font-size:14px">
        ${fundXirr >= 0 ? '+' : ''}${fundXirr.toFixed(2)}%
      </span>
      <span style="color:var(--muted2);font-size:10px">p.a.</span>
      ${deltaBadge}
    </div>` : '';

  // ── Lot rows ─────────────────────────────────────────────────
  let totalAmt = 0, totalGain = 0;

  const rows = lots.map(l => {
    const days     = Math.floor((Date.now() - l.date.getTime()) / (24*3600*1000));
    const holdStr  = fmtHoldPeriod(days);
    const taxTag   = days >= 365 ? '<span class="ltcg-badge">LTCG</span>' : '<span class="stcg-badge">STCG</span>';
    const lotGainPct = l.amt > 0 ? ((l.gain / l.amt) * 100).toFixed(2) : '0.00';
    const lotCls   = l.gain >= 0 ? 'td-up' : 'td-dn';

    let lotXirr = null;
    try {
      if (l.date && l.amt > 0 && days > 7) {
        const lotCurVal = l.cur || (l.amt + (l.gain || 0));
        if (lotCurVal > 0) lotXirr = calcXIRR([-l.amt, lotCurVal], [new Date(l.date), new Date()]);
      }
    } catch(e) { lotXirr = null; }

    const lotXirrColor = lotXirr === null ? 'var(--muted)'
      : lotXirr >= 15 ? 'var(--green)'
      : lotXirr >=  8 ? 'var(--gold)'
      : 'var(--red)';

    totalAmt  += (l.amt  || 0);
    totalGain += (l.gain || 0);

    return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td>${l.invPrice > 0 ? '₹' + Number(l.invPrice).toFixed(2) : '—'}</td>
      <td>${l.qty > 0 ? l.qty.toFixed(3) : '—'}</td>
      <td>${fmtL(l.amt)}</td>
      <td class="${lotCls}">${fmtL(l.gain)}</td>
      <td class="${lotCls}">${l.amt > 0 ? (l.gain >= 0 ? '+' : '') + lotGainPct + '%' : '—'}</td>
      <td style="color:${lotXirrColor};font-weight:${lotXirr !== null ? '600' : '400'}">
        ${lotXirr !== null ? (lotXirr >= 0 ? '+' : '') + lotXirr.toFixed(2) + '%' : '—'}
      </td>
      <td>${holdStr}</td>
      <td>${taxTag}</td>
    </tr>`;
  }).join('');

  const totalRetPct = totalAmt > 0 ? ((totalGain / totalAmt) * 100).toFixed(2) : '0.00';
  const totCls = totalGain >= 0 ? 'td-up' : 'td-dn';
  const footer = `
    <tr style="background:var(--bg3)">
      <td style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">
        Total · ${lots.length} lot${lots.length !== 1 ? 's' : ''}
      </td>
      <td></td><td></td>
      <td style="font-weight:600">${fmtL(totalAmt)}</td>
      <td class="${totCls}" style="font-weight:600">${fmtL(totalGain)}</td>
      <td class="${totCls}" style="font-weight:600">${totalAmt > 0 ? (totalGain >= 0 ? '+' : '') + totalRetPct + '%' : '—'}</td>
      <td style="color:${xirrColor};font-weight:700">${xirrDisplay}</td>
      <td colspan="2" style="color:var(--muted2);font-size:10px">← fund XIRR</td>
    </tr>`;

  return `
    ${xiBadge}
    <table class="drill-table">
      <thead><tr>
        <th>Buy date</th><th>Buy NAV</th><th>Units</th><th>Invested</th>
        <th>Gain / Loss</th><th>Return %</th>
        <th title="Money-weighted annualised return for this lot">XIRR</th>
        <th>Holding</th><th>Tax</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>${footer}</tfoot>
    </table>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">
      XIRR = money-weighted return — accounts for exact timing of each purchase.
      Early lots invested when the fund was cheaper tend to show the highest XIRR.
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// buildSTDrillHTML — lot table with buy price (2 decimal)
// ══════════════════════════════════════════════════════════════
function buildSTDrillHTML(s) {
  if (!s.rawLots || !s.rawLots.length)
    return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';

  const lots = [...s.rawLots].sort((a,b) => a.date - b.date);
  const cmp  = s.Latest_Price || 0;

  const rows = lots.map(l => {
    const days    = Math.floor((Date.now() - l.date.getTime()) / (24*3600*1000));
    const holdStr = fmtHoldPeriod(days);
    const taxTag  = days >= 365 ? '<span class="ltcg-badge">LTCG</span>' : '<span class="stcg-badge">STCG</span>';
    const curVal  = cmp > 0 && l.qty > 0 ? cmp * l.qty : (l.cur || l.inv + (l.gain || 0));
    const lotGain = curVal - l.inv;
    const lotPct  = l.inv > 0 ? ((lotGain / l.inv) * 100).toFixed(2) : '0.00';
    const lotCls  = lotGain >= 0 ? 'td-up' : 'td-dn';
    return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td>${l.qty > 0 ? fmtN(l.qty) : '—'}</td>
      <td>${l.invPrice > 0 ? '₹' + Number(l.invPrice).toFixed(2) : '—'}</td>
      <td>${cmp > 0 ? '₹' + cmp.toFixed(2) : '—'}</td>
      <td>${fmtL(l.inv)}</td>
      <td style="font-weight:500">${fmtL(curVal)}</td>
      <td class="${lotCls}">${fmtL(lotGain)}</td>
      <td class="${lotCls}">${l.inv > 0 ? (lotGain >= 0 ? '+' : '') + lotPct + '%' : '—'}</td>
      <td>${holdStr}</td>
      <td>${taxTag}</td>
    </tr>`;
  }).join('');

  return `<table class="drill-table">
    <thead><tr>
      <th>Buy Date</th><th>Qty</th><th>Buy Price</th><th>CMP</th>
      <th>Invested</th><th>Cur. Value</th><th>P&amp;L</th><th>Return %</th>
      <th>Holding</th><th>Tax</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

const drillState = {};
function toggleDrill(type, i) {
  const rowId = `drill-${type}-${i}`;
  const btnId = `drill-btn-${type}-${i}`;
  const row = document.getElementById(rowId);
  const btn = document.getElementById(btnId);
  if (!row) return;
  const open = row.style.display === 'none';
  row.style.display = open ? 'table-row' : 'none';
  if (btn) btn.textContent = open ? '▼' : '▶';
}

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  document.getElementById('theme-toggle-btn').textContent = isLight ? '🌙' : '☀️';
  localStorage.setItem('portfin-theme', isLight ? 'light' : 'dark');
}
(function initTheme() {
  const saved = localStorage.getItem('portfin-theme');
  if (saved === 'light') {
    document.documentElement.classList.add('light');
    const b = document.getElementById('theme-toggle-btn'); if (b) b.textContent = '🌙';
  }
})();

// ── Mobile sidebar ────────────────────────────────────────────
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('mobile-open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
document.querySelectorAll('.nav-item').forEach(n => {
  const orig = n.getAttribute('onclick') || '';
  n.setAttribute('onclick', orig + ';closeSidebar()');
});

// ── Export CSV ────────────────────────────────────────────────
function exportCSV(type) {
  let rows = [], headers = [];
  if (type === 'mf') {
    if (!DATA.funds.length) { alert('No MF data to export. Upload a file first.'); return; }
    headers = ['Fund Name','Category','Lots','Invested (₹)','Current Value (₹)','Gain/Loss (₹)','Return (%)','CAGR (%)','Holding Days'];
    rows = DATA.funds.map(f => [
      '"' + f.name.replace(/"/g,'""') + '"', f.Category, f.Lots,
      f.Invested.toFixed(2), f.Current.toFixed(2), f.Gain.toFixed(2),
      f.RetPct.toFixed(2), f.CAGR.toFixed(2), f.holdDays || 0
    ]);
  } else {
    if (!DATA.stocks.length) { alert('No stocks data to export. Upload a file first.'); return; }
    headers = ['Stock','Sector','Quantity','CMP (₹)','Invested (₹)','Market Value (₹)','P&L (₹)','Return (%)','CAGR (%)','Holding Days'];
    rows = DATA.stocks.map(s => [
      '"' + s.name.replace(/"/g,'""') + '"', s.Sector, s.Qty,
      s.Latest_Price.toFixed(2), s.Invested.toFixed(2), s.Current.toFixed(2),
      s.Gain.toFixed(2), s.RetPct.toFixed(2), s.CAGR.toFixed(2), s.holdDays || 0
    ]);
  }
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = (type === 'mf' ? 'mutual_funds' : 'stocks') + '_portfolio.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
