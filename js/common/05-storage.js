// ── common/05-storage.js ─────────────────────────────────────────────────────
// All persistence: IndexedDB read/write via PortFinDB (js/db.js),
// weekly snapshot management, persist banner, and combined monthly roll-up cache.
//
// Every function that touches storage is async.
// Depends on: 01-data-store.js, 02-formatters.js, db.js (PortFinDB)

// ── Storage keys ──────────────────────────────────────────────
const LS_KEY           = 'portfin-data-v1';
const LS_SNAPSHOTS_KEY = 'portfin-snapshots-v1';
const MAX_SNAPSHOTS    = 104;   // 2 years of weekly snapshots

// ── ISO-safe date serialiser ──────────────────────────────────
function _safeISO(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ══════════════════════════════════════════════════════════════
// SAVE / LOAD PORTFOLIO DATA
// ══════════════════════════════════════════════════════════════

async function saveDataToStorage() {
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
        dates:   (f.dates   || []).map(d => _safeISO(d)).filter(Boolean),
        rawLots: (f.rawLots || [])
          .filter(l => l.date && !isNaN(new Date(l.date)))
          .map(l => ({ ...l, date: _safeISO(l.date) })),
      })),
      mfCategories: DATA.mfCategories,
      stocks: DATA.stocks.map(s => ({
        ...s,
        dates:   (s.dates   || []).map(d => _safeISO(d)).filter(Boolean),
        rawLots: (s.rawLots || [])
          .filter(l => l.date && !isNaN(new Date(l.date)))
          .map(l => ({ ...l, date: _safeISO(l.date) })),
      })),
      sectors:   DATA.sectors,
      monthlyMF: DATA.monthlyMF,
      mfLots: DATA.mfLots.map(l => ({ ...l, date: _safeISO(l.date) })),
      stLots: DATA.stLots.map(l => ({ ...l, date: _safeISO(l.date) })),
      savedAt: new Date().toISOString(),
    };

    const ok = await PortFinDB.set(LS_KEY, JSON.stringify(payload));
    if (!ok) throw new Error('PortFinDB.set returned false');
    return true;
  } catch (e) {
    console.warn('PortFin: Could not save to storage', e);
    if (
      e &&
      (e.name === 'QuotaExceededError' ||
       e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
       String(e).includes('quota'))
    ) {
      const msgEl = document.getElementById('apply-msg');
      if (msgEl) {
        msgEl.style.cssText =
          'background:var(--red-bg);border:1px solid var(--red-dim);color:var(--red);display:block';
        msgEl.textContent =
          '⚠ Dashboard loaded but could not be saved — storage quota exceeded.';
      }
    }
    return false;
  }
}

async function loadDataFromStorage() {
  try {
    const raw = await PortFinDB.get(LS_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || !payload.funds) return false;

    const reDate = v => (v ? new Date(v) : null);

    DATA.kpis = {
      ...payload.kpis,
      earliestMF: reDate(payload.kpis.earliestMF),
      earliestST: reDate(payload.kpis.earliestST),
      latestDate: reDate(payload.kpis.latestDate),
    };
    DATA.funds = payload.funds.map(f => ({
      ...f,
      dates:   (f.dates   || []).map(d => new Date(d)),
      rawLots: (f.rawLots || []).map(l => ({ ...l, date: new Date(l.date) })),
    }));
    DATA.mfCategories  = payload.mfCategories || [];
    DATA.stocks        = payload.stocks.map(s => ({
      ...s,
      dates:   (s.dates   || []).map(d => new Date(d)),
      rawLots: (s.rawLots || []).map(l => ({ ...l, date: new Date(l.date) })),
    }));
    DATA.sectors       = payload.sectors   || [];
    DATA.monthlyMF     = payload.monthlyMF || [];
    DATA.mfLots        = (payload.mfLots || []).map(l => ({ ...l, date: new Date(l.date) }));
    DATA.stLots        = (payload.stLots || []).map(l => ({ ...l, date: new Date(l.date) }));

    // Invalidate derived caches
    DATA._cachedMonthly        = null;
    DATA._cachedDrawdownSeries = null;
    _fundAnalysisCache         = null;

    return payload.savedAt || true;
  } catch (e) {
    console.warn('PortFin: Could not load from storage', e);
    return false;
  }
}

async function clearStoredData() {
  await PortFinDB.remove(LS_KEY);
}

// ══════════════════════════════════════════════════════════════
// WEEKLY SNAPSHOTS
// ══════════════════════════════════════════════════════════════

function getISOWeekNumber(d) {
  const date   = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function getWeekStart(d) {
  const date = new Date(d);
  const day  = date.getDay() || 7;
  date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtWeekRange(weekStart) {
  const end  = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts = { day: '2-digit', month: 'short' };
  return (
    weekStart.toLocaleDateString('en-IN', opts) + ' – ' +
    end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  );
}

async function saveSnapshot() {
  try {
    const k = DATA.kpis;
    if (!k.totalInvested) return;

    const snapshots  = await getSnapshots();
    const now        = new Date();
    const weekNum    = getISOWeekNumber(now);
    const weekStart  = getWeekStart(now);
    const thu        = new Date(weekStart);
    thu.setDate(thu.getDate() + 3);
    const isoYear = thu.getFullYear();
    const weekKey = isoYear + '-W' + String(weekNum).padStart(2, '0');

    const snap = {
      weekKey,
      savedAt:    now.toISOString(),
      label:      fmtWeekRange(weekStart),
      shortLabel: 'W' + String(weekNum).padStart(2, '0') + " '" + String(isoYear).slice(-2),
      totalInvested: k.totalInvested,
      totalValue:    k.totalValue,
      totalGain:     k.totalGain,
      totalReturn:   k.totalReturn,
      mfInvested:    k.mfInvested,
      mfValue:       k.mfValue,
      mfCAGR:        k.mfCAGR,
      stInvested:    k.stInvested,
      stValue:       k.stValue,
      fundCount:     DATA.funds.length,
      stockCount:    DATA.stocks.length,
    };

    const idx = snapshots.findIndex(s => s.weekKey === weekKey);
    if (idx >= 0) snapshots[idx] = snap;
    else snapshots.push(snap);

    snapshots.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
    while (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();

    await PortFinDB.set(LS_SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('PortFin: Could not save snapshot', e);
  }
}

async function getSnapshots() {
  try {
    const raw  = await PortFinDB.get(LS_SNAPSHOTS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    const cleaned = data.filter(s => typeof s?.weekKey === 'string');
    if (cleaned.length !== data.length)
      await PortFinDB.set(LS_SNAPSHOTS_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return [];
  }
}

async function clearSnapshots() {
  await PortFinDB.remove(LS_SNAPSHOTS_KEY);
}

// ══════════════════════════════════════════════════════════════
// PERSIST BANNER
// ══════════════════════════════════════════════════════════════

function showPersistBanner(savedAt) {
  const existing = document.getElementById('persist-banner');
  if (existing) existing.remove();

  const bar     = document.createElement('div');
  bar.id        = 'persist-banner';
  bar.style.cssText =
    'display:flex;align-items:center;gap:10px;background:var(--amber-bg);' +
    'border-bottom:1px solid #4a3500;color:var(--amber);font-size:11px;' +
    'padding:7px 20px;font-family:var(--mono)';

  const dateStr = savedAt && savedAt !== true
    ? new Date(savedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'previous session';

  const msg       = document.createElement('span');
  msg.style.flex  = '1';
  msg.textContent = `📂 Showing portfolio saved on ${dateStr}. Upload new files to refresh.`;

  const btn = document.createElement('button');
  btn.textContent = 'Clear data';
  btn.style.cssText =
    'background:transparent;border:1px solid var(--border2);border-radius:4px;' +
    'color:var(--muted);padding:3px 10px;font-size:10px;cursor:pointer;flex-shrink:0';
  btn.addEventListener('click', clearAndReset);

  bar.append(msg, btn);
  const ticker = document.querySelector('.ticker');
  if (ticker) ticker.after(bar);
}

async function clearAndReset() {
  if (!confirm('Clear all saved portfolio data and snapshots? This cannot be undone.')) return;
  await clearStoredData();
  await clearSnapshots();
  location.reload();
}

// ══════════════════════════════════════════════════════════════
// COMBINED MONTHLY ROLL-UP (cached)
// ══════════════════════════════════════════════════════════════

/**
 * Merge DATA.monthlyMF + DATA.stLots into a sorted array of { m, v }.
 * Result is cached in DATA._cachedMonthly; cleared on every upload.
 */
function buildCombinedMonthly() {
  if (DATA._cachedMonthly) return DATA._cachedMonthly;

  const map = {};

  DATA.monthlyMF.forEach(({ m, v }) => {
    map[m] = (map[m] || 0) + v;
  });

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
