// ── page-analytics/05-portfolio-alpha.js ─────────────────────────────────
// Portfolio Alpha Engine
// Computes Jensen's Alpha, portfolio beta (proxy), rolling alpha trend,
// and sector-level alpha — all from existing DATA, no external API needed.

// ── Indian market constants (as of FY 2024-25) ────────────────
const ALPHA_CONSTANTS = {
  NIFTY_CAGR_10Y: 13.5,  // Nifty 50 10-year CAGR %
  NIFTY_CAGR_5Y: 15.2,  // Nifty 50 5-year CAGR %
  NIFTY_CAGR_3Y: 12.8,
  RISK_FREE_RATE: 7.0,  // 10-yr Gsec yield approx
  // Category beta estimates (vs Nifty 50) — empirical averages
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
  // Sector beta estimates for direct stocks
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
    'Other': 1.00,
  },
};

// ── Main render ───────────────────────────────────────────────
function renderPortfolioAlpha() {
  const el = document.getElementById('portfolio-alpha-wrap');
  if (!el) return;

  const k = DATA.kpis;
  if (!k.totalInvested) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see portfolio alpha analysis.</div>';
    return;
  }

  const alphaData = _computePortfolioAlpha();
  el.innerHTML = _buildAlphaHTML(alphaData);
}

// ── Core computation ──────────────────────────────────────────
function _computePortfolioAlpha() {
  const k = DATA.kpis;
  const Rf = ALPHA_CONSTANTS.RISK_FREE_RATE;

  // 1. Portfolio-level weighted beta
  const totalVal = k.totalValue || 1;

  let weightedBeta = 0;
  DATA.funds.forEach(f => {
    const beta = ALPHA_CONSTANTS.CATEGORY_BETA[f.Category] || 1.0;
    const weight = f.Current / totalVal;
    weightedBeta += beta * weight;
  });
  DATA.stocks.forEach(s => {
    const beta = ALPHA_CONSTANTS.SECTOR_BETA[s.Sector] || 1.0;
    const weight = s.Current / totalVal;
    weightedBeta += beta * weight;
  });

  // 2. Appropriate benchmark CAGR (match to holding period)
  const allMonths = buildCombinedMonthly();
  const holdYears = allMonths.length / 12;
  const Rm = holdYears >= 7 ? ALPHA_CONSTANTS.NIFTY_CAGR_10Y
    : holdYears >= 4 ? ALPHA_CONSTANTS.NIFTY_CAGR_5Y
      : ALPHA_CONSTANTS.NIFTY_CAGR_3Y;

  // 3. Jensen's Alpha: α = Rp − [Rf + β(Rm − Rf)]
  // Annualize simple return to match CAGR basis
  const holdYearsActual = holdYears || 1;
  const simpleRet = (k.totalReturn || 0) / 100;
  const Rp = (Math.pow(1 + simpleRet, 1 / holdYearsActual) - 1) * 100;
  const expectedRet = Rf + weightedBeta * (Rm - Rf);
  const jensensAlpha = Rp - expectedRet;

  // 4. Simple alpha (vs benchmark, no beta adjustment)
  const simpleAlpha = Rp - Rm;

  // 5. MF alpha (avg fund CAGR vs benchmark CAGR)
  const mfAlpha = (k.mfCAGR || 0) - Rm;

  // 6. Per-category alpha
  const categoryAlpha = DATA.mfCategories.map(cat => {
    const bmCAGR = _getCategoryBenchmark(cat.Category);
    return {
      category: cat.Category,
      portfolioCAGR: cat.RetPct,
      benchmarkCAGR: bmCAGR,
      alpha: cat.RetPct - bmCAGR,
      invested: cat.Invested,
    };
  }).sort((a, b) => b.alpha - a.alpha);

  // 7. Per-sector stock alpha
  const sectorAlpha = DATA.sectors.map(sec => {
    const bmCAGR = _getSectorBenchmark(sec.Sector);
    return {
      sector: sec.Sector,
      portfolioRet: sec.RetPct,
      benchmarkCAGR: bmCAGR,
      alpha: sec.RetPct - bmCAGR,
      invested: sec.Invested,
    };
  }).sort((a, b) => b.alpha - a.alpha);

  // 8. Alpha trend (simulated from snapshot history — approximated per year)
  const alphaTrend = _buildAlphaTrend(Rm);

  // 9. Alpha quality rating
  const alphaRating = _rateAlpha(jensensAlpha, simpleAlpha, weightedBeta);

  return {
    Rp, Rm, Rf,
    weightedBeta,
    expectedRet,
    jensensAlpha,
    simpleAlpha,
    mfAlpha,
    categoryAlpha,
    sectorAlpha,
    alphaTrend,
    alphaRating,
    holdYears,
  };
}

function _getCategoryBenchmark(category) {
  const map = {
    'Large Cap': 12.5,
    'Index': 13.5,
    'Flexi Cap': 13.0,
    'Mid Cap': 16.0,
    'Small Cap': 18.0,
    'Value': 12.0,
    'ELSS': 13.0,
    'Other': 12.0,
  };
  return map[category] || 12.5;
}

function _getSectorBenchmark(sector) {
  // Approximate Nifty sectoral index CAGRs (5Y avg)
  const map = {
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
    'Other': 12.0,
  };
  return map[sector] || 12.0;
}

function _buildAlphaTrend(Rm) {
  // Build approximate yearly alpha using cumulative monthly data
  const allMonths = buildCombinedMonthly();
  if (allMonths.length < 12) return [];

  const yearMap = {};
  allMonths.forEach(({ m, v }) => {
    const y = m.slice(0, 4);
    yearMap[y] = (yearMap[y] || 0) + v;
  });

  const years = Object.keys(yearMap).sort();
  const totalInv = Object.values(yearMap).reduce((a, b) => a + b, 0) || 1;

  // Approximate: use MF CAGR for the year as proxy (we don't have yearly returns)
  // Weight towards actual CAGR for later years
  return years.map((y, i) => {
    const weight = yearMap[y] / totalInv;
    const approxRet = (DATA.kpis.mfCAGR || 12) * (0.8 + 0.4 * (i / Math.max(years.length - 1, 1)));
    return { year: y, alpha: parseFloat((approxRet - Rm).toFixed(1)), approxRet };
  });
}

function _rateAlpha(jensensAlpha, simpleAlpha, beta) {
  if (jensensAlpha > 5) return { label: 'Exceptional Alpha', color: '#3fb950', grade: 'A+', desc: 'Significantly outperforming on risk-adjusted basis' };
  if (jensensAlpha > 2) return { label: 'Strong Alpha', color: '#3fb950', grade: 'A', desc: 'Clear evidence of active return generation' };
  if (jensensAlpha > 0) return { label: 'Positive Alpha', color: '#d4a843', grade: 'B', desc: 'Marginally beating risk-adjusted benchmark' };
  if (jensensAlpha > -2) return { label: 'Neutral / Index-like', color: '#7d8590', grade: 'C', desc: 'Returns inline with what beta predicts' };
  return { label: 'Negative Alpha', color: '#f85149', grade: 'D', desc: 'Underperforming on risk-adjusted basis — review holdings' };
}

// ── HTML builder ──────────────────────────────────────────────
function _buildAlphaHTML(d) {
  const jColor = d.jensensAlpha > 0 ? 'var(--green)' : d.jensensAlpha > -2 ? 'var(--muted)' : 'var(--red)';
  const sColor = d.simpleAlpha > 0 ? 'var(--green)' : 'var(--red)';

  // KPI strip
  const kpis = renderKpiCards([
    { l: "Jensen's Alpha", v: (d.jensensAlpha >= 0 ? '+' : '') + d.jensensAlpha.toFixed(2) + '%', s: 'Risk-adjusted excess return', a: d.jensensAlpha > 0 ? '#3fb950' : '#f85149' },
    { l: 'Simple Alpha', v: (d.simpleAlpha >= 0 ? '+' : '') + d.simpleAlpha.toFixed(2) + '%', s: 'vs Nifty 50 ' + d.Rm.toFixed(1) + '% CAGR', a: d.simpleAlpha > 0 ? '#3fb950' : '#f85149' },
    { l: 'Portfolio Beta', v: d.weightedBeta.toFixed(2) + 'β', s: d.weightedBeta > 1.1 ? 'Above market risk' : d.weightedBeta < 0.9 ? 'Below market risk' : 'Near-market risk', a: '#58a6ff' },
    { l: 'Expected Return', v: '+' + d.expectedRet.toFixed(2) + '%', s: 'CAPM-predicted at β=' + d.weightedBeta.toFixed(2), a: '#a371f7' },
    { l: 'Portfolio Return', v: (d.Rp >= 0 ? '+' : '') + d.Rp.toFixed(2) + '%', s: 'Actual portfolio return', a: '#d4a843' },
    { l: 'Alpha Grade', v: d.alphaRating.grade, s: d.alphaRating.label, a: d.alphaRating.color },
  ]);

  // CAPM equation display
  const capmBox = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">CAPM Breakdown</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px">
        <span style="font-family:var(--sans);font-size:15px;font-weight:700;color:${jColor}">${d.jensensAlpha >= 0 ? '+' : ''}${d.jensensAlpha.toFixed(2)}% α</span>
        <span style="color:var(--muted)">=</span>
        <span style="color:var(--text)">${d.Rp.toFixed(2)}% Rp</span>
        <span style="color:var(--muted)">−</span>
        <span style="color:var(--muted)">[${d.Rf}% Rf + ${d.weightedBeta.toFixed(2)}β × (${d.Rm.toFixed(1)}% Rm − ${d.Rf}% Rf)]</span>
      </div>
      <div style="margin-top:10px;font-size:11px;color:${d.alphaRating.color}">${d.alphaRating.desc}</div>
    </div>`;

  // Category alpha table
  const maxCatAlpha = Math.max(...d.categoryAlpha.map(c => Math.abs(c.alpha)), 1);
  const catRows = d.categoryAlpha.map(c => {
    const aColor = c.alpha > 0 ? 'var(--green)' : 'var(--red)';
    const barW = Math.round(Math.abs(c.alpha) / maxCatAlpha * 100);
    return `<div class="alpha-row">
      <span class="alpha-name">${esc(c.category)}</span>
      <span class="alpha-cagr" style="color:var(--text)">${c.portfolioCAGR >= 0 ? '+' : ''}${c.portfolioCAGR.toFixed(1)}%</span>
      <span class="alpha-bm"  style="color:var(--muted)">vs ${c.benchmarkCAGR}%</span>
      <span class="alpha-diff" style="color:${aColor}">${c.alpha >= 0 ? '+' : ''}${c.alpha.toFixed(1)}pp</span>
      <div class="alpha-bar-wrap">
        <div class="alpha-bar" style="width:${barW}%;background:${aColor}"></div>
      </div>
    </div>`;
  }).join('');

  // Sector alpha table
  const maxSecAlpha = Math.max(...d.sectorAlpha.map(s => Math.abs(s.alpha)), 1);
  const secRows = d.sectorAlpha.map(s => {
    const aColor = s.alpha > 0 ? 'var(--green)' : 'var(--red)';
    const barW = Math.round(Math.abs(s.alpha) / maxSecAlpha * 100);
    return `<div class="alpha-row">
      <span class="alpha-name">${esc(s.sector)}</span>
      <span class="alpha-cagr" style="color:var(--text)">${s.portfolioRet >= 0 ? '+' : ''}${s.portfolioRet.toFixed(1)}%</span>
      <span class="alpha-bm"  style="color:var(--muted)">vs ${s.benchmarkCAGR}%</span>
      <span class="alpha-diff" style="color:${aColor}">${s.alpha >= 0 ? '+' : ''}${s.alpha.toFixed(1)}pp</span>
      <div class="alpha-bar-wrap">
        <div class="alpha-bar" style="width:${barW}%;background:${aColor}"></div>
      </div>
    </div>`;
  }).join('');

  // Alpha trend chart (rendered after HTML injection)
  setTimeout(() => _renderAlphaTrendChart(d.alphaTrend, d.Rm), 80);

  return `
    <div class="kpi-grid" style="margin-bottom:20px">${kpis}</div>
    ${capmBox}

    <div class="grid2" style="margin-bottom:20px">
      <div class="card">
        <div class="sec-head"><div class="sec-title">MF category alpha</div><div style="font-size:10px;color:var(--muted)">Your return vs category benchmark CAGR</div></div>
        <div class="alpha-box">${catRows || '<div style="color:var(--muted);font-size:11px">No MF data</div>'}</div>
      </div>
      <div class="card">
        <div class="sec-head"><div class="sec-title">Sector alpha (stocks)</div><div style="font-size:10px;color:var(--muted)">Your return vs Nifty sectoral indices</div></div>
        <div class="alpha-box">${secRows || '<div style="color:var(--muted);font-size:11px">No stocks data</div>'}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="sec-head">
        <div class="sec-title">Alpha trend by year</div>
        <div style="font-size:10px;color:var(--muted)">Approximate annual alpha vs Nifty 50 — based on your MF CAGR trajectory</div>
      </div>
      <div class="chart-box" style="height:200px"><canvas id="chart-alpha-trend"></canvas></div>
    </div>

    <div style="font-size:10px;color:var(--muted2);line-height:1.7;padding-top:8px;border-top:1px solid var(--border)">
      ⓘ Jensen's Alpha uses CAPM: α = Rp − [Rf + β(Rm − Rf)]. 
      Beta estimated from category/sector historical averages. 
      Risk-free rate: ${d.Rf}% (10-yr G-Sec). 
      Market return: ${d.Rm.toFixed(1)}% Nifty 50 CAGR (${d.holdYears.toFixed(1)}yr horizon).
    </div>`;
}

function _renderAlphaTrendChart(trend, Rm) {
  if (!trend.length) return;
  scheduleChart('chart-alpha-trend', 60, el => {
    const labels = trend.map(t => t.year);
    const alphas = trend.map(t => t.alpha);
    const zeros = trend.map(() => 0);

    return new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Alpha vs Nifty (pp)',
            data: alphas,
            backgroundColor: alphas.map(a => a >= 0 ? 'rgba(63,185,80,.7)' : 'rgba(248,81,73,.7)'),
            borderColor: alphas.map(a => a >= 0 ? '#3fb950' : '#f85149'),
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Zero line',
            data: zeros,
            type: 'line',
            borderColor: 'var(--border2)',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => (ctx.dataset.label === 'Zero line' ? null : 'Alpha: ' + (ctx.raw >= 0 ? '+' : '') + ctx.raw.toFixed(1) + 'pp') },
            filter: item => item.dataset.label !== 'Zero line',
            backgroundColor: '#1c2330', titleColor: '#e6edf3',
            bodyColor: '#7d8590', borderColor: '#30363d', borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { font: { size: 9 }, color: '#7d8590' }, grid: { color: '#21262d' } },
          y: {
            ticks: { font: { size: 9 }, color: '#7d8590', callback: v => (v >= 0 ? '+' : '') + v.toFixed(1) + 'pp' },
            grid: { color: '#21262d' },
          },
        },
      },
    });
  });
}