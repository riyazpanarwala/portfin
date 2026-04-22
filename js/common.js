// ── common.js — shared data, formatters, helpers ─────────────────────────────
//
// CHANGES vs reviewed version:
//  • DATA now includes _cachedDrawdown: null  (Issue #3 — avoids re-running GBM
//    on every Overview tab visit; invalidated in tryApplyData() in page-tools.js)
//  • buildCombinedMonthly() / DATA._cachedMonthly unchanged
//  • All other logic identical to the previously-reviewed common.js

// ══════════════════════════════════════════════════════════════
// DATA — seed / fallback; fully replaced when Excel is uploaded
// ══════════════════════════════════════════════════════════════
const DATA = {
  kpis: {
    totalInvested: 0, totalValue: 0, totalGain: 0, totalReturn: 0,
    mfInvested: 0, mfValue: 0, mfGain: 0, mfReturn: 0, mfCAGR: 0,
    stInvested: 0, stValue: 0, stGain: 0, stReturn: 0,
    earliestMF: '', earliestST: '',
  },
  funds: [], mfCategories: [], stocks: [], sectors: [],
  monthlyMF: [], mfLots: [], stLots: [],
  _cachedMonthly: null,
  // FIX #3: cache for the drawdown GBM series; cleared on every upload
  _cachedDrawdown: null,
};

// ══════════════════════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════════════════════
const fmtL = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2) + ' L';
  return s + '₹' + a.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtP = (n) => (n == null || isNaN(n)) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtN = (n) => Math.round(n).toLocaleString('en-IN');
const fmtPrice = (n) => (n == null || isNaN(n) || n <= 0) ? '—' : '₹' + Number(n).toFixed(2);
const cls = (n) => n >= 0 ? 'td-up' : 'td-dn';
const pSign = (n) => n >= 0 ? '+' : '';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');

const cleanNum = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v)
    .replace(/[\u00a0\u202f\u2009]/g, '')
    .replace(/[₹,\s*]/g, '')
    .replace(/\u2013|\u2014/g, '-');
  return parseFloat(s) || 0;
};

// ══════════════════════════════════════════════════════════════
// COLOUR MAPS
// ══════════════════════════════════════════════════════════════
const CAT_CLR = {
  Value: '#d4a843', 'Large Cap': '#58a6ff', 'Mid Cap': '#3fb950',
  'Small Cap': '#f0883e', 'Flexi Cap': '#a371f7', ELSS: '#e3b341',
  Index: '#79c0ff', Other: '#7d8590',
};
const SEC_CLR = {
  Defence: '#58a6ff', 'Energy/PSU': '#3fb950', Speculative: '#f85149',
  Renewables: '#56d364', 'Finance/PSU': '#a371f7', FMCG: '#e3b341',
  'Metals/Mining': '#d4a843', Banking: '#f0883e', 'Infra/PSU': '#79c0ff',
  'Commodities ETF': '#7d8590', 'Index ETF': '#484f58', Other: '#7d8590',
};
const gc = (k, m) => m[k] || '#7d8590';

// ══════════════════════════════════════════════════════════════
// MINI HELPERS
// ══════════════════════════════════════════════════════════════
function miniBar(pct, max) {
  const w = Math.min(100, max > 0 ? (Math.abs(pct) / max) * 100 : 0), up = pct >= 0;
  return `<div class="bar-wrap"><div class="bar-track"><div class="bar-fill ${up ? 'up' : 'dn'}" style="width:${w}%"></div></div><span class="bar-pct ${up ? 'up' : 'dn'}">${fmtP(pct)}</span></div>`;
}

function riskBadge(s) {
  if (s.Sector === 'Speculative' || s.RetPct < -30) return '<span class="pill pill-h">HIGH RISK</span>';
  if (s.RetPct < -10) return '<span class="pill pill-m">WATCH</span>';
  return '<span class="pill pill-l">SAFE</span>';
}

function donut(svgId, legId, data, colorMap) {
  const svg = document.getElementById(svgId), leg = document.getElementById(legId);
  if (!svg || !leg) return;
  const total = data.reduce((s, d) => s + d.v, 0);
  if (!total) return;
  let angle = -90;
  const cx = 55, cy = 55, r = 42;
  let paths = '';
  data.forEach(d => {
    const pct = d.v / total, a1 = angle, a2 = angle + pct * 360;
    angle = a2;
    const tr = deg => deg * Math.PI / 180;
    const x1 = cx + r * Math.cos(tr(a1)), y1 = cy + r * Math.sin(tr(a1));
    const x2 = cx + r * Math.cos(tr(a2)), y2 = cy + r * Math.sin(tr(a2));
    const lg = a2 - a1 > 180 ? 1 : 0;
    paths += `<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${gc(d.k, colorMap)}" opacity=".9"/>`;
  });
  paths += `<circle cx="${cx}" cy="${cy}" r="26" fill="var(--bg2)"/>`;
  svg.innerHTML = paths;
  leg.innerHTML = '';
  data.forEach(d => {
    const row = document.createElement('div');
    row.className = 'legend-row';
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = gc(d.k, colorMap);
    const name = document.createElement('span');
    name.className = 'legend-name';
    name.textContent = d.k;
    const pctEl = document.createElement('span');
    pctEl.className = 'legend-pct';
    pctEl.textContent = Math.round((d.v / total) * 100) + '%';
    row.append(dot, name, pctEl);
    leg.appendChild(row);
  });
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fmtMonthYear(d) { return d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'; }

// ══════════════════════════════════════════════════════════════
// XIRR via Newton-Raphson
// ══════════════════════════════════════════════════════════════
function calcXIRR(cashflows, dates) {
  if (!cashflows.length) return null;
  const netFlow = cashflows.reduce((a, v) => a + v, 0);
  if (Math.abs(netFlow) < 1) return 0;
  const base = dates[0];
  const t = dates.map(d => (d - base) / (365.25 * 24 * 3600 * 1000));
  let r = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let f = 0, df = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const v = cashflows[i] * Math.pow(1 + r, -t[i]);
      f += v;
      df += -t[i] * cashflows[i] * Math.pow(1 + r, -t[i] - 1);
    }
    if (Math.abs(df) < 1e-12) break;
    const rn = r - f / df;
    if (!isFinite(rn)) break;
    if (Math.abs(rn - r) < 1e-8) { r = rn; break; }
    r = rn;
    if (r < -0.9) r = -0.5;
  }
  return isFinite(r) ? parseFloat((r * 100).toFixed(2)) : null;
}

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let mfSort = 'RetPct', mfAsc = false, mfFil = 'All';
let stSort = 'RetPct', stAsc = false, stFil = 'All';

// ══════════════════════════════════════════════════════════════
// CHART LIFECYCLE — safe schedule + destroy
// ══════════════════════════════════════════════════════════════
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

let _fundAnalysisCache = null;

// ══════════════════════════════════════════════════════════════
// buildCombinedMonthly — cached monthly roll-up (MF + Stocks)
// ══════════════════════════════════════════════════════════════
function buildCombinedMonthly() {
  if (DATA._cachedMonthly) return DATA._cachedMonthly;
  const map = {};
  DATA.monthlyMF.forEach(({ m, v }) => { map[m] = (map[m] || 0) + v; });
  DATA.stLots.forEach(l => {
    if (!l.date || !l.amt) return;
    const d = new Date(l.date);
    if (isNaN(d)) return;
    const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    map[mk] = (map[mk] || 0) + l.amt;
  });
  DATA._cachedMonthly = Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([m, v]) => ({ m, v: Math.round(v) }));
  return DATA._cachedMonthly;
}

// ══════════════════════════════════════════════════════════════
// TICKER
// ══════════════════════════════════════════════════════════════
function buildTicker() {
  const inner = document.getElementById('ticker-inner');
  if (!inner) return;
  if (!DATA.stocks.length && !DATA.funds.length) {
    inner.innerHTML = Array(6).fill(
      '<span class="tick-item"><span class="tick-name">Upload your Excel files</span>' +
      '<span class="tick-price" style="color:var(--gold)">→ Import Excel tab</span></span>'
    ).join('');
    return;
  }
  const stItems = DATA.stocks.filter(s => s.Latest_Price > 0).map(s =>
    `<span class="tick-item"><span class="tick-name">${esc(s.name)}</span>` +
    `<span class="tick-price">₹${s.Latest_Price.toFixed(2)}</span>` +
    `<span class="tick-chg ${s.Gain >= 0 ? 'up' : 'dn'}">${fmtP(s.RetPct)}</span></span>`
  );
  const mfItems = DATA.funds.slice(0, 6).map(f =>
    `<span class="tick-item"><span class="tick-name">${esc(f.name).split(' ').slice(0, 2).join(' ')}</span>` +
    `<span class="tick-price">${fmtL(f.Current)}</span>` +
    `<span class="tick-chg ${f.Gain >= 0 ? 'up' : 'dn'}">${fmtP(f.RetPct)}</span></span>`
  );
  const all = [...stItems, ...mfItems].join('');
  inner.innerHTML = all + all;
}

document.addEventListener('visibilitychange', () => {
  const el = document.getElementById('ticker-inner');
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = '';
});

function buildStrip() {
  const strip = document.getElementById('cat-strip');
  if (!strip) return;
  const tot = DATA.mfCategories.reduce((s, c) => s + c.Invested, 0);
  if (!tot) { strip.innerHTML = ''; return; }
  strip.innerHTML = DATA.mfCategories.map(c =>
    `<div style="background:${CAT_CLR[c.Category] || '#444'};flex:${(c.Invested / tot) * 100}"></div>`
  ).join('');
}

// ══════════════════════════════════════════════════════════════
// TOPBAR / SIDEBAR CHROME
// ══════════════════════════════════════════════════════════════
function updateChrome() {
  const k = DATA.kpis;
  const sbVal = document.getElementById('sb-total-val');
  const sbPnl = document.getElementById('sb-pnl');
  const sbCagr = document.getElementById('sb-cagr');
  const sbDate = document.getElementById('sb-date');
  if (sbVal) sbVal.textContent = k.totalValue ? fmtL(k.totalValue) : '—';
  if (sbPnl) {
    sbPnl.textContent = k.totalReturn ? pSign(k.totalReturn) + k.totalReturn.toFixed(2) + '%' : '—';
    sbPnl.style.color = k.totalGain >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (sbCagr) sbCagr.textContent = k.mfCAGR ? k.mfCAGR.toFixed(2) + '% p.a.' : '—';
  // FIX #9: latestDate is now the actual latest lot date set in tryApplyData()
  const dateStr = k.latestDate ? fmtDate(k.latestDate) : k.totalValue ? fmtDate(new Date()) : '—';
  if (sbDate) sbDate.textContent = dateStr;

  const mfCount = DATA.funds.length, stCount = DATA.stocks.length;
  const metaEl = document.getElementById('topbar-meta');
  if (metaEl && (mfCount || stCount)) {
    const since = k.earliestMF ? ' · Since ' + fmtMonthYear(k.earliestMF) : '';
    metaEl.textContent = `${mfCount} mutual funds · ${stCount} equity stocks${since}`;
  }

  const badges = [];
  if (k.mfReturn !== undefined && mfCount)
    badges.push(`<span class="badge ${k.mfReturn >= 0 ? 'badge-g' : 'badge-r'}">MF ${pSign(k.mfReturn)}${k.mfReturn.toFixed(2)}%</span>`);
  if (k.stReturn !== undefined && stCount)
    badges.push(`<span class="badge ${k.stReturn >= 0 ? 'badge-g' : 'badge-r'}">Stocks ${pSign(k.stReturn)}${k.stReturn.toFixed(2)}%</span>`);
  if (k.totalReturn !== undefined && (mfCount || stCount))
    badges.push(`<span class="badge badge-a">Combined ${pSign(k.totalReturn)}${k.totalReturn.toFixed(2)}%</span>`);
  const badgeEl = document.getElementById('topbar-badges');
  if (badgeEl) badgeEl.innerHTML = badges.join('');
}

// ══════════════════════════════════════════════════════════════
// LOCALSTORAGE PERSISTENCE
// ══════════════════════════════════════════════════════════════
const LS_KEY = 'portfin-data-v1';
const LS_SNAPSHOTS_KEY = 'portfin-snapshots-v1';
const MAX_SNAPSHOTS = 104;

function _safeISO(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function saveDataToStorage() {
  try {
    const payload = {
      kpis: {
        ...DATA.kpis,
        earliestMF: _safeISO(DATA.kpis.earliestMF),
        earliestST: _safeISO(DATA.kpis.earliestST),
        latestDate: _safeISO(DATA.kpis.latestDate),
      },
      funds: DATA.funds.map(f => ({
        ...f,
        dates: (f.dates || []).map(d => _safeISO(d)).filter(Boolean),
        rawLots: (f.rawLots || []).filter(l => l.date && !isNaN(new Date(l.date))).map(l => ({ ...l, date: _safeISO(l.date) })),
      })),
      mfCategories: DATA.mfCategories,
      stocks: DATA.stocks.map(s => ({
        ...s,
        dates: (s.dates || []).map(d => _safeISO(d)).filter(Boolean),
        rawLots: (s.rawLots || []).filter(l => l.date && !isNaN(new Date(l.date))).map(l => ({ ...l, date: _safeISO(l.date) })),
      })),
      sectors: DATA.sectors,
      monthlyMF: DATA.monthlyMF,
      mfLots: DATA.mfLots.map(l => ({ ...l, date: _safeISO(l.date) })),
      stLots: DATA.stLots.map(l => ({ ...l, date: _safeISO(l.date) })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('PortFin: Could not save to localStorage', e);
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      const msgEl = document.getElementById('apply-msg');
      if (msgEl) {
        msgEl.style.cssText = 'background:var(--red-bg);border:1px solid var(--red-dim);color:var(--red);display:block';
        msgEl.textContent = '⚠ Dashboard loaded but could not be saved — browser storage is full.';
      }
    }
    return false;
  }
}

function loadDataFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || !payload.funds) return false;
    const reDate = v => v ? new Date(v) : null;
    DATA.kpis = {
      ...payload.kpis,
      earliestMF: reDate(payload.kpis.earliestMF),
      earliestST: reDate(payload.kpis.earliestST),
      latestDate: reDate(payload.kpis.latestDate),
    };
    DATA.funds = payload.funds.map(f => ({ ...f, dates: (f.dates || []).map(d => new Date(d)), rawLots: (f.rawLots || []).map(l => ({ ...l, date: new Date(l.date) })) }));
    DATA.mfCategories = payload.mfCategories || [];
    DATA.stocks = payload.stocks.map(s => ({ ...s, dates: (s.dates || []).map(d => new Date(d)), rawLots: (s.rawLots || []).map(l => ({ ...l, date: new Date(l.date) })) }));
    DATA.sectors = payload.sectors || [];
    DATA.monthlyMF = payload.monthlyMF || [];
    DATA.mfLots = (payload.mfLots || []).map(l => ({ ...l, date: new Date(l.date) }));
    DATA.stLots = (payload.stLots || []).map(l => ({ ...l, date: new Date(l.date) }));
    DATA._cachedMonthly = null;
    DATA._cachedDrawdown = null; // FIX #3: invalidate drawdown cache on load
    _fundAnalysisCache = null;
    return payload.savedAt || true;
  } catch (e) {
    console.warn('PortFin: Could not load from localStorage', e);
    return false;
  }
}

function clearStoredData() { localStorage.removeItem(LS_KEY); }

// ══════════════════════════════════════════════════════════════
// SNAPSHOTS (weekly)
// ══════════════════════════════════════════════════════════════
function getISOWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}
function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function fmtWeekRange(weekStart) {
  const end = new Date(weekStart); end.setDate(end.getDate() + 6);
  const opts = { day: '2-digit', month: 'short' };
  return weekStart.toLocaleDateString('en-IN', opts) + ' – ' +
    end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function saveSnapshot() {
  try {
    const k = DATA.kpis;
    if (!k.totalInvested) return;
    const snapshots = getSnapshots();
    const now = new Date();
    const weekNum = getISOWeekNumber(now);
    const weekStart = getWeekStart(now);
    const thu = new Date(weekStart); thu.setDate(thu.getDate() + 3);
    const isoYear = thu.getFullYear();
    const weekKey = isoYear + '-W' + String(weekNum).padStart(2, '0');

    const snap = {
      weekKey,
      savedAt: now.toISOString(),
      label: fmtWeekRange(weekStart),
      shortLabel: 'W' + String(weekNum).padStart(2, '0') + " '" + String(isoYear).slice(-2),
      totalInvested: k.totalInvested, totalValue: k.totalValue,
      totalGain: k.totalGain, totalReturn: k.totalReturn,
      mfInvested: k.mfInvested, mfValue: k.mfValue, mfCAGR: k.mfCAGR,
      stInvested: k.stInvested, stValue: k.stValue,
      fundCount: DATA.funds.length, stockCount: DATA.stocks.length,
    };

    const idx = snapshots.findIndex(s => s.weekKey === weekKey);
    if (idx >= 0) snapshots[idx] = snap; else snapshots.push(snap);
    snapshots.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
    while (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
    localStorage.setItem(LS_SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (e) { console.warn('PortFin: Could not save snapshot', e); }
}
function getSnapshots() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_SNAPSHOTS_KEY) || '[]');

    if (!Array.isArray(data)) return [];

    // keep ONLY weekly snapshots
    const cleaned = data.filter(s => typeof s?.weekKey === "string");

    // optional: overwrite storage if dirty data was found
    if (cleaned.length !== data.length) {
      localStorage.setItem(LS_SNAPSHOTS_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch {
    return [];
  }
}
function clearSnapshots() { localStorage.removeItem(LS_SNAPSHOTS_KEY); }

function showPersistBanner(savedAt) {
  const existing = document.getElementById('persist-banner');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'persist-banner';
  const dateStr = savedAt && savedAt !== true
    ? new Date(savedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'previous session';
  const msg = document.createElement('span');
  msg.style.flex = '1';
  msg.textContent = `📂 Showing portfolio saved on ${dateStr}. Upload new files to refresh.`;
  const btn = document.createElement('button');
  btn.textContent = 'Clear data';
  btn.style.cssText = 'background:transparent;border:1px solid var(--border2);border-radius:4px;color:var(--muted);padding:3px 10px;font-size:10px;cursor:pointer;flex-shrink:0';
  btn.addEventListener('click', clearAndReset);
  bar.append(msg, btn);
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--amber-bg);border-bottom:1px solid #4a3500;color:var(--amber);font-size:11px;padding:7px 20px;font-family:var(--mono)';
  const ticker = document.querySelector('.ticker');
  if (ticker) ticker.after(bar);
}

function clearAndReset() {
  if (!confirm('Clear all saved portfolio data and snapshots? This cannot be undone.')) return;
  clearStoredData();
  clearSnapshots();
  location.reload();
}

// ══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════
function fmtHoldPeriod(days) {
  if (!days || days <= 0) return '—';
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30);
  if (y > 0 && m > 0) return `${y}y ${m}m`;
  if (y > 0) return `${y}y`;
  if (m > 0) return `${m}m`;
  return `${days}d`;
}

function buildMonthlyBreakupHTML(lots, type) {
  const monthMap = {};
  lots.forEach(l => {
    if (!l.date) return;
    const d = new Date(l.date);
    if (isNaN(d)) return;
    const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!monthMap[mk]) monthMap[mk] = { invested: 0, gain: 0, lots: 0, units: 0 };
    const invested = type === 'mf' ? l.amt || 0 : l.inv || 0;
    monthMap[mk].invested += invested;
    monthMap[mk].gain += l.gain || 0;
    monthMap[mk].lots += 1;
    monthMap[mk].units += l.qty || 0;
  });
  const months = Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mk, v]) => ({ mk, ...v, retPct: v.invested > 0 ? (v.gain / v.invested) * 100 : 0 }));

  if (!months.length) return '<div style="color:var(--muted);font-size:11px;padding:10px">No monthly data available</div>';

  const totalInvested = months.reduce((a, m) => a + m.invested, 0);
  const totalGain = months.reduce((a, m) => a + m.gain, 0);
  const maxInvested = Math.max(...months.map(m => m.invested), 1);

  const yearMap = {};
  months.forEach(m => {
    const y = m.mk.slice(0, 4);
    if (!yearMap[y]) yearMap[y] = { invested: 0, gain: 0, lots: 0 };
    yearMap[y].invested += m.invested;
    yearMap[y].gain += m.gain;
    yearMap[y].lots += m.lots;
  });

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearKpis = Object.entries(yearMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([y, yv]) => {
      const retPct = yv.invested > 0 ? (yv.gain / yv.invested) * 100 : 0;
      const retColor = retPct >= 0 ? 'var(--green)' : 'var(--red)';
      return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 12px;min-width:100px;flex-shrink:0">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">${esc(y)}</div>
        <div style="font-family:var(--sans);font-size:15px;font-weight:700;color:var(--gold)">${fmtL(yv.invested)}</div>
        <div style="font-size:10px;color:${retColor};margin-top:2px">${retPct >= 0 ? '+' : ''}${retPct.toFixed(1)}% · ${yv.lots} lot${yv.lots !== 1 ? 's' : ''}</div>
      </div>`;
    }).join('');

  const monthRows = months.map(m => {
    const [y, mo] = m.mk.split('-');
    const monthName = MONTH_NAMES[parseInt(mo) - 1] + ' ' + y;
    const barWidth = Math.round((m.invested / maxInvested) * 100);
    const retColor = m.retPct >= 0 ? 'var(--green)' : 'var(--red)';
    const gainCls = m.gain >= 0 ? 'td-up' : 'td-dn';
    const unitsCol = type === 'mf'
      ? `<td style="font-size:11px;color:var(--muted);text-align:right">${m.units > 0 ? m.units.toFixed(3) : '—'}</td>`
      : `<td style="font-size:11px;color:var(--muted);text-align:right">${m.units > 0 ? fmtN(m.units) : '—'}</td>`;
    return `<tr>
      <td style="font-size:11px;font-weight:500;white-space:nowrap">${esc(monthName)}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;min-width:60px">
            <div style="height:100%;width:${barWidth}%;background:#58a6ff;border-radius:3px;transition:width .4s"></div>
          </div>
          <span style="font-size:11px;font-weight:500;min-width:72px;text-align:right">${fmtL(m.invested)}</span>
        </div>
      </td>
      ${unitsCol}
      <td class="${gainCls}" style="font-size:11px;text-align:right">${fmtL(m.gain)}</td>
      <td style="font-size:11px;text-align:right;color:${retColor};font-weight:500">${m.retPct >= 0 ? '+' : ''}${m.retPct.toFixed(2)}%</td>
      <td style="font-size:10px;color:var(--muted);text-align:right">${m.lots}</td>
    </tr>`;
  }).join('');

  const unitsHeader = type === 'mf' ? '<th style="text-align:right">Units</th>' : '<th style="text-align:right">Qty</th>';
  const totalRetPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const totGainCls = totalGain >= 0 ? 'td-up' : 'td-dn';
  const totalRetColor = totalRetPct >= 0 ? 'var(--green)' : 'var(--red)';

  return `
    <div style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Year-wise summary</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${yearKpis}</div>
    </div>
    <div style="overflow-x:auto">
      <table class="drill-table" style="min-width:480px">
        <thead><tr>
          <th>Month</th><th style="min-width:160px">Invested (with bar)</th>
          ${unitsHeader}<th style="text-align:right">Gain / Loss</th>
          <th style="text-align:right">Return %</th><th style="text-align:right">Lots</th>
        </tr></thead>
        <tbody>${monthRows}</tbody>
        <tfoot>
          <tr style="background:var(--bg3)">
            <td style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600">
              Total · ${months.length} months
            </td>
            <td style="font-size:11px;font-weight:700;color:var(--gold);padding-left:8px">${fmtL(totalInvested)}</td>
            <td></td>
            <td class="${totGainCls}" style="font-size:11px;font-weight:700;text-align:right">${fmtL(totalGain)}</td>
            <td style="font-size:11px;font-weight:700;text-align:right;color:${totalRetColor}">${totalRetPct >= 0 ? '+' : ''}${totalRetPct.toFixed(2)}%</td>
            <td style="font-size:10px;color:var(--muted);text-align:right">${lots.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">
      Monthly breakup shows total capital deployed and unrealised gain per calendar month.
    </div>`;
}

function switchDrillTab(tabGroupId, tabId) {
  const group = document.getElementById(tabGroupId);
  if (!group) return;
  group.querySelectorAll('.drill-tab-panel').forEach(p => (p.style.display = 'none'));
  group.querySelectorAll('.drill-tab-btn').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = 'var(--muted)';
    b.style.borderBottomColor = 'transparent';
  });
  const panel = document.getElementById(tabId);
  if (panel) panel.style.display = 'block';
  const btn = group.querySelector(`[data-tab="${tabId}"]`);
  if (btn) { btn.style.background = 'var(--bg4)'; btn.style.color = 'var(--gold)'; btn.style.borderBottomColor = 'var(--gold)'; }
}

function buildXirrBadge(xirr, cagr, label) {
  if (xirr === null) return '';
  const xirrColor = xirr >= 15 ? 'var(--green)' : xirr >= 8 ? 'var(--gold)' : 'var(--red)';
  const cagrDelta = xirr - (cagr || 0);
  const deltaBadge = Math.abs(cagrDelta) > 1
    ? `<span style="font-size:10px;color:var(--muted2);margin-left:6px">vs CAGR ${(cagr || 0) >= 0 ? '+' : ''}${(cagr || 0).toFixed(2)}%<span style="color:${cagrDelta > 0 ? 'var(--green)' : 'var(--red)'}">(${cagrDelta > 0 ? '+' : ''}${cagrDelta.toFixed(2)}pp)</span></span>`
    : '';
  return `<div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:6px 12px;margin-bottom:10px;font-size:11px">
    <span style="color:var(--muted)">${esc(label)} (money-weighted):</span>
    <span style="color:${xirrColor};font-weight:700;font-family:var(--sans);font-size:14px">${xirr >= 0 ? '+' : ''}${xirr.toFixed(2)}%</span>
    <span style="color:var(--muted2);font-size:10px">p.a.</span>${deltaBadge}
  </div>`;
}

function buildDrillTabBar(drillId, tabs) {
  const base = 'padding:7px 16px;font-size:11px;font-family:var(--mono);border:none;border-bottom:2px solid transparent;background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;';
  return `<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:14px;">` +
    tabs.map((tab, i) => {
      const active = i === 0 ? 'background:var(--bg4);color:var(--gold);border-bottom-color:var(--gold);' : '';
      return `<button class="drill-tab-btn" data-tab="${drillId}-${tab.id}" style="${base}${active}" onclick="switchDrillTab('${drillId}','${drillId}-${esc(tab.id)}')">${esc(tab.label)}</button>`;
    }).join('') + '</div>';
}

function buildMFDrillHTML(f) {
  if (!f.rawLots || !f.rawLots.length)
    return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';

  const lots = [...f.rawLots].filter(l => l.date && !isNaN(new Date(l.date))).sort((a, b) => a.date - b.date);
  const drillId = 'mf-drill-' + Math.random().toString(36).slice(2, 8);

  let fundXirr = null;
  try {
    const cfAmounts = [], cfDates = [];
    lots.forEach(l => { if (l.date && l.amt > 0) { cfAmounts.push(-l.amt); cfDates.push(new Date(l.date)); } });
    const currentValue = f.Current || f.Invested + (f.Gain || 0);
    if (currentValue > 0 && cfAmounts.length) { cfAmounts.push(currentValue); cfDates.push(new Date()); fundXirr = calcXIRR(cfAmounts, cfDates); }
  } catch (_) { }

  const xirrColor = fundXirr === null ? 'var(--muted)' : fundXirr >= 15 ? 'var(--green)' : fundXirr >= 8 ? 'var(--gold)' : 'var(--red)';
  const xirrDisplay = fundXirr !== null ? `<span style="color:${xirrColor};font-weight:600">${fundXirr >= 0 ? '+' : ''}${fundXirr.toFixed(2)}%</span>` : '<span style="color:var(--muted)">—</span>';

  // FIX #5: show "<1yr" note for short-hold funds where CAGR shows 0
  const shortHold = f.holdDays > 0 && f.holdDays < 183;
  const cagrDisplay = shortHold
    ? `${fmtP(f.CAGR)} <span style="font-size:9px;color:var(--amber)">(< 6mo)</span>`
    : fmtP(f.CAGR);

  let totalAmt = 0, totalGain = 0;
  const rows = lots.map(l => {
    const days = Math.floor((Date.now() - l.date.getTime()) / (24 * 3600 * 1000));
    const holdStr = fmtHoldPeriod(days);
    const taxTag = days >= 365 ? '<span class="ltcg-badge">LTCG</span>' : '<span class="stcg-badge">STCG</span>';
    const lotGainPct = l.amt > 0 ? ((l.gain / l.amt) * 100).toFixed(2) : '0.00';
    const lotCls = l.gain >= 0 ? 'td-up' : 'td-dn';
    let lotXirr = null;
    try {
      if (l.date && l.amt > 0 && days > 7) {
        const lotCurVal = l.cur || l.amt + (l.gain || 0);
        if (lotCurVal > 0) lotXirr = calcXIRR([-l.amt, lotCurVal], [new Date(l.date), new Date()]);
      }
    } catch (_) { }
    const lotXirrColor = lotXirr === null ? 'var(--muted)' : lotXirr >= 15 ? 'var(--green)' : lotXirr >= 8 ? 'var(--gold)' : 'var(--red)';
    totalAmt += l.amt || 0;
    totalGain += l.gain || 0;
    return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td>${l.invPrice > 0 ? '₹' + Number(l.invPrice).toFixed(2) : '—'}</td>
      <td>${l.qty > 0 ? l.qty.toFixed(3) : '—'}</td>
      <td>${fmtL(l.amt)}</td>
      <td class="${lotCls}">${fmtL(l.gain)}</td>
      <td class="${lotCls}">${l.amt > 0 ? (l.gain >= 0 ? '+' : '') + lotGainPct + '%' : '—'}</td>
      <td style="color:${lotXirrColor};font-weight:${lotXirr !== null ? '600' : '400'}">${lotXirr !== null ? (lotXirr >= 0 ? '+' : '') + lotXirr.toFixed(2) + '%' : '—'}</td>
      <td>${holdStr}</td><td>${taxTag}</td>
    </tr>`;
  }).join('');

  const totalRetPct = totalAmt > 0 ? ((totalGain / totalAmt) * 100).toFixed(2) : '0.00';
  const totCls = totalGain >= 0 ? 'td-up' : 'td-dn';
  const footer = `<tr style="background:var(--bg3)">
    <td style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Total · ${lots.length} lot${lots.length !== 1 ? 's' : ''}</td>
    <td></td><td></td>
    <td style="font-weight:600">${fmtL(totalAmt)}</td>
    <td class="${totCls}" style="font-weight:600">${fmtL(totalGain)}</td>
    <td class="${totCls}" style="font-weight:600">${totalAmt > 0 ? (totalGain >= 0 ? '+' : '') + totalRetPct + '%' : '—'}</td>
    <td style="color:${xirrColor};font-weight:700">${xirrDisplay}</td>
    <td colspan="2" style="color:var(--muted2);font-size:10px">← fund XIRR</td>
  </tr>`;

  const lotTableHTML = `<table class="drill-table">
    <thead><tr><th>Buy date</th><th>Buy NAV</th><th>Units</th><th>Invested</th><th>Gain / Loss</th><th>Return %</th><th title="Money-weighted annualised return for this lot">XIRR</th><th>Holding</th><th>Tax</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${footer}</tfoot></table>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">XIRR = money-weighted return — accounts for exact timing of each purchase.</div>`;

  const monthlyHTML = buildMonthlyBreakupHTML(lots, 'mf');
  const tabBar = buildDrillTabBar(drillId, [{ id: 'lots', label: '📋 Lot-wise breakup' }, { id: 'monthly', label: '📅 Monthly breakup' }]);

  return buildXirrBadge(fundXirr, f.CAGR, 'Fund XIRR') + tabBar +
    `<div id="${drillId}">
      <div id="${drillId}-lots" class="drill-tab-panel">${lotTableHTML}</div>
      <div id="${drillId}-monthly" class="drill-tab-panel" style="display:none">${monthlyHTML}</div>
    </div>`;
}

function buildSTDrillHTML(s) {
  if (!s.rawLots || !s.rawLots.length)
    return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';

  const lots = [...s.rawLots].filter(l => l.date && !isNaN(new Date(l.date))).sort((a, b) => a.date - b.date);
  const cmp = s.Latest_Price || 0;
  const drillId = 'st-drill-' + Math.random().toString(36).slice(2, 8);

  let stockXirr = null;
  try {
    const cfAmounts = [], cfDates = [];
    lots.forEach(l => { if (l.date && l.inv > 0) { cfAmounts.push(-l.inv); cfDates.push(new Date(l.date)); } });
    const terminalValue = cmp > 0 && s.Qty > 0 ? cmp * s.Qty
      : lots.reduce((a, l) => { const cv = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0); return a + cv; }, 0);
    if (terminalValue > 0 && cfAmounts.length) { cfAmounts.push(terminalValue); cfDates.push(new Date()); stockXirr = calcXIRR(cfAmounts, cfDates); }
  } catch (_) { }

  const sXirrColor = stockXirr === null ? 'var(--muted)' : stockXirr >= 15 ? 'var(--green)' : stockXirr >= 8 ? 'var(--gold)' : 'var(--red)';
  const xirrDisplay = stockXirr !== null ? `<span style="color:${sXirrColor};font-weight:700">${stockXirr >= 0 ? '+' : ''}${stockXirr.toFixed(2)}%</span>` : '<span style="color:var(--muted)">—</span>';

  const rows = lots.map(l => {
    const days = Math.floor((Date.now() - l.date.getTime()) / (24 * 3600 * 1000));
    const holdStr = fmtHoldPeriod(days);
    const taxTag = days >= 365 ? '<span class="ltcg-badge">LTCG</span>' : '<span class="stcg-badge">STCG</span>';
    const curVal = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0);
    const lotGain = curVal - l.inv;
    const lotPct = l.inv > 0 ? ((lotGain / l.inv) * 100).toFixed(2) : '0.00';
    const lotCls = lotGain >= 0 ? 'td-up' : 'td-dn';
    let lotXirr = null;
    try { if (l.date && l.inv > 0 && days > 7 && curVal > 0) lotXirr = calcXIRR([-l.inv, curVal], [new Date(l.date), new Date()]); } catch (_) { }
    const lotXirrColor = lotXirr === null ? 'var(--muted)' : lotXirr >= 15 ? 'var(--green)' : lotXirr >= 8 ? 'var(--gold)' : 'var(--red)';
    return `<tr>
      <td>${fmtDate(l.date)}</td><td>${l.qty > 0 ? fmtN(l.qty) : '—'}</td>
      <td>${l.invPrice > 0 ? '₹' + Number(l.invPrice).toFixed(2) : '—'}</td>
      <td>${cmp > 0 ? '₹' + cmp.toFixed(2) : '—'}</td>
      <td>${fmtL(l.inv)}</td><td style="font-weight:500">${fmtL(curVal)}</td>
      <td class="${lotCls}">${fmtL(lotGain)}</td>
      <td class="${lotCls}">${l.inv > 0 ? (lotGain >= 0 ? '+' : '') + lotPct + '%' : '—'}</td>
      <td style="color:${lotXirrColor};font-weight:${lotXirr !== null ? '600' : '400'}">${lotXirr !== null ? (lotXirr >= 0 ? '+' : '') + lotXirr.toFixed(2) + '%' : '—'}</td>
      <td>${holdStr}</td><td>${taxTag}</td>
    </tr>`;
  }).join('');

  const totalInv = lots.reduce((a, l) => a + (l.inv || 0), 0);
  const totalCurVal = lots.reduce((a, l) => { const cv = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0); return a + cv; }, 0);
  const totalGainAmt = totalCurVal - totalInv;
  const totalRetPct = totalInv > 0 ? ((totalGainAmt / totalInv) * 100).toFixed(2) : '0.00';
  const totCls = totalGainAmt >= 0 ? 'td-up' : 'td-dn';

  const footer = `<tr style="background:var(--bg3)">
    <td style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600">Total · ${lots.length} lot${lots.length !== 1 ? 's' : ''}</td>
    <td></td><td></td><td></td>
    <td style="font-weight:600">${fmtL(totalInv)}</td>
    <td style="font-weight:600">${fmtL(totalCurVal)}</td>
    <td class="${totCls}" style="font-weight:600">${fmtL(totalGainAmt)}</td>
    <td class="${totCls}" style="font-weight:600">${totalInv > 0 ? (totalGainAmt >= 0 ? '+' : '') + totalRetPct + '%' : '—'}</td>
    <td style="color:${sXirrColor};font-weight:700">${xirrDisplay}</td>
    <td colspan="2" style="color:var(--muted2);font-size:10px">← stock XIRR</td>
  </tr>`;

  const lotsForMonthly = lots.map(l => {
    const curVal = cmp > 0 && l.qty > 0 ? cmp * l.qty : l.cur || l.inv + (l.gain || 0);
    return { ...l, gain: curVal - l.inv };
  });

  const lotTableHTML = `<table class="drill-table">
    <thead><tr><th>Buy Date</th><th>Qty</th><th>Buy Price</th><th>CMP</th><th>Invested</th><th>Cur. Value</th><th>P&amp;L</th><th>Return %</th><th title="Money-weighted annualised return for this lot">XIRR</th><th>Holding</th><th>Tax</th></tr></thead>
    <tbody>${rows}</tbody><tfoot>${footer}</tfoot></table>
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.6">XIRR = money-weighted return — accounts for exact timing of each purchase.</div>`;

  const monthlyHTML = buildMonthlyBreakupHTML(lotsForMonthly, 'st');
  const tabBar = buildDrillTabBar(drillId, [{ id: 'lots', label: '📋 Lot-wise breakup' }, { id: 'monthly', label: '📅 Monthly breakup' }]);

  return buildXirrBadge(stockXirr, s.CAGR, 'Stock XIRR') + tabBar +
    `<div id="${drillId}">
      <div id="${drillId}-lots" class="drill-tab-panel">${lotTableHTML}</div>
      <div id="${drillId}-monthly" class="drill-tab-panel" style="display:none">${monthlyHTML}</div>
    </div>`;
}

function toggleDrill(type, i) {
  const row = document.getElementById(`drill-${type}-${i}`);
  const btn = document.getElementById(`drill-btn-${type}-${i}`);
  if (!row) return;
  const open = row.style.display === 'none';
  row.style.display = open ? 'table-row' : 'none';
  if (btn) btn.textContent = open ? '▼' : '▶';
}

// ══════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
  localStorage.setItem('portfin-theme', isLight ? 'light' : 'dark');
}
(function initTheme() {
  if (localStorage.getItem('portfin-theme') === 'light') {
    document.documentElement.classList.add('light');
    const b = document.getElementById('theme-toggle-btn');
    if (b) b.textContent = '🌙';
  }
})();

// ══════════════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ══════════════════════════════════════════════════════════════
function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
}
function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}
document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', closeSidebar);
});

// ══════════════════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════════════════
function exportCSV(type) {
  let rows = [], headers = [];
  if (type === 'mf') {
    if (!DATA.funds.length) { alert('No MF data to export. Upload a file first.'); return; }
    headers = ['Fund Name', 'Category', 'Lots', 'Invested (₹)', 'Current Value (₹)', 'Gain/Loss (₹)', 'Return (%)', 'CAGR (%)', 'Holding Days'];
    rows = DATA.funds.map(f => ['"' + f.name.replace(/"/g, '""') + '"', f.Category, f.Lots, f.Invested.toFixed(2), f.Current.toFixed(2), f.Gain.toFixed(2), f.RetPct.toFixed(2), f.CAGR.toFixed(2), f.holdDays || 0]);
  } else {
    if (!DATA.stocks.length) { alert('No stocks data to export. Upload a file first.'); return; }
    headers = ['Stock', 'Sector', 'Quantity', 'CMP (₹)', 'Invested (₹)', 'Market Value (₹)', 'P&L (₹)', 'Return (%)', 'CAGR (%)', 'Holding Days'];
    rows = DATA.stocks.map(s => ['"' + s.name.replace(/"/g, '""') + '"', s.Sector, s.Qty, s.Latest_Price.toFixed(2), s.Invested.toFixed(2), s.Current.toFixed(2), s.Gain.toFixed(2), s.RetPct.toFixed(2), s.CAGR.toFixed(2), s.holdDays || 0]);
  }
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url; a.download = (type === 'mf' ? 'mutual_funds' : 'stocks') + '_portfolio.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ══════════════════════════════════════════════════════════════
// SHARED KPI CARD GRID
// ══════════════════════════════════════════════════════════════
function renderKpiCards(cards) {
  return cards.map(c =>
    `<div class="kpi-card" style="--accent:${c.a || 'var(--gold)'}">` +
    `<div class="kpi-label">${esc(c.l)}</div>` +
    `<div class="kpi-value">${c.v}</div>` +
    `<div class="kpi-sub ${c.sc || ''}">${c.s || ''}</div>` +
    `</div>`
  ).join('');
}
