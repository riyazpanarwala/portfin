// ── page-stepup.js — SIP Step-Up Planner ────────────────────────────────────
// Extends the Goal Planner with annual step-up (escalation) simulation.
// Compares flat SIP vs stepped-up SIP vs current pace across multiple scenarios.
// All computation is pure math — no backend required.

let chartStepUpInst   = null;
let chartStepCompInst = null;

// ── Main render entry ─────────────────────────────────────────
function renderStepUpPlanner() {
  _initStepUpSliders();
  updateStepUp();
}

function _initStepUpSliders() {
  // Only wire once
  if (document.getElementById('su-sip')._suWired) return;
  ['su-sip','su-steprate','su-rate','su-year'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateStepUp);
      el._suWired = true;
    }
  });
}

// ── Core update ───────────────────────────────────────────────
function updateStepUp() {
  const baseSIP   = parseInt(document.getElementById('su-sip').value)      || 10000;
  const stepRate  = parseFloat(document.getElementById('su-steprate').value) || 10;
  const annReturn = parseFloat(document.getElementById('su-rate').value)     || 12;
  const years     = parseInt(document.getElementById('su-year').value)       || 15;

  // Live label updates
  document.getElementById('su-sip-val').textContent      = fmtL(baseSIP) + '/mo';
  document.getElementById('su-steprate-val').textContent = '+' + stepRate.toFixed(0) + '% / yr';
  document.getElementById('su-rate-val').textContent     = annReturn.toFixed(1) + '% p.a.';
  document.getElementById('su-year-val').textContent     = years + ' yrs';

  const r  = annReturn / 100;
  const rM = r / 12;

  // ── 1. Flat SIP corpus ────────────────────────────────────
  const flatCorpus = _flatSIPCorpus(baseSIP, rM, years * 12);
  const flatInvested = baseSIP * years * 12;

  // ── 2. Step-up SIP corpus ─────────────────────────────────
  const { corpus: stepCorpus, invested: stepInvested, finalSIP } =
    _stepUpCorpus(baseSIP, stepRate / 100, rM, years);

  // ── 3. Current portfolio contribution ─────────────────────
  const currentVal = DATA.kpis.totalValue || 0;
  const currentFV  = currentVal * Math.pow(1 + r, years);

  // ── 4. Grand total with step-up ───────────────────────────
  const totalWithPortfolio = stepCorpus + currentFV;

  // ── 5. Extra wealth from stepping up vs flat ─────────────
  const extraWealth    = stepCorpus - flatCorpus;
  const extraInvested  = stepInvested - flatInvested;
  const extraGrowth    = extraWealth - extraInvested;   // extra gains on extra contributions

  // ── KPI strip ─────────────────────────────────────────────
  document.getElementById('su-kpis').innerHTML = [
    { l: 'Flat SIP corpus',    v: fmtL(Math.round(flatCorpus)),    s: fmtL(flatInvested) + ' invested',         a: '#58a6ff' },
    { l: 'Step-up corpus',     v: fmtL(Math.round(stepCorpus)),    s: fmtL(Math.round(stepInvested)) + ' invested', a: '#d4a843' },
    { l: 'Extra wealth',       v: fmtL(Math.round(extraWealth)),   s: 'By stepping up vs flat',                a: '#3fb950' },
    { l: 'Final monthly SIP',  v: fmtL(Math.round(finalSIP)) + '/mo', s: 'After ' + years + 'y of step-ups', a: '#a371f7' },
    { l: 'With your portfolio',v: fmtL(Math.round(totalWithPortfolio)), s: 'Step-up SIP + current FV',        a: '#f0c060' },
    { l: 'Step-up multiplier', v: (stepCorpus / flatCorpus).toFixed(2) + 'x', s: 'vs flat SIP outcome',     a: '#f0883e' },
  ].map(c =>
    `<div class="kpi-card" style="--accent:${c.a}">
      <div class="kpi-label">${c.l}</div>
      <div class="kpi-value">${c.v}</div>
      <div class="kpi-sub">${c.s}</div>
    </div>`
  ).join('');

  // ── Insight box ───────────────────────────────────────────
  const pctMore = ((stepCorpus / flatCorpus - 1) * 100).toFixed(1);
  const sipIncr = fmtL(Math.round(finalSIP - baseSIP));
  document.getElementById('su-insight').innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">
          What stepping up does for you
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.8">
          By increasing your SIP by <span style="color:var(--gold);font-weight:600">+${stepRate.toFixed(0)}% every year</span>,
          you accumulate <span style="color:var(--green);font-weight:600">${pctMore}% more</span> wealth
          than a flat ${fmtL(baseSIP)}/mo SIP — while your <em>real burden</em> stays roughly constant
          as income grows. Your final SIP of <span style="color:var(--gold);font-weight:600">${fmtL(Math.round(finalSIP))}/mo</span>
          will feel like less than ${fmtL(baseSIP)}/mo today does in real purchasing power.
        </div>
      </div>
      <div style="background:var(--bg4);border-radius:8px;padding:14px 18px;min-width:170px;flex-shrink:0;border:1px solid var(--border)">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Extra gains (not invested)</div>
        <div style="font-family:var(--sans);font-size:22px;font-weight:700;color:var(--green)">${fmtL(Math.round(extraGrowth))}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">compounded on top-up contributions</div>
      </div>
    </div>`;

  // ── Charts ─────────────────────────────────────────────────
  _renderStepUpGrowthChart(baseSIP, stepRate / 100, rM, r, years, currentVal);
  _renderStepUpComparisonChart(baseSIP, stepRate / 100, rM, years);
  _renderStepRateScenarios(baseSIP, rM, r, years, currentVal, flatCorpus);
  _renderStepUpSchedule(baseSIP, stepRate / 100, rM, years);
}

// ── Flat SIP final value ──────────────────────────────────────
function _flatSIPCorpus(sip, rM, months) {
  if (rM === 0) return sip * months;
  return sip * ((Math.pow(1 + rM, months) - 1) / rM) * (1 + rM);
}

// ── Step-up SIP final value (year-by-year) ────────────────────
function _stepUpCorpus(baseSIP, stepRate, rM, years) {
  let corpus   = 0;
  let invested = 0;
  let currentSIP = baseSIP;

  for (let y = 0; y < years; y++) {
    // Each year: invest currentSIP monthly, then compound existing corpus for full year too
    const monthsRemaining = (years - y) * 12;
    // Contribute this year's SIP for 12 months, then let it compound for remaining years
    const thisYearFV = currentSIP * ((Math.pow(1 + rM, 12) - 1) / rM) * (1 + rM)
                       * Math.pow(1 + rM, (years - y - 1) * 12);
    corpus   += thisYearFV;
    invested += currentSIP * 12;
    if (y < years - 1) currentSIP = currentSIP * (1 + stepRate);
  }

  return { corpus, invested, finalSIP: currentSIP };
}

// ── Year-by-year data for chart ────────────────────────────────
function _buildYearSeries(baseSIP, stepRate, rM, r, years, currentVal) {
  const flat    = [], stepped = [], withPort = [], sipAmounts = [];
  let cumFlat = 0, cumStep = 0, curSIP = baseSIP;

  for (let y = 1; y <= years; y++) {
    const n  = y * 12;
    const nP = (y - 1) * 12;

    // Flat SIP FV up to year y
    cumFlat = _flatSIPCorpus(baseSIP, rM, n);

    // Step-up: sum of all year contributions up to year y
    let stepVal = 0, s = baseSIP;
    for (let yi = 0; yi < y; yi++) {
      const yearsLeft = y - yi;
      const yearFV    = s * ((Math.pow(1 + rM, 12) - 1) / rM) * (1 + rM)
                        * Math.pow(1 + rM, (yearsLeft - 1) * 12);
      stepVal += yearFV;
      if (yi < y - 1) s *= (1 + stepRate);
    }
    cumStep = stepVal;

    const portFV = currentVal * Math.pow(1 + r, y);
    flat.push(Math.round(cumFlat));
    stepped.push(Math.round(cumStep));
    withPort.push(Math.round(cumStep + portFV));
    sipAmounts.push(Math.round(baseSIP * Math.pow(1 + stepRate, y - 1)));
  }

  return { flat, stepped, withPort, sipAmounts };
}

// ── Growth chart ──────────────────────────────────────────────
function _renderStepUpGrowthChart(baseSIP, stepRate, rM, r, years, currentVal) {
  const labels = Array.from({ length: years }, (_, i) => 'Yr ' + (i + 1));
  const { flat, stepped, withPort } = _buildYearSeries(baseSIP, stepRate, rM, r, years, currentVal);

  // Destroy old
  const el = document.getElementById('chart-stepup-growth');
  if (!el) return;
  if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }

  const datasets = [
    {
      label: 'Step-up SIP corpus',
      data:  stepped,
      borderColor: '#d4a843',
      backgroundColor: 'rgba(212,168,67,.10)',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      fill: true,
      tension: 0.35,
    },
    {
      label: 'Flat SIP corpus',
      data:  flat,
      borderColor: '#58a6ff',
      backgroundColor: 'rgba(88,166,255,.06)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.35,
      borderDash: [5, 4],
    },
  ];

  if (currentVal > 0) {
    datasets.push({
      label: 'Step-up + current portfolio',
      data:  withPort,
      borderColor: '#3fb950',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.35,
      borderDash: [3, 2],
    });
  }

  el._chartInst = new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: { color: '#7d8590', font: { size: 10 }, boxWidth: 12, padding: 10 },
        },
        tooltip: {
          callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtL(ctx.raw) },
          backgroundColor: '#1c2330', titleColor: '#e6edf3',
          bodyColor: '#7d8590', borderColor: '#30363d', borderWidth: 1,
        },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, color: '#7d8590' }, grid: { color: '#21262d' } },
        y: { ticks: { font: { size: 9 }, color: '#7d8590', callback: v => fmtL(v) }, grid: { color: '#21262d' } },
      },
    },
  });
}

// ── Side-by-side annual invested vs corpus bar chart ──────────
function _renderStepUpComparisonChart(baseSIP, stepRate, rM, years) {
  const el = document.getElementById('chart-stepup-compare');
  if (!el) return;
  if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }

  const labels = Array.from({ length: years }, (_, i) => 'Yr ' + (i + 1));
  const annualSIPs = Array.from({ length: years }, (_, i) =>
    Math.round(baseSIP * Math.pow(1 + stepRate, i))
  );
  const annualFlatSIPs = Array.from({ length: years }, () => baseSIP);

  el._chartInst = new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly SIP (step-up)',
          data: annualSIPs,
          backgroundColor: annualSIPs.map((v, i) => {
            const alpha = 0.4 + (i / years) * 0.5;
            return `rgba(212,168,67,${alpha.toFixed(2)})`;
          }),
          borderColor: '#d4a843',
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: 'Monthly SIP (flat)',
          data: annualFlatSIPs,
          backgroundColor: 'rgba(88,166,255,.25)',
          borderColor: '#58a6ff',
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
          borderDash: [3, 2],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: { color: '#7d8590', font: { size: 10 }, boxWidth: 12, padding: 10 },
        },
        tooltip: {
          callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtL(ctx.raw) + '/mo' },
          backgroundColor: '#1c2330', titleColor: '#e6edf3',
          bodyColor: '#7d8590', borderColor: '#30363d', borderWidth: 1,
        },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, color: '#7d8590', maxRotation: 45 }, grid: { color: '#21262d' } },
        y: {
          ticks: { font: { size: 9 }, color: '#7d8590', callback: v => fmtL(v) },
          grid: { color: '#21262d' },
        },
      },
    },
  });
}

// ── Multi step-rate scenario table ────────────────────────────
function _renderStepRateScenarios(baseSIP, rM, r, years, currentVal, flatCorpus) {
  const stepRates = [0, 5, 10, 15, 20, 25];
  const maxCorpus = Math.max(
    ..._buildStepRateCorpora(baseSIP, rM, years, stepRates), 1
  );

  document.getElementById('su-scenarios').innerHTML = stepRates.map(sr => {
    const { corpus, invested, finalSIP } = _stepUpCorpus(baseSIP, sr / 100, rM, years);
    const portFV   = currentVal * Math.pow(1 + r, years);
    const totalFV  = corpus + portFV;
    const multVsFlat = flatCorpus > 0 ? (corpus / flatCorpus).toFixed(2) : '—';
    const isBase   = sr === 10; // default highlight

    return `<div class="goal-scenario-row">
      <span class="goal-scen-rate" style="color:${isBase ? 'var(--gold)' : 'var(--muted)'}">
        ${sr === 0 ? 'Flat (no step-up)' : '+' + sr + '% / yr'}${isBase ? ' ◀' : ''}
      </span>
      <span class="goal-scen-sip" style="color:${sr === 0 ? 'var(--muted)' : 'var(--gold)'}">
        ${fmtL(Math.round(corpus))}
      </span>
      <div class="goal-scen-bar">
        <div class="goal-scen-fill" style="width:${Math.round(corpus / maxCorpus * 100)}%"></div>
      </div>
      <span class="goal-scen-note" style="font-size:10px;color:var(--muted)">
        ${multVsFlat}x · Final SIP ${fmtL(Math.round(finalSIP))}/mo
      </span>
    </div>`;
  }).join('');
}

function _buildStepRateCorpora(baseSIP, rM, years, rates) {
  return rates.map(sr => _stepUpCorpus(baseSIP, sr / 100, rM, years).corpus);
}

// ── Year-by-year SIP schedule table ───────────────────────────
function _renderStepUpSchedule(baseSIP, stepRate, rM, years) {
  let sip     = baseSIP;
  let cumInv  = 0;
  let rows    = '';

  const YEAR_LABELS = [1,2,3,4,5,6,7,8,9,10,15,20,25,30].filter(y => y <= years);

  YEAR_LABELS.forEach(y => {
    const thisSIP  = Math.round(baseSIP * Math.pow(1 + stepRate, y - 1));
    const yearInv  = thisSIP * 12;
    const corpus   = _stepUpCorpus(baseSIP, stepRate, rM, y).corpus;
    const invested = _stepUpCorpus(baseSIP, stepRate, rM, y).invested;
    const gain     = corpus - invested;
    const pct      = invested > 0 ? (gain / invested * 100).toFixed(1) : 0;

    rows += `<tr>
      <td style="color:var(--gold);font-weight:600">Year ${y}</td>
      <td style="font-weight:500">${fmtL(thisSIP)}/mo</td>
      <td class="td-muted">${fmtL(yearInv)}/yr</td>
      <td class="td-muted">${fmtL(Math.round(invested))}</td>
      <td style="font-weight:600">${fmtL(Math.round(corpus))}</td>
      <td class="td-up">${fmtL(Math.round(gain))}</td>
      <td class="td-up">${pct}%</td>
    </tr>`;
  });

  document.getElementById('su-schedule').innerHTML = `
    <table class="drill-table" style="min-width:560px">
      <thead><tr>
        <th>Year</th><th>Monthly SIP</th><th>Annual deploy</th>
        <th>Cum. invested</th><th>Corpus value</th>
        <th>Total gain</th><th>Gain %</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
