// ── common/01-data-store.js ──────────────────────────────────────────────────
// Central DATA store, shared constants, colour maps, and module-level state.
// Must load before all other common/* modules.

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
  _cachedDrawdownSeries: null,
};

// ══════════════════════════════════════════════════════════════
// SHARED CONSTANTS
// ══════════════════════════════════════════════════════════════
const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// ══════════════════════════════════════════════════════════════
// COLOUR MAPS
// ══════════════════════════════════════════════════════════════
const CAT_CLR = {
  Value:       '#d4a843',
  'Large Cap': '#58a6ff',
  'Mid Cap':   '#3fb950',
  'Small Cap': '#f0883e',
  'Flexi Cap': '#a371f7',
  ELSS:        '#e3b341',
  Index:       '#79c0ff',
  Other:       '#7d8590',
};

const SEC_CLR = {
  Defence:           '#58a6ff',
  'Energy/PSU':      '#3fb950',
  Speculative:       '#f85149',
  Renewables:        '#56d364',
  'Finance/PSU':     '#a371f7',
  FMCG:              '#e3b341',
  'Metals/Mining':   '#d4a843',
  Banking:           '#f0883e',
  'Infra/PSU':       '#79c0ff',
  'Commodities ETF': '#7d8590',
  'Index ETF':       '#484f58',
  Other:             '#7d8590',
};

// Generic colour getter with fallback
const gc = (k, m) => m[k] || '#7d8590';

// ══════════════════════════════════════════════════════════════
// MODULE-LEVEL STATE (filter / sort / misc)
// ══════════════════════════════════════════════════════════════
let mfSort = 'RetPct', mfAsc = false, mfFil = 'All';
let stSort = 'RetPct', stAsc = false, stFil = 'All';

// Wealth waterfall — shared between renderWaterfall() and wfShowTip()
let _wfSegments = null;
let _wfTotal    = 0;

// Fund analysis cache — cleared on upload and on period chip change
let _fundAnalysisCache = null;
