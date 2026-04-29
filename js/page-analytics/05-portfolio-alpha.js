// ── page-analytics/05-portfolio-alpha.js ────────────────────────────────────
// Portfolio Estimated Alpha Engine
//
// HONESTY NOTICE (shown in UI too):
//   This is NOT true Jensen's Alpha.
//   True Jensen's Alpha requires time-series monthly returns + regression-based beta.
//   This tool has only CAGR snapshots and lot dates — no price series.
//
//   What this engine ACTUALLY computes:
//   "Given a proxy beta derived from category/sector empirical averages,
//    does my annualised CAGR beat what CAPM would roughly predict?"
//
//   That is a useful heuristic — but it must be labelled as such.
//
// What is CORRECT here:
//   ✔ CAPM formula structure: α = Rp − [Rf + β(Rm − Rf)]
//   ✔ Portfolio-level weighted beta (proxy)
//   ✔ Time-horizon matched benchmark CAGR (3y / 5y / 10y)
//   ✔ Annualised Rp via proper CAGR formula (not simple return)
//   ✔ Per-category and per-sector alpha vs realistic Indian benchmarks
//   ✔ Sharpe Ratio (uses estimated annualised volatility, not regression)
//
// What is APPROXIMATE here (labelled in UI):
//   ~ Beta = category/sector historical averages, NOT regression-computed
//   ~ Benchmark CAGRs = fixed multi-year averages, NOT time-aligned series
//   ~ Volatility = estimated from category/sector, NOT actual price history
//
// What was REMOVED from a prior version for misleading users:
//   ✗ "Alpha trend chart" built by scaling mfCAGR × factor — fabricated data
//   ✗ Alpha grade A/B/C based on approximate Jensen's alpha — false precision
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────
// Beta estimates: empirical category/sector averages from Indian equity research.
// Source: SEBI MF categorisation rolling beta studies (2019-2024 avg).
// These are APPROXIMATIONS — actual beta varies year to year.
const _ALPHA_CFG = {
  RISK_FREE_RATE: 7.0,   // 10-yr G-Sec yield approx (FY 2024-25)

  // Nifty 50 CAGR by horizon — used to time-match benchmark
  // Source: NSE index historical data up to Dec 2024
  NIFTY_BY_HORIZON: {
    3: 12.8,
    5: 15.2,
    7: 13.8,
    10: 13.5,
  },

  // Proxy beta: category historical rolling beta vs Nifty 50
  // APPROXIMATION — not regression-computed from your portfolio
  CATEGORY_BETA: {
    'Large Cap': 0.92,
    'Index': 1.00,
    'Flexi Cap': 0.95,
    'Mid Cap': 1.15,
    'Small Cap': 1.35,
    'Value': 0.88,
    'ELSS': 1.05,
    'Other': 1.00,
  },

  // Proxy beta: sector historical rolling beta vs Nifty 50
  SECTOR_BETA: {
    'Banking': 1.10,
    'IT': 0.95,
    'Energy/PSU': 0.85,
    'Infra/PSU': 0.90,
    'Finance/PSU': 1.05,
    'Metals/Mining': 1.20,
    'Renewables': 1.25,
    'Defence': 1.10,
    'FMCG': 0.75,
    'Speculative': 1.50,
    'Index ETF': 1.00,
    'Consumer Tech': 1.30,
    'Commodities ETF': 0.70,
    'Other': 1.00,
  },

  // Category benchmark CAGR (5Y rolling avg of Nifty sub-indices, as of FY24-25)
  // APPROXIMATION — these shift year to year
  CATEGORY_BENCHMARK_CAGR: {
    'Large Cap': 12.5,
    'Index': 13.5,
    'Flexi Cap': 13.0,
    'Mid Cap': 16.0,
    'Small Cap': 18.0,
    'Value': 12.0,
    'ELSS': 13.0,
    'Other': 12.5,
  },

  // Sector benchmark CAGR (Nifty sectoral 5Y avg, as of FY24-25)
  // APPROXIMATION — these shift dramatically year to year
  SECTOR_BENCHMARK_CAGR: {
    'Banking': 12.0,
    'IT': 15.0,
    'Energy/PSU': 14.0,
    'Infra/PSU': 13.0,
    'Finance/PSU': 13.5,
    'Metals/Mining': 17.0,
    'Renewables': 20.0,
    'Defence': 22.0,
    'FMCG': 10.0,
    'Speculative': 12.0,
    'Index ETF': 13.5,
    'Consumer Tech': 18.0,
    'Commodities ETF': 8.0,
    'Other': 12.0,
  },

  // Annualised volatility proxy by category (Indian equity, 5Y avg std dev)
  // Used for Sharpe Ratio estimation — APPROXIMATION
  CATEGORY_VOLATILITY: {
    'Large Cap': 14.0,
    'Index': 14.5,
    'Flexi Cap': 15.0,
    'Mid Cap': 18.0,
    'Small Cap': 22.0,
    'Value': 13.5,
    'ELSS': 15.0,
    'Other': 16.0,
  },
  SECTOR_VOLATILITY: {
    'Banking': 18.0,
    'IT': 20.0,
    'Energy/PSU': 16.0,
    'Infra/PSU': 17.0,
    'Finance/PSU': 17.0,
    'Metals/Mining': 25.0,
    'Renewables': 28.0,
    'Defence': 22.0,
    'FMCG': 12.0,
    'Speculative': 40.0,
    'Index ETF': 14.5,
    'Consumer Tech': 30.0,
    'Other': 20.0,
  },
  DEFAULT_VOLATILITY: 16.0,
};

// ── Main render entry point ───────────────────────────────────────────────────
function renderPortfolioAlpha() {
  const el = document.getElementById('portfolio-alpha-wrap');
  if (!el) return;

  const k = DATA.kpis;
  if (!k || !k.totalInvested) {
    el.innerHTML = `
      <div style="color:var(--muted);font-size:11px;padding:24px;text-align:center">
        📂 Upload your Excel files to see estimated alpha analysis.
      </div>`;
    return;
  }

  const result = _computeAlpha();
  el.innerHTML = _buildHTML(result);
}

// ── Core computation ──────────────────────────────────────────────────────────
function _computeAlpha() {
  const k = DATA.kpis;
  const cfg = _ALPHA_CFG;
  const Rf = cfg.RISK_FREE_RATE;

  // ── 1. Annualised portfolio return (CAGR formula, not simple return) ─────
  // holdYears derived from actual earliest lot date → today
  const allMonths = buildCombinedMonthly();
  const holdYears = Math.max(0.5, allMonths.length / 12);

  // Annualised total return: (Current / Invested)^(1/years) − 1
  const Rp_annual = k.totalInvested > 0 && k.totalValue > 0
    ? (Math.pow(k.totalValue / k.totalInvested, 1 / holdYears) - 1) * 100
    : 0;

  // MF annualised return
  const Rp_mf = k.mfInvested > 0 && k.mfValue > 0
    ? (Math.pow(k.mfValue / k.mfInvested, 1 / holdYears) - 1) * 100
    : 0;

  // ── 2. Time-horizon matched benchmark Nifty CAGR ─────────────────────────
  const nearestHorizon = holdYears >= 8.5 ? 10
    : holdYears >= 6 ? 7
      : holdYears >= 4 ? 5
        : 3;
  const Rm = cfg.NIFTY_BY_HORIZON[nearestHorizon];

  // ── 3. Portfolio weighted beta (proxy) ───────────────────────────────────
  // NOTE: this is an approximation — not regression-computed
  const totalVal = k.totalValue || 1;
  let weightedBeta = 0;
  let weightedVolatility = 0;

  DATA.funds.forEach(f => {
    const w = f.Current / totalVal;
    const beta = cfg.CATEGORY_BETA[f.Category] || 1.0;
    const vol = cfg.CATEGORY_VOLATILITY[f.Category] || cfg.DEFAULT_VOLATILITY;
    weightedBeta += beta * w;
    weightedVolatility += vol * w;
  });
  DATA.stocks.forEach(s => {
    const w = s.Current / totalVal;
    const beta = cfg.SECTOR_BETA[s.Sector] || 1.0;
    const vol = cfg.SECTOR_VOLATILITY[s.Sector] || cfg.DEFAULT_VOLATILITY;
    weightedBeta += beta * w;
    weightedVolatility += vol * w;
  });
  if (!weightedBeta) weightedBeta = 1.0;
  if (!weightedVolatility) weightedVolatility = cfg.DEFAULT_VOLATILITY;

  // ── 4. CAPM expected return ───────────────────────────────────────────────
  const expectedReturn = Rf + weightedBeta * (Rm - Rf);

  // ── 5. Estimated alpha (α = Rp − expected) ───────────────────────────────
  // LABELLED as "Estimated Alpha" — not true Jensen's Alpha
  const estimatedAlpha = Rp_annual - expectedReturn;
  const simpleAlpha = Rp_annual - Rm;   // no beta adjustment — just vs index

  // ── 6. Estimated Sharpe Ratio ─────────────────────────────────────────────
  // Sharpe = (Rp − Rf) / σp
  // σp here is a PROXY volatility from category/sector weights — not from returns
  const sharpe = weightedVolatility > 0
    ? (Rp_annual - Rf) / weightedVolatility
    : null;

  // Nifty Sharpe for comparison (using Nifty 5Y return and ~14.5% vol)
  const niftySharpe = (Rm - Rf) / 14.5;

  // ── 7. Information Ratio (simple estimate) ───────────────────────────────
  // IR = alpha / tracking error (approximated from volatility spread)
  const trackingErrorProxy = Math.abs(weightedVolatility - 14.5) + 4.0; // rough TE
  const informationRatio = trackingErrorProxy > 0
    ? simpleAlpha / trackingErrorProxy
    : null;

  // ── 8. Per-category alpha ─────────────────────────────────────────────────
  const categoryAlpha = DATA.mfCategories.map(cat => {
    const bmCAGR = cfg.CATEGORY_BENCHMARK_CAGR[cat.Category] || 12.5;
    const catHoldYears = holdYears; // same portfolio period
    // Annualise category return properly
    const catReturn = cat.Invested > 0 && cat.Current > 0
      ? (Math.pow(cat.Current / cat.Invested, 1 / catHoldYears) - 1) * 100
      : cat.RetPct; // fallback to simple return if can't compute CAGR
    return {
      category: cat.Category,
      portfolioCAGR: parseFloat(catReturn.toFixed(1)),
      benchmarkCAGR: bmCAGR,
      alpha: parseFloat((catReturn - bmCAGR).toFixed(1)),
      invested: cat.Invested,
      current: cat.Current,
    };
  }).sort((a, b) => b.alpha - a.alpha);

  // ── 9. Per-sector stock alpha ─────────────────────────────────────────────
  const sectorAlpha = DATA.sectors.map(sec => {
    const bmCAGR = cfg.SECTOR_BENCHMARK_CAGR[sec.Sector] || 12.0;
    const secReturn = sec.Invested > 0 && sec.Current > 0
      ? (Math.pow(sec.Current / sec.Invested, 1 / holdYears) - 1) * 100
      : sec.RetPct;
    return {
      sector: sec.Sector,
      portfolioRet: parseFloat(secReturn.toFixed(1)),
      benchmarkCAGR: bmCAGR,
      alpha: parseFloat((secReturn - bmCAGR).toFixed(1)),
      invested: sec.Invested,
    };
  }).sort((a, b) => b.alpha - a.alpha);

  // ── 10. Consistency flags (what drives uncertainty in this model) ─────────
  const limitations = [];
  if (holdYears < 2)
    limitations.push('⚠ Hold period < 2 years — CAGR is unreliable at short horizons');
  if (weightedBeta > 1.3)
    limitations.push('⚠ High proxy beta (>' + weightedBeta.toFixed(2) + ') — speculative/small-cap heavy');
  if (DATA.stocks.filter(s => s.Sector === 'Speculative').length > 0)
    limitations.push('⚠ Speculative stocks distort beta estimate significantly');
  if (DATA.funds.filter(f => f.Category === 'Other').length > DATA.funds.length * 0.3)
    limitations.push('⚠ Many funds in "Other" category — beta proxy less accurate');

  return {
    holdYears, nearestHorizon,
    Rp: parseFloat(Rp_annual.toFixed(2)),
    Rp_mf: parseFloat(Rp_mf.toFixed(2)),
    Rm, Rf,
    weightedBeta: parseFloat(weightedBeta.toFixed(3)),
    weightedVol: parseFloat(weightedVolatility.toFixed(1)),
    expectedReturn: parseFloat(expectedReturn.toFixed(2)),
    estimatedAlpha: parseFloat(estimatedAlpha.toFixed(2)),
    simpleAlpha: parseFloat(simpleAlpha.toFixed(2)),
    sharpe: sharpe !== null ? parseFloat(sharpe.toFixed(2)) : null,
    niftySharpe: parseFloat(niftySharpe.toFixed(2)),
    informationRatio: informationRatio !== null ? parseFloat(informationRatio.toFixed(2)) : null,
    categoryAlpha,
    sectorAlpha,
    limitations,
  };
}

// ── HTML builder ──────────────────────────────────────────────────────────────
function _buildHTML(d) {

  // ── Honesty banner ───────────────────────────────────────────
  const disclaimerHTML = `
    <div style="
      background:var(--amber-bg);border:1px solid #4a3500;
      border-radius:8px;padding:12px 16px;margin-bottom:20px;
      display:flex;gap:12px;align-items:flex-start
    ">
      <span style="font-size:18px;flex-shrink:0">🔬</span>
      <div style="font-size:11px;color:var(--amber);line-height:1.7">
        <strong>Estimation notice:</strong>
        This is <em>not</em> true Jensen's Alpha — that requires monthly return time-series
        and regression-computed beta, which aren't available without a live market data feed.
        What you see is a <strong>CAPM heuristic</strong> using proxy betas
        (category/sector empirical averages) and annualised CAGR as return input.
        It answers: <em>"Given assumed risk, did my CAGR roughly beat what CAPM predicts?"</em>
        — useful for direction, not for precise financial reporting.
      </div>
    </div>`;

  // ── KPI strip ─────────────────────────────────────────────────
  const alphaColor = d.estimatedAlpha > 2 ? '#3fb950'
    : d.estimatedAlpha > 0 ? '#d4a843'
      : d.estimatedAlpha > -2 ? '#7d8590'
        : '#f85149';

  const kpiHTML = renderKpiCards([
    {
      l: 'Est. Alpha (CAPM)',
      v: (d.estimatedAlpha >= 0 ? '+' : '') + d.estimatedAlpha + '%',
      s: 'vs CAPM expected ' + d.expectedReturn + '%',
      sc: d.estimatedAlpha >= 0 ? 'up' : 'dn',
      a: alphaColor,
    },
    {
      l: 'Simple Alpha',
      v: (d.simpleAlpha >= 0 ? '+' : '') + d.simpleAlpha + '%',
      s: 'vs Nifty ' + d.nearestHorizon + 'Y: ' + d.Rm + '%',
      sc: d.simpleAlpha >= 0 ? 'up' : 'dn',
      a: d.simpleAlpha >= 0 ? '#3fb950' : '#f85149',
    },
    {
      l: 'Portfolio β (proxy)',
      v: d.weightedBeta + 'β',
      s: d.weightedBeta > 1.15 ? 'Aggressive vs market'
        : d.weightedBeta < 0.88 ? 'Defensive vs market'
          : 'Near-market risk',
      a: '#58a6ff',
    },
    {
      l: 'Est. Sharpe Ratio',
      v: d.sharpe !== null ? d.sharpe.toFixed(2) : '—',
      s: 'vs Nifty ~' + d.niftySharpe.toFixed(2),
      sc: d.sharpe !== null && d.sharpe > d.niftySharpe ? 'up' : 'dn',
      a: '#a371f7',
    },
    {
      l: 'Portfolio CAGR (ann.)',
      v: (d.Rp >= 0 ? '+' : '') + d.Rp + '%',
      s: 'Over ' + d.holdYears.toFixed(1) + ' yrs · annualised',
      a: '#d4a843',
    },
    {
      l: 'CAPM Expected',
      v: '+' + d.expectedReturn + '%',
      s: 'Rf ' + d.Rf + '% + β×(Rm−Rf)',
      a: '#7d8590',
    },
  ]);

  // ── CAPM equation card ────────────────────────────────────────
  const eqHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="sec-head">
        <div class="sec-title">CAPM Breakdown</div>
        <div style="font-size:10px;color:var(--muted)">
          α = Rp − [Rf + β(Rm − Rf)] · all values annualised
        </div>
      </div>
      <div style="
        display:flex;align-items:center;gap:6px;
        flex-wrap:wrap;font-size:12px;
        background:var(--bg3);border-radius:8px;padding:14px 16px;
        font-family:var(--mono)
      ">
        <span style="font-family:var(--sans);font-size:18px;font-weight:700;color:${alphaColor}">
          ${d.estimatedAlpha >= 0 ? '+' : ''}${d.estimatedAlpha}% α
        </span>
        <span style="color:var(--muted)">=</span>
        <span style="color:var(--text)">${d.Rp}% Rp</span>
        <span style="color:var(--muted)">−</span>
        <span style="color:var(--muted2)">
          [${d.Rf}% Rf &nbsp;+&nbsp; ${d.weightedBeta}β × (${d.Rm}% Rm − ${d.Rf}% Rf)]
        </span>
        <span style="color:var(--muted)">= </span>
        <span style="color:var(--muted2)">
          ${d.Rp}% − ${d.expectedReturn}%
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <div>
          ${_statRow('Rp — Portfolio CAGR (annualised)', d.Rp + '%', '#d4a843')}
          ${_statRow('Rf — Risk-free rate (10yr G-Sec)', d.Rf + '%', 'var(--muted)')}
          ${_statRow('Rm — Nifty ' + d.nearestHorizon + 'Y CAGR', d.Rm + '%', 'var(--muted)')}
        </div>
        <div>
          ${_statRow('β — Proxy weighted beta', d.weightedBeta + 'β', '#58a6ff', '⚠ Estimated')}
          ${_statRow('Expected return (CAPM)', d.expectedReturn + '%', 'var(--muted)')}
          ${d.sharpe !== null ? _statRow('Sharpe Ratio (estimated)', d.sharpe.toFixed(2), '#a371f7', 'Nifty ~' + d.niftySharpe.toFixed(2)) : ''}
          ${d.informationRatio !== null ? _statRow('Information Ratio (est.)', d.informationRatio.toFixed(2), 'var(--blue)', 'vs simple alpha') : ''}
        </div>
      </div>
    </div>`;

  // ── Category alpha table ──────────────────────────────────────
  const maxCatA = Math.max(...d.categoryAlpha.map(c => Math.abs(c.alpha)), 1);
  const catTableHTML = d.categoryAlpha.length
    ? d.categoryAlpha.map(c => _alphaRow(c.category, c.portfolioCAGR, c.benchmarkCAGR, c.alpha, maxCatA)).join('')
    : '<div style="color:var(--muted);font-size:11px;padding:10px">No MF data</div>';

  // ── Sector alpha table ────────────────────────────────────────
  const maxSecA = Math.max(...d.sectorAlpha.map(s => Math.abs(s.alpha)), 1);
  const secTableHTML = d.sectorAlpha.length
    ? d.sectorAlpha.map(s => _alphaRow(s.sector, s.portfolioRet, s.benchmarkCAGR, s.alpha, maxSecA)).join('')
    : '<div style="color:var(--muted);font-size:11px;padding:10px">No stock data</div>';

  const alphaTablesHTML = `
    <div class="grid2" style="margin-bottom:20px">
      <div class="card">
        <div class="sec-head">
          <div class="sec-title">MF category alpha</div>
          <div style="font-size:10px;color:var(--muted)">
            Your annualised return vs category benchmark CAGR · ~approx benchmarks
          </div>
        </div>
        <div class="alpha-box">${catTableHTML}</div>
      </div>
      <div class="card">
        <div class="sec-head">
          <div class="sec-title">Sector alpha (stocks)</div>
          <div style="font-size:10px;color:var(--muted)">
            Your annualised return vs Nifty sectoral CAGR · ~approx benchmarks
          </div>
        </div>
        <div class="alpha-box">${secTableHTML}</div>
      </div>
    </div>`;

  // ── Limitations card ──────────────────────────────────────────
  const limHTML = d.limitations.length ? `
    <div style="
      background:var(--bg3);border:1px solid var(--border);
      border-radius:8px;padding:12px 16px;margin-bottom:20px
    ">
      <div style="font-size:9px;color:var(--muted);text-transform:uppercase;
                  letter-spacing:.08em;margin-bottom:8px">
        Model accuracy flags for your portfolio
      </div>
      ${d.limitations.map(l => `
        <div style="font-size:11px;color:var(--amber);
                    padding:4px 0;border-bottom:1px solid var(--border);
                    line-height:1.5">${l}</div>
      `).join('')}
    </div>` : '';

  // ── Footer methodology note ───────────────────────────────────
  const footerHTML = `
    <div style="
      font-size:10px;color:var(--muted2);line-height:1.8;
      padding:12px 0;border-top:1px solid var(--border)
    ">
      <strong style="color:var(--muted)">Methodology:</strong>
      Annualised Rp = (Current/Invested)^(1/years)−1.
      β = weighted avg of category/sector proxy betas (empirical averages, not regression).
      Rm = Nifty 50 CAGR matched to your holding period (${d.nearestHorizon}Y = ${d.Rm}%).
      Rf = ${d.Rf}% (10-yr G-Sec).
      Sharpe = (Rp−Rf)/σ where σ is estimated from category volatility (not from return history).
      True Jensen's Alpha and regression beta require monthly return time-series —
      not available in a no-backend tool.
    </div>`;

  return disclaimerHTML + kpiHTML + eqHTML + alphaTablesHTML + limHTML + footerHTML;
}

// ── Shared row builders ───────────────────────────────────────────────────────
function _statRow(label, value, color, note) {
  return `
    <div class="stat-row">
      <div>
        <div class="stat-label">${esc(label)}</div>
        ${note ? `<div class="stat-note" style="color:var(--amber)">${esc(note)}</div>` : ''}
      </div>
      <div class="stat-val" style="color:${color}">${esc(value)}</div>
    </div>`;
}

function _alphaRow(name, portfolioRet, benchmarkCAGR, alpha, maxAlpha) {
  const aColor = alpha > 0 ? 'var(--green)' : alpha < 0 ? 'var(--red)' : 'var(--muted)';
  const barW = Math.round(Math.abs(alpha) / maxAlpha * 100);
  const sign = alpha >= 0 ? '+' : '';
  return `
    <div class="alpha-row">
      <span class="alpha-name">${esc(name)}</span>
      <span class="alpha-cagr">${portfolioRet >= 0 ? '+' : ''}${portfolioRet.toFixed(1)}%</span>
      <span class="alpha-bm">vs ${benchmarkCAGR}%</span>
      <span class="alpha-diff" style="color:${aColor}">${sign}${alpha.toFixed(1)}pp</span>
      <div class="alpha-bar-wrap">
        <div class="alpha-bar" style="width:${barW}%;background:${aColor}"></div>
      </div>
    </div>`;
}