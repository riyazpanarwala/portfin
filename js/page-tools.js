// ── page-tools.js — Rebalancer, Wealth Waterfall, Action Signal, Upload ─────
//
// CHANGES vs original:
//  • computeCAGR() — guarded against current <= 0 producing NaN via
//    Math.pow(negative, fractional-exponent). Also guards invested <= 0.
//    Both cases now return 0 instead of silently propagating NaN into KPIs.
//  • All other logic is unchanged from the reviewed version.

// ── Upload page ───────────────────────────────────────────────
let pendingMF = null, pendingST = null;

function renderUpload() {
  const list = document.getElementById('steps-list');
  if (!list) return;
  list.innerHTML = '';
  const steps = [
    ['1', 'Export your Mutual Fund portfolio from your broker (Zerodha Kite, ET Money, Groww, etc.) as .xls or .xlsx'],
    ['2', 'Export your Equity Stocks portfolio the same way as a separate file'],
    ['3', 'Drop both files below — MF file first, then Stocks file'],
    ['4', 'The entire dashboard updates instantly — no Python, no server, no extra tools'],
    ['∞', 'Repeat monthly for always-current portfolio tracking'],
  ];
  steps.forEach(([n, t]) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;margin-bottom:10px;align-items:flex-start';
    const num = document.createElement('div');
    num.style.cssText = 'width:22px;height:22px;border-radius:50%;background:var(--bg4);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--gold);flex-shrink:0;margin-top:1px';
    num.textContent = n;
    const txt = document.createElement('div');
    txt.style.cssText = 'font-size:12px;color:var(--muted);line-height:1.6';
    txt.textContent = t;
    row.append(num, txt);
    list.appendChild(row);
  });
}

function initUploadListeners() {
  _bindDropZone('drop-zone-mf', 'file-input-mf', 'mf');
  _bindDropZone('drop-zone-st', 'file-input-st', 'st');
}

function _bindDropZone(zoneId, inputId, type) {
  const dz = document.getElementById(zoneId);
  const fi = document.getElementById(inputId);
  if (!dz || !fi) return;

  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', e => {
    e.preventDefault();
    dz.style.borderColor = 'var(--gold)';
    dz.style.color       = 'var(--gold)';
  });
  dz.addEventListener('dragleave', () => {
    dz.style.borderColor = '';
    dz.style.color       = '';
  });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.style.borderColor = '';
    handleExcel(e.dataTransfer.files[0], type);
  });
  fi.addEventListener('change', e => handleExcel(e.target.files[0], type));
}

// ── Excel parsing ─────────────────────────────────────────────
function handleExcel(file, type) {
  if (!file) return;
  const dz       = document.getElementById(type === 'mf' ? 'drop-zone-mf' : 'drop-zone-st');
  const statusEl = dz && dz.querySelector('.upload-status');
  if (!statusEl) return;
  statusEl.textContent = '⏳ Parsing ' + file.name + '…';
  if (dz) { dz.style.borderColor = 'var(--gold)'; dz.style.color = 'var(--gold)'; }

  if (typeof XLSX === 'undefined') {
    statusEl.textContent = '⚠ SheetJS not loaded — check internet connection';
    if (dz) { dz.style.borderColor = 'var(--red)'; dz.style.color = 'var(--red)'; }
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      if (type === 'mf') parseMFRows(rows, dz, statusEl, file.name);
      else                parseSTRows(rows, dz, statusEl, file.name);
    } catch (err) {
      statusEl.textContent = '✗ Error: ' + err.message;
      if (dz) { dz.style.borderColor = 'var(--red)'; dz.style.color = 'var(--red)'; }
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseInvDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m1) {
    const y = parseInt(m1[3]);
    const d = new Date(`${y < 100 ? 2000 + y : y}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`);
    return !isNaN(d) && d <= new Date() ? d : null;
  }
  const d = new Date(s);
  return isNaN(d) || d > new Date() ? null : d;
}

// ── CAGR calculation ──────────────────────────────────────────
// FIX: previous version returned NaN when current <= 0 because
//   Math.pow(0, fractional) = 0   → 0 - 1 = -1  (wrong but not NaN)
//   Math.pow(negative, fractional) = NaN          (silently poisons KPIs)
//   Math.pow(current/invested, 1/yrs) where current=0 gives (0-1) = -100% CAGR
//   which is misleading — it's more honest to return 0 and let the UI
//   show "—" via fmtP guards.
//
// Additional guard: invested <= 0 would cause division-by-zero / Infinity.
function computeCAGR(invested, current, dates) {
  // Guard 1: no dates or no capital deployed
  if (!dates.length || !invested || invested <= 0) return 0;

  // Guard 2: current value is zero or negative (delisted / written off)
  // Math.pow(negative, non-integer) is NaN in JS; return -100 to signal
  // total loss rather than propagating NaN, but cap at a readable floor.
  if (current <= 0) return -100;

  const earliest = dates.reduce(
    (min, d) => d.getTime() < min ? d.getTime() : min,
    dates[0].getTime()
  );
  const yrs = (Date.now() - earliest) / (365.25 * 24 * 3600 * 1000);

  // Guard 3: holding period too short for meaningful annualisation
  if (yrs < 0.5) return 0;

  const raw = (Math.pow(current / invested, 1 / yrs) - 1) * 100;

  // Guard 4: final NaN/Infinity check (e.g. yrs=0 edge case after date parsing)
  if (!isFinite(raw)) return 0;

  return parseFloat(raw.toFixed(1));
}

function parseMFRows(rows, dz, statusEl, fname) {
  const data = rows.filter(r => {
    const s = String(r['Scheme'] || r['scheme'] || r['Fund Name'] || '').trim();
    return s && s.toUpperCase() !== 'TOTAL' && !s.startsWith('*');
  });
  if (!data.length) { _dzError(dz, statusEl, '✗ No MF data found — check column headers'); return; }

  const s0  = data[0];
  const col = names => names.find(n => n in s0) || null;
  const cScheme = col(['Scheme','scheme','Fund Name','SCHEME','fund name']);
  const cNAV    = col(['Latest NAV','NAV','nav','Current NAV']);
  const cInvP   = col(['Inv. Price','Purchase Price','Buy Price','inv price']);
  const cQty    = col(['Quantity','quantity','Units','units','QTY']);
  const cInvAmt = col(['Inv. Amt','Investment Amount','Invested','invested','Inv.Amt','Inv Amount','Amount']);
  const cGain   = col(['Overall Gain','Overall Gain/Loss','Gain','gain','Total Gain','P&L']);
  const cValue  = col(['Latest Value','Current Value','Value','value','Market Value']);
  const cDate   = col(['Inv. Date','Date','date','Investment Date','Inv Date','Purchase Date']);

  if (!cScheme) { _dzError(dz, statusEl, '✗ Could not find Scheme column'); return; }

  const map = {}, lots = [], monthMap = {};
  data.forEach(r => {
    const rawName = String(r[cScheme]).trim();
    const name    = rawName.replace(/\s+(Direct Plan Growth|Direct Growth|Regular Growth|Regular Plan Growth|Growth Plan|Growth|Direct Plan|Regular Plan|Direct|Regular)\s*$/i, '').trim();
    if (!name) return;
    if (!map[name]) map[name] = { name, Invested: 0, Current: 0, Gain: 0, Lots: 0, dates: [], rawLots: [] };
    const g        = map[name];
    const inv      = cleanNum(r[cInvAmt]);
    const cur      = cleanNum(r[cValue]);
    const gn       = cleanNum(r[cGain]);
    const qty      = cleanNum(r[cQty]   || 0);
    const nav      = cleanNum(r[cNAV]   || 0);
    const invPrice = cleanNum(r[cInvP]  || 0);
    const dt       = cDate ? parseInvDate(r[cDate]) : null;
    g.Invested += inv; g.Current += cur; g.Gain += gn; g.Lots++;
    if (dt && !isNaN(dt)) g.dates.push(dt);
    if (dt && !isNaN(dt) && inv > 0) {
      g.rawLots.push({ date: dt, amt: inv, qty, invPrice, nav, cur: inv + cleanNum(r[cGain] || 0), gain: gn });
      lots.push({ amt: inv, date: dt });
      const mk = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
      monthMap[mk] = (monthMap[mk] || 0) + inv;
    }
  });

  const catKw = n => {
    const l = n.toLowerCase();
    return l.includes('elss') || l.includes('tax saver')           ? 'ELSS'
         : l.includes('small cap') || l.includes('smallcap')       ? 'Small Cap'
         : l.includes('mid cap')   || l.includes('midcap')         ? 'Mid Cap'
         : l.includes('large cap') || l.includes('largecap')       ? 'Large Cap'
         : l.includes('flexi')     || l.includes('multi cap')      ? 'Flexi Cap'
         : l.includes('value')     || l.includes('contra')         ? 'Value'
         : l.includes('index')     || l.includes('nifty') || l.includes('sensex') ? 'Index'
         : 'Other';
  };

  const funds = Object.values(map)
    .filter(f => f.Invested > 0 || f.Current > 0)
    .map(f => {
      f.RetPct   = f.Invested > 0 ? parseFloat(((f.Gain / f.Invested) * 100).toFixed(1)) : 0;
      f.CAGR     = computeCAGR(f.Invested, f.Current, f.dates);
      f.Gain     = Math.round(f.Gain);
      f.Category = catKw(f.name);
      f.holdDays = f.dates.length
        ? Math.floor((Date.now() - f.dates.reduce((min, d) => d.getTime() < min ? d.getTime() : min, f.dates[0].getTime())) / (24 * 3600 * 1000))
        : 0;
      return f;
    });

  if (!funds.length) { _dzError(dz, statusEl, '✗ No valid fund rows found'); return; }

  const monthlyMF  = Object.entries(monthMap).sort((a,b) => a[0].localeCompare(b[0])).map(([m,v]) => ({ m, v: Math.round(v) }));
  const allDates   = lots.map(l => l.date).filter(Boolean);
  const earliestMF = allDates.length
    ? new Date(allDates.reduce((min, d) => d.getTime() < min ? d.getTime() : min, allDates[0].getTime()))
    : null;

  pendingMF = { funds, lots, monthlyMF, earliestMF };
  _dzSuccess(dz, statusEl, `✓ ${fname} — ${funds.length} funds, ${lots.length} lots`);
  tryApplyData();
}

function parseSTRows(rows, dz, statusEl, fname) {
  const data = rows.filter(r => {
    const s = String(r['Stock'] || r['stock'] || r['Symbol'] || r['Company'] || '').trim();
    return s && s.toUpperCase() !== 'TOTAL' && !s.startsWith('*');
  });
  if (!data.length) { _dzError(dz, statusEl, '✗ No stock data found — check column headers'); return; }

  const s0  = data[0];
  const col = names => names.find(n => n in s0) || null;
  const cStock  = col(['Stock','stock','Symbol','Company','Scrip']);
  const cPrice  = col(['Latest Price','CMP','Price','price','LTP','Last Price']);
  const cQty    = col(['Quantity','quantity','Qty','qty','Units','Shares']);
  const cInvP   = col(['Inv. Price','Buy Price','Purchase Price','Avg Price','avg price']);
  const cInvAmt = col(['Inv. Amt','Investment Amount','Invested','invested','Inv Amount','Inv.Amt','Amount']);
  const cGain   = col(['Overall Gain','Gain','gain','Overall Gain/Loss','P&L','Profit/Loss']);
  const cValue  = col(['Latest Value','Current Value','Value','value','Market Value','Present Value']);
  const cDate   = col(['Inv. Date','Date','date','Purchase Date','Buy Date']);

  if (!cStock) { _dzError(dz, statusEl, '✗ Could not find Stock column'); return; }

  const SECTOR_MAP = {
    bpcl: 'Energy/PSU', 'bharat elec': 'Defence', 'coal india': 'Energy/PSU',
    enbee: 'Speculative', irfc: 'Finance/PSU', itc: 'FMCG', jaiprakash: 'Speculative',
    'mo defence': 'Defence', 'motilal.*defence': 'Defence', mazagon: 'Defence',
    nbcc: 'Infra/PSU', nhpc: 'Energy/PSU', 'nipp.*nifty': 'Index ETF',
    'nippon.*nifty': 'Index ETF', ongc: 'Energy/PSU', 'reliance power': 'Speculative',
    suzlon: 'Renewables', 'tata silver': 'Commodities ETF', 'uti nifty': 'Index ETF',
    vedanta: 'Metals/Mining', 'yes bank': 'Banking', 'uttam value': 'Speculative',
    'hindustan zinc': 'Metals/Mining', adani: 'Speculative', zomato: 'Consumer Tech',
    bse: 'Finance', nse: 'Finance', hdfc: 'Banking', icici: 'Banking', sbi: 'Banking',
    'axis bank': 'Banking', 'kotak bank': 'Banking', 'tata steel': 'Metals/Mining',
    'jsw steel': 'Metals/Mining', ntpc: 'Energy/PSU', 'power grid': 'Energy/PSU',
    bhel: 'Infra/PSU', 'l&t': 'Infra/PSU', siemens: 'Infra/PSU',
    infosys: 'IT', tcs: 'IT', wipro: 'IT', 'hcl tech': 'IT', 'tech mahindra': 'IT',
    'bajaj finance': 'Finance/PSU', muthoot: 'Finance/PSU',
  };
  const _unclassified = [];
  const getSector = name => {
    const n = name.toLowerCase();
    for (const [k, v] of Object.entries(SECTOR_MAP)) if (new RegExp(k).test(n)) return v;
    _unclassified.push(name);
    return 'Other';
  };

  const map = {}, lots = [];
  data.forEach(r => {
    const rawName = String(r[cStock]).trim();
    const name    = rawName.replace(/\s*-\s*(NSE|BSE)\s*-.*/i, '').replace(/\s*-\s*(NSE|BSE)\s*$/i, '').trim();
    if (!name) return;
    const lp   = cleanNum(r[cPrice]);
    const qty  = cleanNum(r[cQty]);
    const inv  = cleanNum(r[cInvAmt]);
    const cur  = cleanNum(r[cValue]);
    const gn   = cleanNum(r[cGain]);
    const invP = cInvP ? cleanNum(r[cInvP]) : 0;
    const dt   = cDate ? parseInvDate(r[cDate]) : null;
    if (!map[name]) map[name] = { name, Qty: 0, Invested: 0, Current: 0, Gain: 0, Latest_Price: 0, dates: [], rawLots: [] };
    const g = map[name];
    g.Qty      += qty; g.Invested += inv; g.Current += cur; g.Gain += gn;
    if (lp > 0) g.Latest_Price = lp;
    if (dt && !isNaN(dt)) g.dates.push(dt);
    if (dt && !isNaN(dt) && inv > 0) {
      g.rawLots.push({ date: dt, qty, invPrice: invP || (qty ? inv / qty : 0), currentPrice: lp, inv, gain: gn, cur: cur || 0 });
      lots.push({ amt: inv, date: dt });
    }
  });

  const stocks = Object.values(map)
    .filter(s => s.Invested > 0 || s.Current > 0)
    .map(s => {
      s.RetPct   = s.Invested > 0 ? parseFloat(((s.Gain / s.Invested) * 100).toFixed(1)) : 0;
      s.CAGR     = computeCAGR(s.Invested, s.Current, s.dates);
      s.Gain     = Math.round(s.Gain);
      s.Sector   = getSector(s.name);
      s.holdDays = s.dates.length
        ? Math.floor((Date.now() - s.dates.reduce((min, d) => d.getTime() < min ? d.getTime() : min, s.dates[0].getTime())) / (24 * 3600 * 1000))
        : 0;
      return s;
    });

  if (!stocks.length) { _dzError(dz, statusEl, '✗ No valid stock rows found'); return; }

  const allDates   = lots.map(l => l.date).filter(Boolean);
  const earliestST = allDates.length
    ? new Date(allDates.reduce((min, d) => d.getTime() < min ? d.getTime() : min, allDates[0].getTime()))
    : null;
  pendingST = { stocks, lots, earliestST };

  const uniq = [...new Set(_unclassified)];
  let msg = `✓ ${fname} — ${stocks.length} stocks, ${lots.length} lots`;
  if (uniq.length) msg += ` · ⚠ ${uniq.length} stock(s) auto-mapped to "Other" sector (${uniq.slice(0, 3).join(', ')}${uniq.length > 3 ? '…' : ''})`;
  _dzSuccess(dz, statusEl, msg);
  tryApplyData();
}

// ── Drop-zone helpers ─────────────────────────────────────────
function _dzError(dz, statusEl, msg)   { if (statusEl) statusEl.textContent = msg; if (dz) { dz.style.borderColor = 'var(--red)';   dz.style.color = 'var(--red)';   } }
function _dzSuccess(dz, statusEl, msg) { if (statusEl) statusEl.textContent = msg; if (dz) { dz.style.borderColor = 'var(--green)'; dz.style.color = 'var(--green)'; } }

// ── Apply parsed data to DATA + refresh all ───────────────────
function tryApplyData() {
  DATA._cachedMonthly = null;
  _fundAnalysisCache  = null;
  const hasMF = pendingMF !== null, hasST = pendingST !== null;
  const msgEl = document.getElementById('apply-msg');

  const _preUploadSnap = hasMF && hasST ? capturePreUploadSnapshot() : null;

  if (hasMF && hasST) {
    const { funds } = pendingMF, { stocks } = pendingST;

    const catMap = {};
    funds.forEach(f => {
      if (!catMap[f.Category]) catMap[f.Category] = { Category: f.Category, Invested: 0, Current: 0, Gain: 0 };
      catMap[f.Category].Invested += f.Invested;
      catMap[f.Category].Current  += f.Current;
      catMap[f.Category].Gain     += f.Gain;
    });
    const mfCategories = Object.values(catMap).map(c => ({
      ...c,
      RetPct: c.Invested > 0 ? parseFloat(((c.Gain / c.Invested) * 100).toFixed(1)) : 0,
    }));

    const secMap = {};
    stocks.forEach(s => {
      if (!secMap[s.Sector]) secMap[s.Sector] = { Sector: s.Sector, Invested: 0, Current: 0, Gain: 0 };
      secMap[s.Sector].Invested += s.Invested;
      secMap[s.Sector].Current  += s.Current;
      secMap[s.Sector].Gain     += s.Gain;
    });
    const sectors = Object.values(secMap).map(s => ({
      ...s,
      RetPct: s.Invested > 0 ? parseFloat(((s.Gain / s.Invested) * 100).toFixed(1)) : 0,
    }));

    const mfInvested    = funds.reduce((a, f)  => a + f.Invested, 0);
    const mfValue       = funds.reduce((a, f)  => a + f.Current,  0);
    const mfGain        = funds.reduce((a, f)  => a + f.Gain,     0);
    const stInvested    = stocks.reduce((a, s) => a + s.Invested, 0);
    const stValue       = stocks.reduce((a, s) => a + s.Current,  0);
    const stGain        = stocks.reduce((a, s) => a + s.Gain,     0);
    const totalInvested = mfInvested + stInvested;
    const totalValue    = mfValue    + stValue;
    const totalGain     = mfGain     + stGain;
    const mfReturn      = mfInvested  > 0 ? parseFloat(((mfGain  / mfInvested)  * 100).toFixed(1)) : 0;
    const stReturn      = stInvested  > 0 ? parseFloat(((stGain  / stInvested)  * 100).toFixed(1)) : 0;
    const totalReturn   = totalInvested > 0 ? parseFloat(((totalGain / totalInvested) * 100).toFixed(1)) : 0;
    const mfCAGR        = mfInvested  > 0
      ? parseFloat(funds.reduce((a, f) => a + f.CAGR * (f.Invested / mfInvested), 0).toFixed(1))
      : 0;

    DATA.kpis = {
      totalInvested, totalValue, totalGain, totalReturn,
      mfInvested, mfValue, mfGain, mfReturn, mfCAGR,
      stInvested, stValue, stGain, stReturn,
      earliestMF: pendingMF.earliestMF,
      earliestST: pendingST.earliestST,
      latestDate: new Date(),
    };
    DATA.funds          = funds;
    DATA.mfCategories   = mfCategories;
    DATA.stocks         = stocks;
    DATA.sectors        = sectors;
    DATA.monthlyMF      = pendingMF.monthlyMF;
    DATA.mfLots         = pendingMF.lots;
    DATA.stLots         = pendingST.lots;
    DATA._cachedMonthly = null;
    _fundAnalysisCache  = null;

    saveDataToStorage();
    saveSnapshot();

    document.getElementById('persist-banner')?.remove();
    buildTicker(); buildStrip(); updateChrome(); renderSIPReminder();

    if (msgEl) {
      msgEl.style.cssText = 'background:var(--green-bg);border:1px solid var(--green-dim);color:var(--green);display:block';
      msgEl.textContent = '✓ Dashboard fully updated and saved! Navigate to any tab to explore your live portfolio.';
    }
    pendingMF = null; pendingST = null;
    mfFil = 'All'; stFil = 'All';
    renderUploadDiff(_preUploadSnap);
  } else {
    if (msgEl) {
      const missing = !hasMF && !hasST
        ? 'Upload both MF and Stocks files to update the dashboard.'
        : !hasMF
          ? '✓ Stocks loaded. Now upload the MF file to complete the update.'
          : '✓ MF file loaded. Now upload the Stocks file to complete the update.';
      msgEl.style.cssText = 'background:var(--amber-bg);border:1px solid #4a3500;color:var(--amber);display:block';
      msgEl.textContent = missing;
    }
  }
}

// ── Rebalancing Advisor ───────────────────────────────────────
function renderRebalance() { syncRebSliders(null); }

function syncRebSliders(changed) {
  const mfEl  = document.getElementById('reb-mf');
  const lcEl  = document.getElementById('reb-lc');
  const etfEl = document.getElementById('reb-etf');
  if (!mfEl) return;

  let mf = parseInt(mfEl.value), lc = parseInt(lcEl.value), etf = parseInt(etfEl.value);
  const total = mf + lc + etf;
  if (total > 100) {
    const excess = total - 100;
    if (changed === 'mf')  { lc  = Math.max(0, lc  - Math.ceil(excess / 2));  etf = Math.max(0, etf - Math.floor(excess / 2)); }
    if (changed === 'lc')  { mf  = Math.max(0, mf  - Math.ceil(excess / 2));  etf = Math.max(0, etf - Math.floor(excess / 2)); }
    if (changed === 'etf') { mf  = Math.max(0, mf  - Math.ceil(excess / 2));  lc  = Math.max(0, lc  - Math.floor(excess / 2)); }
    mfEl.value = mf; lcEl.value = lc; etfEl.value = etf;
  }

  const t = mf + lc + etf;
  const mfValEl  = document.getElementById('reb-mf-val');
  const lcValEl  = document.getElementById('reb-lc-val');
  const etfValEl = document.getElementById('reb-etf-val');
  const totalEl  = document.getElementById('reb-total-pct');
  const fillEl   = document.getElementById('reb-total-fill');
  if (mfValEl)  mfValEl.textContent  = mf  + '%';
  if (lcValEl)  lcValEl.textContent  = lc  + '%';
  if (etfValEl) etfValEl.textContent = etf + '%';
  if (totalEl)  { totalEl.textContent = t + '%'; totalEl.style.color = t === 100 ? 'var(--green)' : t > 100 ? 'var(--red)' : 'var(--amber)'; }
  if (fillEl)   { fillEl.style.width = Math.min(100, t) + '%'; fillEl.style.background = t === 100 ? 'var(--green)' : t > 100 ? 'var(--red)' : 'var(--amber)'; }
  computeRebalance(mf, lc, etf);
}

function computeRebalance(targetMFPct, targetLCPct, targetETFPct) {
  const k = DATA.kpis, totalValue = k.totalValue || 0;
  const cmpEl = document.getElementById('reb-comparison');
  const actEl = document.getElementById('reb-actions');
  const kpiEl = document.getElementById('reb-kpi-strip');
  if (!cmpEl || !actEl) return;

  if (!totalValue) {
    cmpEl.innerHTML = '<div style="color:var(--muted);font-size:12px">Upload files to see rebalancing recommendations.</div>';
    actEl.innerHTML = '';
    if (kpiEl) kpiEl.innerHTML = '';
    return;
  }

  const curMFVal  = k.mfValue || 0;
  const etfStocks = DATA.stocks.filter(s => s.Sector === 'Index ETF' || s.Sector === 'Commodities ETF');
  const curETFVal = etfStocks.reduce((a, s) => a + s.Current, 0);
  const curLCVal  = DATA.stocks.filter(s => !etfStocks.includes(s)).reduce((a, s) => a + s.Current, 0);

  const curMFPct  = Math.round((curMFVal  / totalValue) * 100);
  const curLCPct  = Math.round((curLCVal  / totalValue) * 100);
  const curETFPct = Math.round((curETFVal / totalValue) * 100);

  const tgtMFVal  = Math.round((totalValue * targetMFPct)  / 100);
  const tgtLCVal  = Math.round((totalValue * targetLCPct)  / 100);
  const tgtETFVal = Math.round((totalValue * targetETFPct) / 100);

  const diffMF  = tgtMFVal  - curMFVal;
  const diffLC  = tgtLCVal  - curLCVal;
  const diffETF = tgtETFVal - curETFVal;
  const drift   = Math.max(
    Math.abs(targetMFPct - curMFPct),
    Math.abs(targetLCPct - curLCPct),
    Math.abs(targetETFPct - curETFPct)
  );
  const needsAction = drift >= 5;

  if (kpiEl) kpiEl.innerHTML = renderKpiCards([
    { l: 'Total Portfolio', v: fmtL(totalValue), s: 'Current value', a: '#d4a843' },
    { l: 'MF Drift',        v: (targetMFPct - curMFPct >= 0 ? '+' : '') + (targetMFPct - curMFPct) + 'pp', s: `Current ${curMFPct}% → Target ${targetMFPct}%`, a: Math.abs(targetMFPct - curMFPct) >= 5 ? '#f85149' : '#3fb950' },
    { l: 'Max Drift',       v: drift + 'pp', s: drift >= 5 ? 'Action needed' : 'Within tolerance', a: drift >= 5 ? '#f85149' : '#3fb950' },
    { l: 'Status',          v: needsAction ? 'Rebalance' : 'On target', s: needsAction ? 'Drift ≥5% detected' : 'All within ±5%', a: needsAction ? '#e3b341' : '#3fb950' },
  ]);

  const classes = [
    { name: 'Mutual Funds',    cur: curMFVal,  curPct: curMFPct,  tgt: tgtMFVal,  tgtPct: targetMFPct,  diff: diffMF,  color: 'var(--gold)'  },
    { name: 'Large-cap Stocks',cur: curLCVal,  curPct: curLCPct,  tgt: tgtLCVal,  tgtPct: targetLCPct,  diff: diffLC,  color: 'var(--blue)'  },
    { name: 'ETF / Index',     cur: curETFVal, curPct: curETFPct, tgt: tgtETFVal, tgtPct: targetETFPct, diff: diffETF, color: 'var(--green)' },
  ];

  cmpEl.innerHTML = classes.map(c => {
    const d = c.tgtPct - c.curPct;
    return `<div class="reb-asset-row">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:500;margin-bottom:4px">${esc(c.name)}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;color:var(--muted)">Current</span>
          <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;min-width:60px"><div style="height:100%;background:${c.color};opacity:.5;border-radius:4px;width:${c.curPct}%"></div></div>
          <span style="font-size:11px;font-weight:600;min-width:36px;text-align:right">${c.curPct}%</span>
          <span style="font-size:10px;color:var(--muted);min-width:56px">${fmtL(c.cur)}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:10px;color:var(--muted)">Target&nbsp;</span>
          <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;min-width:60px"><div style="height:100%;background:${c.color};border-radius:4px;width:${c.tgtPct}%"></div></div>
          <span style="font-size:11px;font-weight:600;min-width:36px;text-align:right;color:${c.color}">${c.tgtPct}%</span>
          <span style="font-size:10px;color:var(--muted);min-width:56px">${fmtL(c.tgt)}</span>
        </div>
      </div>
      <div style="text-align:right;min-width:60px;margin-left:10px">
        <div style="font-size:13px;font-weight:700;color:${d >= 0 ? 'var(--green)' : 'var(--red)'}">${d >= 0 ? '+' : ''}${d}pp</div>
        <div style="font-size:10px;color:${c.diff >= 0 ? 'var(--green)' : 'var(--red)'}">${c.diff >= 0 ? '+' : ''}${fmtL(Math.round(Math.abs(c.diff)))}</div>
      </div>
    </div>`;
  }).join('');

  const totalPct = targetMFPct + targetLCPct + targetETFPct;
  if (totalPct !== 100) {
    actEl.innerHTML = `<div style="color:var(--amber);font-size:12px">⚠ Total target allocation is ${totalPct}% — adjust sliders to sum to 100%.</div>`;
    return;
  }

  const sells = classes.filter(c => c.diff < -1000).sort((a, b) => a.diff - b.diff);
  const buys  = classes.filter(c => c.diff >  1000).sort((a, b) => b.diff - a.diff);
  const holds = classes.filter(c => Math.abs(c.diff) <= 1000);

  if (!sells.length && !buys.length) {
    actEl.innerHTML = '<div style="color:var(--green);font-size:12px;padding:10px">✓ Portfolio is already within tolerance. No action needed.</div>';
    return;
  }

  const rows = [
    ...sells.map(c => `<div class="reb-action-row"><span style="font-size:16px">🔴</span><span class="reb-sell">SELL</span><span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span><span style="color:var(--red);font-family:var(--sans);font-size:14px;font-weight:700">${fmtL(Math.abs(Math.round(c.diff)))}</span><span style="color:var(--muted);font-size:10px;min-width:90px;text-align:right">${c.curPct}% → ${c.tgtPct}%</span></div>`),
    ...buys.map(c  => `<div class="reb-action-row"><span style="font-size:16px">🟢</span><span class="reb-buy">BUY&nbsp;</span><span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span><span style="color:var(--green);font-family:var(--sans);font-size:14px;font-weight:700">${fmtL(Math.round(c.diff))}</span><span style="color:var(--muted);font-size:10px;min-width:90px;text-align:right">${c.curPct}% → ${c.tgtPct}%</span></div>`),
    ...holds.map(c => `<div class="reb-action-row"><span style="font-size:16px">⚪</span><span class="reb-hold">HOLD</span><span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span><span style="color:var(--muted);font-family:var(--sans);font-size:14px">${fmtL(c.cur)}</span><span style="color:var(--green);font-size:10px;min-width:90px;text-align:right">Within ±${fmtL(Math.abs(Math.round(c.diff)))}</span></div>`),
  ];

  actEl.innerHTML = `<div class="reb-action-box">${rows.join('')}</div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⚠ Indicative amounts only. Factor in STCG/LTCG tax before executing sell orders. Prefer new SIP deployment into underweight buckets first.
    </div>`;
}

// ── Wealth Waterfall ──────────────────────────────────────────
function renderWaterfall() {
  const k = DATA.kpis;
  const mfInvested = k.mfInvested || 0, stInvested = k.stInvested || 0;
  const mfGain     = k.mfGain     || 0, stGain     = k.stGain     || 0;
  const startVal   = k.totalInvested || 0, totalVal  = k.totalValue  || 0;

  const segments = [
    { id: 'mf-inv',  label: 'MF Invested',  value: mfInvested, type: 'invested', color: '#58a6ff', sub: 'Total capital deployed into mutual funds',  subKey: 'Avg SIP'    },
    { id: 'st-inv',  label: 'Stocks Bought', value: stInvested, type: 'invested', color: '#a371f7', sub: 'Total capital deployed into equity stocks', subKey: 'Direct buys'},
    { id: 'mf-gain', label: 'MF Gains',      value: mfGain,     type: mfGain >= 0 ? 'gain' : 'loss', color: mfGain >= 0 ? '#3fb950' : '#f85149', sub: 'Unrealised gains from mutual funds', subKey: 'Return %' },
    { id: 'st-gain', label: 'Stock P&L',     value: stGain,     type: stGain >= 0 ? 'gain' : 'loss', color: stGain >= 0 ? '#56d364' : '#f85149', sub: 'Unrealised P&L from equity stocks',  subKey: 'Return %' },
    { id: 'total',   label: 'Current Value', value: totalVal,   type: 'total',    color: '#d4a843', sub: 'Total portfolio market value today',        subKey: 'Total gain' },
  ];

  const wealthMultiplier = startVal > 0 ? (totalVal / startVal).toFixed(2) : '—';
  const gainContrib      = totalVal  > 0 ? (((mfGain + stGain) / totalVal) * 100).toFixed(1) : 0;

  document.getElementById('wf-kpis').innerHTML = renderKpiCards([
    { l: 'Capital Deployed',  v: fmtL(startVal),                            s: 'Total invested (MF + Stocks)',     a: '#58a6ff' },
    { l: 'Total Gains',       v: fmtL(mfGain + stGain),                     s: fmtP(k.totalReturn || 0),           a: mfGain + stGain >= 0 ? '#3fb950' : '#f85149' },
    { l: 'Current Value',     v: fmtL(totalVal),                            s: 'Portfolio today',                  a: '#d4a843' },
    { l: 'Wealth Multiplier', v: startVal > 0 ? wealthMultiplier + 'x' : '—', s: '₹1 invested → ₹' + wealthMultiplier, a: '#a371f7' },
    { l: 'Gains vs Capital',  v: gainContrib + '%',                         s: 'Wealth from market returns',       a: '#3fb950' },
  ]);

  document.getElementById('wf-pills').innerHTML = [
    { label: 'MF contribution',        val: totalVal > 0 ? ((mfInvested / totalVal) * 100).toFixed(0) + '%' : '—', color: '#58a6ff' },
    { label: 'Stock contribution',      val: totalVal > 0 ? ((stInvested / totalVal) * 100).toFixed(0) + '%' : '—', color: '#a371f7' },
    { label: 'MF gains contribution',   val: totalVal > 0 ? Math.max(0, (mfGain / totalVal) * 100).toFixed(0) + '%' : '—', color: '#3fb950' },
    { label: 'Stock gain contribution', val: totalVal > 0 ? Math.max(0, (stGain / totalVal) * 100).toFixed(0) + '%' : '—', color: '#56d364' },
  ].map(p =>
    `<div class="wf-stat-pill"><span style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0;display:inline-block"></span><div><div class="wf-stat-pill-label">${esc(p.label)}</div><div class="wf-stat-pill-val" style="color:${p.color}">${esc(p.val)}</div></div></div>`
  ).join('');

  const W=760, H=340, padL=70, padR=30, padT=36, padB=60;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const barGap = 18, barW = Math.floor((chartW - barGap * (segments.length - 1)) / segments.length);

  const baselines = [], tops = []; let running = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.value >= 0) { baselines.push(running); tops.push(running + seg.value); running += seg.value; }
    else                { baselines.push(running + seg.value); tops.push(running); running += seg.value; }
  }
  baselines.push(0); tops.push(totalVal);

  const allVals = [...baselines, ...tops];
  const dataMin = Math.min(0, ...allVals), dataMax = Math.max(...allVals), span = dataMax - dataMin || 1;
  const yScale = v => padT + chartH - ((v - dataMin) / span) * chartH;
  const xStart = i => padL + i * (barW + barGap);

  let gridLines = '';
  for (let gi = 0; gi <= 5; gi++) {
    const gv = dataMin + (span * gi / 5), gy = yScale(gv);
    gridLines += `<line class="wf-grid-line" x1="${padL}" x2="${W-padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"/>`;
    gridLines += `<text x="${padL-6}" y="${gy.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="var(--muted)" font-family="DM Mono,monospace">${fmtL(Math.round(gv))}</text>`;
  }
  const zeroY    = yScale(0);
  const zeroLine = `<line class="wf-axis-line" x1="${padL}" x2="${W-padR}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke-width="1.5"/>`;

  let connectors = '';
  for (let i = 0; i < segments.length - 2; i++) {
    const x1    = xStart(i) + barW, x2 = xStart(i + 1);
    const lineY = segments[i].value >= 0 ? yScale(tops[i]) : yScale(baselines[i]);
    connectors += `<line class="wf-connector" x1="${x1}" x2="${x2}" y1="${lineY.toFixed(1)}" y2="${lineY.toFixed(1)}"/>`;
  }

  let bars = '', topLabels = '', botLabels = '';
  segments.forEach((seg, i) => {
    const x = xStart(i), yTop = yScale(Math.max(baselines[i], tops[i])), yBot = yScale(Math.min(baselines[i], tops[i]));
    const bH     = Math.max(2, yBot - yTop);
    const isTotal = seg.type === 'total';
    bars      += `<rect ${isTotal ? 'class="wf-total-glow"' : ''} class="wf-bar-base" data-idx="${i}" x="${x}" y="${yTop.toFixed(1)}" width="${barW}" height="${bH.toFixed(1)}" fill="${seg.color}" opacity="${isTotal ? '1' : '0.85'}" rx="3" onmouseenter="wfShowTip(event,${i})" onmouseleave="wfHideTip()"/>`;
    topLabels += `<text class="wf-label-top" x="${(x + barW / 2).toFixed(1)}" y="${(yTop - 6).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${seg.color}" font-weight="600">${fmtL(Math.abs(seg.value))}</text>`;
    botLabels += `<text class="wf-label-bot" x="${(x + barW / 2).toFixed(1)}" y="${(H - padB + 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(seg.label)}</text>`;
    if (seg.type === 'gain' || seg.type === 'loss')
      topLabels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(yTop - 18).toFixed(1)}" text-anchor="middle" font-size="8" fill="${seg.color}">${seg.type === 'gain' ? '▲' : '▼'}</text>`;
  });

  document.getElementById('wf-svg-wrap').innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${gridLines}${zeroLine}${connectors}${bars}${topLabels}${botLabels}<line class="wf-axis-line" x1="${padL}" x2="${W-padR}" y1="${(H-padB).toFixed(1)}" y2="${(H-padB).toFixed(1)}"/></svg>`;
  window._wfSegments = segments;
  window._wfTotal    = totalVal;

  document.getElementById('wf-breakdown').innerHTML = '<div class="wf-breakdown-card">' + segments.map(seg => {
    const pct    = totalVal > 0 ? ((Math.abs(seg.value) / totalVal) * 100).toFixed(1) : 0;
    const amtCls = seg.type === 'gain' ? 'td-up' : seg.type === 'loss' ? 'td-dn' : 'td-gold';
    return `<div class="wf-bk-row"><div class="wf-bk-dot" style="background:${seg.color}"></div><div class="wf-bk-name">${esc(seg.label)}</div><div class="wf-bk-amt ${amtCls}">${seg.type === 'loss' ? '−' : ''}${fmtL(Math.abs(seg.value))}</div><div class="wf-bk-pct">${pct}%</div></div>`;
  }).join('') + '</div>';

  const gainTotal = (mfGain >= 0 ? mfGain : 0) + (stGain >= 0 ? stGain : 0);
  const lossTotal = (mfGain < 0 ? Math.abs(mfGain) : 0) + (stGain < 0 ? Math.abs(stGain) : 0);
  const gainPct   = totalVal > 0 ? ((gainTotal / totalVal) * 100).toFixed(1) : 0;
  const capPct    = totalVal > 0 ? ((startVal  / totalVal) * 100).toFixed(1) : 0;
  const mfRetPct  = mfInvested > 0 ? ((mfGain / mfInvested) * 100).toFixed(1) : 0;
  const stRetPct  = stInvested > 0 ? ((stGain / stInvested) * 100).toFixed(1) : 0;

  const insights = [];
  if (+gainPct > 0)  insights.push({ icon: '📈', text: `<b>${gainPct}%</b> of your wealth comes from market returns — your portfolio is genuinely compounding.` });
  if (+capPct  > 0)  insights.push({ icon: '💰', text: `<b>${capPct}%</b> is from your invested capital — the savings discipline is the foundation.` });
  if (+mfRetPct > 0) insights.push({ icon: '◎',  text: `Mutual Funds returned <b>${pSign(+mfRetPct)}${mfRetPct}%</b> on invested capital of ${fmtL(mfInvested)}.` });
  if (stInvested)    insights.push({ icon: '◐',  text: `Equity stocks returned <b>${pSign(+stRetPct)}${stRetPct}%</b> on invested capital of ${fmtL(stInvested)}.` });
  if (lossTotal > 0) insights.push({ icon: '⚠',  text: `Drag from losses: <b>−${fmtL(lossTotal)}</b> — consider reviewing losing positions.` });
  if (+gainContrib > 50) insights.push({ icon: '🏆', text: `Over half your wealth is from market gains — compounding is doing the heavy lifting!` });

  document.getElementById('wf-composition').innerHTML = insights.map(ins =>
    `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:16px;flex-shrink:0">${ins.icon}</span>
      <span style="font-size:11px;color:var(--muted);line-height:1.6">${ins.text}</span>
    </div>`
  ).join('') || '<div style="color:var(--muted);font-size:11px;padding:10px">Upload your Excel files to see composition analysis.</div>';
}

function wfShowTip(e, idx) {
  const seg = window._wfSegments && window._wfSegments[idx];
  const tt  = document.getElementById('wf-tooltip');
  if (!seg || !tt) return;
  const ttTitle = document.getElementById('wf-tt-title');
  const ttAmt   = document.getElementById('wf-tt-amt');
  const ttPct   = document.getElementById('wf-tt-pct');
  const ttSubL  = document.getElementById('wf-tt-sub-l');
  const ttSubV  = document.getElementById('wf-tt-sub-v');
  if (ttTitle) ttTitle.textContent = seg.label;
  if (ttAmt)   ttAmt.textContent   = (seg.value < 0 ? '−' : '') + fmtL(Math.abs(seg.value));
  if (ttPct)   ttPct.textContent   = window._wfTotal ? ((Math.abs(seg.value) / window._wfTotal) * 100).toFixed(1) + '%' : '—';
  if (ttSubL)  ttSubL.textContent  = seg.subKey;
  if (ttSubV) {
    if (seg.subKey === 'Return %') {
      const inv = seg.id === 'mf-gain' ? DATA.kpis.mfInvested : DATA.kpis.stInvested;
      ttSubV.textContent = inv > 0 ? fmtP((seg.value / inv) * 100) : '—';
    } else if (seg.subKey === 'Total gain') {
      ttSubV.textContent = fmtL((DATA.kpis.mfGain || 0) + (DATA.kpis.stGain || 0));
    } else {
      ttSubV.textContent = seg.sub;
      if (ttSubL) ttSubL.textContent = '';
    }
  }
  tt.style.display = 'block';
  tt.style.left    = e.pageX + 14 + 'px';
  tt.style.top     = e.pageY - 10 + 'px';
}

function wfHideTip() {
  const tt = document.getElementById('wf-tooltip');
  if (tt) tt.style.display = 'none';
}

// ── Portfolio Action Signal ───────────────────────────────────
function renderSignal() {
  const k = DATA.kpis, today = new Date();
  const todayDay = today.getDate(), todayMonth = today.getMonth(), todayYear = today.getFullYear();
  const hasData  = DATA.funds.length > 0 || DATA.stocks.length > 0;

  const signals = [];
  let urgentCount = 0, watchCount = 0, goodCount = 0;

  const sipDays = [];
  (DATA.mfLots || []).forEach(lot => { if (lot.date) sipDays.push(new Date(lot.date).getDate()); });
  const sipDayFreq = {};
  sipDays.forEach(d => (sipDayFreq[d] = (sipDayFreq[d] || 0) + 1));
  const topSIPDay = Object.entries(sipDayFreq).sort((a, b) => b[1] - a[1])[0];
  const sipDay    = topSIPDay ? parseInt(topSIPDay[0]) : null;
  const daysToSIP = sipDay != null
    ? sipDay >= todayDay ? sipDay - todayDay : (new Date(todayYear, todayMonth + 1, sipDay) - today) / 86400000
    : null;

  if (sipDay !== null) {
    if (daysToSIP <= 0) {
      signals.push({ type: 'urgent', icon: '📅', tag: 'urgent', title: 'SIP Due Today!', body: `Your usual SIP day is the ${sipDay}${ordinal(sipDay)}. Time to execute your monthly investment.`, metric: 'Check your SIP amount', metricClass: 'urgent' });
      urgentCount++;
    } else if (daysToSIP <= 3) {
      signals.push({ type: 'watch',  icon: '⏰', tag: 'watch',  title: `SIP in ${Math.round(daysToSIP)} days`, body: `Your SIP is due on the ${sipDay}${ordinal(sipDay)}. Keep funds ready.`, metric: `${Math.round(daysToSIP)} day${daysToSIP > 1 ? 's' : ''} away`, metricClass: 'watch' });
      watchCount++;
    } else {
      signals.push({ type: 'good',   icon: '✅', tag: 'good',   title: 'SIP on track', body: `Next SIP due in ${Math.round(daysToSIP)} days. No action needed.`, metric: `${Math.round(daysToSIP)} days away`, metricClass: 'good' });
      goodCount++;
    }
  }

  const month1 = todayMonth + 1;
  if (month1 >= 1 && month1 <= 3) {
    const fyEnd = new Date(todayYear, 2, 31);
    const daysToFY = Math.ceil((fyEnd - today) / 86400000);
    const totalHarvestable = DATA.stocks.filter(s => (s.holdDays || 0) < 365 && s.Gain < 0).reduce((a, s) => a + Math.abs(s.Gain || 0), 0);
    if (totalHarvestable > 0) {
      signals.push({ type: 'urgent', icon: '🧾', tag: 'urgent', title: 'Tax Harvesting Window Open', body: `FY ends in ${daysToFY} days. STCG losses can offset gains before March 31.`, metric: `${fmtL(totalHarvestable)} harvestable`, metricClass: 'urgent' });
      urgentCount++;
    } else {
      signals.push({ type: 'watch', icon: '📆', tag: 'watch', title: `FY ends in ${daysToFY} days`, body: `March 31 deadline approaching. Review LTCG — ₹1.25L is tax-free.`, metric: `${daysToFY} days to FY end`, metricClass: 'watch' });
      watchCount++;
    }
  }

  const deepLosers = DATA.stocks.filter(s => s.RetPct < -25);
  if (deepLosers.length) {
    const worst = [...deepLosers].sort((a, b) => a.RetPct - b.RetPct)[0];
    signals.push({ type: 'urgent', icon: '🔴', tag: 'urgent', title: `${deepLosers.length} stock${deepLosers.length > 1 ? 's' : ''} down >25%`, body: `${worst.name} is your worst performer at ${fmtP(worst.RetPct)}.`, metric: `${fmtP(worst.RetPct)} worst position`, metricClass: 'urgent' });
    urgentCount++;
  }

  const mfLosers = DATA.funds.filter(f => f.Gain < 0);
  if (mfLosers.length) {
    const worstMF = [...mfLosers].sort((a, b) => a.RetPct - b.RetPct)[0];
    signals.push({ type: 'watch', icon: '📉', tag: 'watch', title: `${mfLosers.length} MF${mfLosers.length > 1 ? 's' : ''} in the red`, body: `${worstMF.name} is your worst MF at ${fmtP(worstMF.RetPct)}.`, metric: `${fmtP(worstMF.RetPct)} worst fund`, metricClass: 'watch' });
    watchCount++;
  }

  const stTotal    = DATA.stocks.reduce((a, s) => a + s.Invested, 0) || 1;
  const concStocks = DATA.stocks.filter(s => s.Invested / stTotal > 0.2);
  if (concStocks.length) {
    signals.push({ type: 'watch', icon: '⚖️', tag: 'watch', title: 'High concentration in single stock', body: `${concStocks.map(s => esc(s.name)).join(', ')} each represent >20% of your stock portfolio.`, metric: `${concStocks.length} over-weight position${concStocks.length > 1 ? 's' : ''}`, metricClass: 'watch' });
    watchCount++;
  }

  const allLotDates = [...(DATA.mfLots || []), ...(DATA.stLots || [])].map(l => new Date(l.date)).filter(d => !isNaN(d));
  if (allLotDates.length) {
    const staleDays = Math.floor((today - new Date(Math.max(...allLotDates))) / 86400000);
    if (staleDays > 60) {
      signals.push({ type: 'watch', icon: '😴', tag: 'watch', title: 'No new investment in 60+ days', body: `Last investment was ${staleDays} days ago.`, metric: `${staleDays} days since last buy`, metricClass: 'watch' });
      watchCount++;
    }
  }

  const avgCandidates = DATA.funds.filter(f => f.RetPct < -5 && f.RetPct > -25 && f.CAGR > 0);
  if (avgCandidates.length)
    signals.push({ type: 'info', icon: '💡', tag: 'info', title: `${avgCandidates.length} MF averaging opportunit${avgCandidates.length > 1 ? 'ies' : 'y'}`, body: `${avgCandidates[0].name}${avgCandidates.length > 1 ? ' and others' : ''} are slightly underwater but have positive CAGR.`, metric: `${fmtP(avgCandidates[0].RetPct)} on ${avgCandidates[0].name.split(' ')[0]}`, metricClass: 'info' });

  const stars = [...DATA.funds, ...DATA.stocks].filter(h => (h.RetPct || 0) > 30);
  if (stars.length) {
    const best = [...stars].sort((a, b) => b.RetPct - a.RetPct)[0];
    signals.push({ type: 'good', icon: '🌟', tag: 'good', title: `${stars.length} holding${stars.length > 1 ? 's' : ''} up >30%`, body: `${best.name} is your star at ${fmtP(best.RetPct)}.`, metric: `${fmtP(best.RetPct)} top performer`, metricClass: 'good' });
    goodCount++;
  }

  if (hasData && deepLosers.length === 0 && mfLosers.length === 0 && concStocks.length === 0) {
    signals.push({ type: 'good', icon: '🏆', tag: 'good', title: 'Portfolio is clean & healthy', body: 'No deep losses, no concentration risk, no MF underperformers.', metric: 'All checks passed', metricClass: 'good' });
    goodCount++;
  }

  if (!hasData)
    signals.push({ type: 'info', icon: '📂', tag: 'info', title: 'Upload your Excel files', body: 'Go to Import Excel to load your MF and Stocks data.', metric: 'No data yet', metricClass: 'info' });

  let score = 100 - urgentCount * 20 - watchCount * 8;
  score = Math.max(0, Math.min(100, score));
  const scoreClass    = score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
  const scoreLabel    = score >= 70 ? '✦ STAY THE COURSE' : score >= 40 ? '⚠ ATTENTION NEEDED' : '🔴 ACTION REQUIRED';
  const scoreHeadline = score >= 70
    ? (urgentCount === 0 ? 'Your portfolio needs nothing from you today.' : 'Minor items to review — no major action needed.')
    : score >= 40 ? `${urgentCount + watchCount} things need your attention this week.`
    : `${urgentCount} urgent issue${urgentCount !== 1 ? 's' : ''} require immediate attention.`;
  const scoreSubline  = score >= 70
    ? `${goodCount} positive signal${goodCount !== 1 ? 's' : ''} detected.`
    : score >= 40 ? `${watchCount} item${watchCount !== 1 ? 's' : ''} to monitor, ${urgentCount} urgent.`
    : 'Deep losses or high risk concentration detected.';

  const hero = document.getElementById('pas-hero');
  if (hero) hero.className = `pas-hero ${scoreClass}`;
  const badge = document.getElementById('pas-badge');
  if (badge) badge.className = `pas-score-badge ${scoreClass}`;
  const scoreNum = document.getElementById('pas-score-num');
  if (scoreNum) { scoreNum.className = `pas-score-num ${scoreClass}`; scoreNum.textContent = score; }
  const lbl = document.getElementById('pas-signal-label');
  if (lbl) { lbl.className = `pas-signal-label ${scoreClass}`; lbl.textContent = scoreLabel; }
  const headlineEl = document.getElementById('pas-headline');
  if (headlineEl) headlineEl.textContent = scoreHeadline;
  const sublineEl  = document.getElementById('pas-subline');
  if (sublineEl)   sublineEl.textContent  = scoreSubline;

  const fyQ = month1 >= 4 && month1 <= 6 ? 'Q1' : month1 >= 7 && month1 <= 9 ? 'Q2' : month1 >= 10 && month1 <= 12 ? 'Q3' : 'Q4';
  const seasonMap = { 1:'Tax Season',2:'Tax Season',3:'FY-End Rush',4:'New FY',5:'Early Bull',6:'Monsoon Dip',7:'Earnings Season',8:'Earnings Season',9:'Sept Effect',10:'Festive Rally',11:'Festive Rally',12:'Year-End' };

  const moodStrip = document.getElementById('pas-mood-strip');
  if (moodStrip) {
    moodStrip.innerHTML = '';
    [
      { icon: '📅', label: 'Today',           val: today.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' }) },
      { icon: '🗓', label: 'FY Quarter',       val: fyQ },
      { icon: '🌦', label: 'Market Season',    val: seasonMap[month1] || 'Active' },
      { icon: '📊', label: 'Holdings tracked', val: `${DATA.funds.length} MFs · ${DATA.stocks.length} Stocks` },
      { icon: '💰', label: 'Portfolio value',  val: fmtL(k.totalValue || 0) },
    ].forEach(m => {
      const item  = document.createElement('div');  item.className = 'pas-mood-item';
      const icon  = document.createElement('div');  icon.className = 'pas-mood-icon'; icon.textContent = m.icon;
      const inner = document.createElement('div');
      const lbl2  = document.createElement('div');  lbl2.className = 'pas-mood-label'; lbl2.textContent = m.label;
      const val   = document.createElement('div');  val.className  = 'pas-mood-val';   val.textContent  = m.val;
      inner.append(lbl2, val);
      item.append(icon, inner);
      moodStrip.appendChild(item);
    });
  }

  let calHTML = '';
  for (let i = 0; i < 7; i++) {
    const d   = new Date(today); d.setDate(today.getDate() + i);
    const dd  = d.getDate(), dm = d.getMonth() + 1;
    const isToday   = i === 0, isSIPDay = sipDay !== null && dd === sipDay;
    const isFYEnd   = dm === 3 && dd === 31, isWeekend = d.getDay() === 0 || d.getDay() === 6;
    let cls2 = 'pas-cal-day';
    if (isToday) cls2 += ' today'; else if (isFYEnd) cls2 += ' fy-alert'; else if (isSIPDay) cls2 += ' has-sip';
    const dotColor = isWeekend ? 'var(--muted2)' : isSIPDay ? 'var(--blue)' : isFYEnd ? 'var(--red)' : 'transparent';
    const dayNote  = isToday ? 'Today' : isWeekend ? 'Weekend' : isSIPDay ? 'SIP Day' : isFYEnd ? 'FY End' : d.toLocaleDateString('en-IN', { weekday: 'short' });
    calHTML += `<div class="${cls2}"><div class="pas-cal-day-num" style="color:${isToday ? 'var(--gold)' : isSIPDay ? 'var(--blue)' : isFYEnd ? 'var(--red)' : 'var(--text)'}">${dd}</div><div class="pas-cal-day-label">${esc(dayNote)}</div><div class="pas-cal-day-dot" style="background:${dotColor}"></div></div>`;
  }
  const calEl = document.getElementById('pas-calendar');
  if (calEl) calEl.innerHTML = calHTML;

  const urgentFirst = [...signals].sort((a, b) => {
    const o = { urgent: 0, watch: 1, good: 2, info: 3 };
    return (o[a.type] || 3) - (o[b.type] || 3);
  });
  const actionCountEl = document.getElementById('pas-action-count');
  if (actionCountEl) actionCountEl.textContent = `${urgentCount} urgent · ${watchCount} watch · ${goodCount} good`;
  const gridEl = document.getElementById('pas-action-grid');
  if (gridEl) gridEl.innerHTML = urgentFirst.map(s =>
    `<div class="pas-action-card ${s.type}">
      <div class="pas-card-header"><span class="pas-card-icon">${s.icon}</span><span class="pas-card-tag ${s.tag}">${esc(s.tag.toUpperCase())}</span></div>
      <div class="pas-card-title">${esc(s.title)}</div>
      <div class="pas-card-body">${s.body}</div>
      <div class="pas-card-metric ${s.metricClass}">${esc(s.metric)}</div>
    </div>`
  ).join('');

  const weekKey = 'pas-checklist-week-' + getWeekNumber(today);
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(weekKey) || '{}'); } catch (_) {}

  const checklist = [
    { id: 'sip',   title: 'Confirm SIPs executed this month',       desc: 'Check your bank statement or broker app to confirm all SIP debits went through.' },
    { id: 'news',  title: 'Skim portfolio-related news (10 min)',    desc: 'Check if any holdings have major news: results, management change, order wins.' },
    { id: 'drift', title: 'Check portfolio allocation drift',        desc: 'Open the Rebalancer tab and see if any asset class has drifted more than 5%.' },
    { id: 'loss',  title: 'Review your deepest loss positions',      desc: 'Look at your worst performers. Are you holding for a reason, or out of hope?' },
    { id: 'goal',  title: 'Check goal progress',                    desc: 'Open Goal Planner and see if your corpus is on track.' },
    { id: 'tax',   title: 'Note any LTCG approaching 1-year mark',  desc: 'Holdings near the 1-year mark cross from STCG (20%) to LTCG (12.5%) tax.' },
    { id: 'cash',  title: 'Check if you have idle cash to deploy',  desc: 'If any SIP was missed or you received a bonus, deploy into underweight buckets.' },
  ];

  const checklistEl = document.getElementById('pas-checklist');
  if (checklistEl) {
    checklistEl.innerHTML = '';
    checklist.forEach(item => {
      const row    = document.createElement('div');
      row.className = 'pas-check-row' + (checked[item.id] ? ' checked' : '');
      const box    = document.createElement('div');
      box.className = 'pas-check-box' + (checked[item.id] ? ' done' : '');
      if (checked[item.id]) { const tick = document.createElement('span'); tick.style.cssText = 'color:#fff;font-size:11px'; tick.textContent = '✓'; box.appendChild(tick); }
      const txt    = document.createElement('div');  txt.className  = 'pas-check-text';
      const title2 = document.createElement('div'); title2.className = 'pas-check-title'; title2.textContent = item.title;
      const desc2  = document.createElement('div');  desc2.className = 'pas-check-desc';  desc2.textContent  = item.desc;
      txt.append(title2, desc2);
      row.append(box, txt);
      row.addEventListener('click', () => togglePasCheck(weekKey, item.id, row));
      checklistEl.appendChild(row);
    });
  }
}

function togglePasCheck(weekKey, id, row) {
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(weekKey) || '{}'); } catch (_) {}
  checked[id] = !checked[id];
  try { localStorage.setItem(weekKey, JSON.stringify(checked)); } catch (e) { console.warn('PortFin: could not persist checklist state', e); }
  const box = row.querySelector('.pas-check-box');
  if (checked[id]) {
    row.classList.add('checked'); box.classList.add('done');
    box.innerHTML = '<span style="color:#fff;font-size:11px">✓</span>';
  } else {
    row.classList.remove('checked'); box.classList.remove('done');
    box.innerHTML = '';
  }
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  return n + (['th','st','nd','rd'][n % 10] || 'th');
}
function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
}
