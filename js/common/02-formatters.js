// ── common/02-formatters.js ──────────────────────────────────────────────────
// Pure formatting helpers and utility functions.
// No DOM access, no DATA reads — safe to call from anywhere.

// ══════════════════════════════════════════════════════════════
// NUMBER / CURRENCY FORMATTERS
// ══════════════════════════════════════════════════════════════

/** Format as Indian ₹ with Lakh / Crore shorthand */
const fmtL = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2) + ' L';
  return s + '₹' + a.toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
};

/** Format as percentage with sign (+12.34%) */
const fmtP = (n) =>
  n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

/** Format integer with Indian locale commas */
const fmtN = (n) => Math.round(n).toLocaleString('en-IN');

/** Format ₹ price to 2 decimal places */
const fmtPrice = (n) =>
  n == null || isNaN(n) || n <= 0 ? '—' : '₹' + Number(n).toFixed(2);

/** CSS class for gain (td-up) vs loss (td-dn) */
const cls = (n) => n >= 0 ? 'td-up' : 'td-dn';

/** Return '+' for non-negative numbers */
const pSign = (n) => n >= 0 ? '+' : '';

// ══════════════════════════════════════════════════════════════
// STRING HELPERS
// ══════════════════════════════════════════════════════════════

/** HTML-escape a value to prevent XSS in innerHTML */
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/`/g,  '&#96;');

/** Parse a potentially messy numeric string / cell value */
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
// DATE FORMATTERS
// ══════════════════════════════════════════════════════════════

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';
}

function fmtMonthYear(d) {
  return d
    ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';
}

function fmtMonthLabel(mk) {
  const [y, m] = mk.split('-');
  return MONTH_NAMES[parseInt(m) - 1] + ' ' + y;
}

/** Human-readable holding period: "2y 3m", "5m", "14d" */
function fmtHoldPeriod(days) {
  if (!days || days <= 0) return '—';
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  if (y > 0 && m > 0) return `${y}y ${m}m`;
  if (y > 0) return `${y}y`;
  if (m > 0) return `${m}m`;
  return `${days}d`;
}

// ══════════════════════════════════════════════════════════════
// XIRR — money-weighted return via Newton-Raphson
// ══════════════════════════════════════════════════════════════

/**
 * Calculate XIRR given parallel arrays of cash flows and dates.
 * Negative values = outflows (investments), positive = inflows (current value).
 * Returns annualised % or null on failure.
 */
function calcXIRR(cashflows, dates) {
  if (!cashflows.length) return null;
  const netFlow = cashflows.reduce((a, v) => a + v, 0);
  if (Math.abs(netFlow) < 1) return 0;

  const base = dates[0];
  const t    = dates.map(d => (d - base) / (365.25 * 24 * 3600 * 1000));

  let r = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let f = 0, df = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const v = cashflows[i] * Math.pow(1 + r, -t[i]);
      f  += v;
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
