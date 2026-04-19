// ── page-stepup.js — SIP Step-Up Planner ────────────────────────────────────
// FIX applied vs original:
//   _initStepUpSliders used el._suWired to prevent double-adding listeners,
//   but the flag is set on DOM elements which are NOT recreated between page
//   switches (they live in the static HTML). However, the function is called
//   from renderGoalPlanner() on EVERY page render. The real issue is that
//   input event listeners are additive — calling addEventListener twice on
//   the same element fires the handler twice.
//
//   Fix: Use a module-level boolean flag instead of a per-element property.
//   This correctly prevents double-wiring across repeated renderGoalPlanner calls.

let _stepUpSlidersWired = false;

let chartStepUpInst   = null;
let chartStepCompInst = null;

function renderStepUpPlanner() {
  _initStepUpSliders();
  updateStepUp();
}

// FIX: module-level flag prevents accumulating duplicate event listeners
// across repeated calls to renderGoalPlanner() / renderStepUpPlanner().
function _initStepUpSliders() {
  if (_stepUpSlidersWired) return;
  ['su-sip', 'su-steprate', 'su-rate', 'su-year'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateStepUp);
  });
  _stepUpSlidersWired = true;
}

function updateStepUp() {
  const baseSIP   = parseInt(document.getElementById('su-sip').value)       || 10000;
  const stepRate  = parseFloat(document.getElementById('su-steprate').value) || 10;
  const annReturn = parseFloat(document.getElementById('su-rate').value)     || 12;
  const years     = parseInt(document.getElementById('su-year').value)       || 15;

  document.getElementById('su-sip-val').textContent      = fmtL(baseSIP) + '/mo';
  document.getElementById('su-steprate-val').textContent = '+' + stepRate.toFixed(0) + '% / yr';
  document.getElementById('su-rate-val').textContent     = annReturn.toFixed(1) + '% p.a.';
  document.getElementById('su-year-val').textContent     = years + ' yrs';

  const r  = annReturn / 100;
  const rM = r / 12;

  const flatCorpus = _flatSIPCorpus(baseSIP, rM, years * 12);
  const flatInvested = baseSIP * years * 12;

  const { corpus: stepCorpus, invested: stepInvested, finalSIP } =
    _stepUpCorpus(baseSIP, stepRate / 100, rM, years);

  const currentVal = DATA.kpis.totalValue || 0;
  const currentFV  = currentVal * Math.pow(1 + r, years);

  const totalWithPortfolio = stepCorpus + currentFV;
  const extraWealth    = stepCorpus - flatCorpus;
  const extraInvested  = stepInvested - flatInvested;
  const extraGrowth    = extraWealth - extraInvested;

  // FIX: use renderKpiCards helper (from common.js)
  document.getElementById('su-kpis').innerHTML = renderKpiCards([
    { l: 'Flat SIP corpus',    v: fmtL(Math.round(flatCorpus)),           s: fmtL(flatInvested) + ' invested',              a: '#58a6ff' },
    { l: 'Step-up corpus',     v: fmtL(Math.round(stepCorpus)),           s: fmtL(Math.round(stepInvested)) + ' invested',  a: '#d4a843' },
    { l: 'Extra wealth',       v: fmtL(Math.round(extraWealth)),          s: 'By stepping up vs flat',                      a: '#3fb950' },
    { l: 'Final monthly SIP',  v: fmtL(Math.round(finalSIP)) + '/mo',    s: 'After ' + years + 'y of step-ups',            a: '#a371f7' },
    { l: 'With your portfolio',v: fmtL(Math.round(totalWithPortfolio)),   s: 'Step-up SIP + current FV',                   a: '#f0c060' },
    { l: 'Step-up multiplier', v: (stepCorpus / flatCorpus).toFixed(2) + 'x', s: 'vs flat SIP outcome',                   a: '#f0883e' },
  ]);

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

  _renderStepUpGrowthChart(baseSIP, stepRate / 100, rM, r, years, currentVal);
  _renderStepUpComparisonChart(baseSIP, stepRate / 100, rM, years);
  _renderStepRateScenarios(baseSIP, rM, r, years, currentVal, flatCorpus);
  _renderStepUpSchedule(baseSIP, stepRate / 100, rM, years);
}

function _flatSIPCorpus(sip, rM, months) {
  if (rM === 0) return sip * months;
  return sip * ((Math.pow(1 + rM, months) - 1) / rM) * (1 + rM);
}

function _stepUpCorpus(baseSIP, stepRate, rM, years) {
  let corpus = 0, invested = 0, currentSIP = baseSIP;
  for (let y = 0; y < years; y++) {
    const thisYearFV = currentSIP * ((Math.pow(1 + rM, 12) - 1) / rM) * (1 + rM)
                       * Math.pow(1 + rM, (years - y - 1) * 12);
    corpus   += thisYearFV;
    invested += currentSIP * 12;
    if (y < years - 1) currentSIP = currentSIP * (1 + stepRate);
  }
  return { corpus, invested, finalSIP: currentSIP };
}

function _buildYearSeries(baseSIP, stepRate, rM, r, years, currentVal) {
  const flat = [], stepped = [], withPort = [], sipAmounts = [];
  for (let y = 1; y <= years; y++) {
    const n = y * 12;
    const cumFlat = _flatSIPCorpus(baseSIP, rM, n);
    let stepVal = 0, s = baseSIP;
    for (let yi = 0; yi < y; yi++) {
      const yearsLeft = y - yi;
      const yearFV = s * ((Math.pow(1 + rM, 12) - 1) / rM) * (1 + rM)
                     * Math.pow(1 + rM, (yearsLeft - 1) * 12);
      stepVal += yearFV;
      if (yi < y - 1) s *= (1 + stepRate);
    }
    const portFV = currentVal * Math.pow(1 + r, y);
    flat.push(Math.round(cumFlat));
    stepped.push(Math.round(stepVal));
    withPort.push(Math.round(stepVal + portFV));
    sipAmounts.push(Math.round(baseSIP * Math.pow(1 + stepRate, y - 1)));
  }
  return { flat, stepped, withPort, sipAmounts };
}

function _renderStepUpGrowthChart(baseSIP, stepRate, rM, r, years, currentVal) {
  const labels = Array.from({ length: years }, (_, i) => 'Yr ' + (i + 1));
  const { flat, stepped, withPort } = _buildYearSeries(baseSIP, stepRate, rM, r, years, currentVal);
  const el = document.getElementById('chart-stepup-growth');
  if (!el) return;
  if (el._chartInst) { el._chartInst.destroy(); el._chartInst = null; }

  const datasets = [
    { label: 'Step-up SIP corpus', data: stepped, borderColor: '#d4a843', backgroundColor: 'rgba(212,168,67,.10)', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.35 },
    { label: 'Flat SIP corpus',    data: flat,    borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,.06)',  borderWidth: 2,   pointRadius: 0, pointHoverRadius: 4, fill: true, tension: 0.35, borderDash: [5, 4] },
  ];
  if (currentVal > 0) {
    datasets.push({ label: 'Step-up + current portfolio', data: withPort, borderColor: '#3fb950', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.35, borderDash: [3, 2] });
  }

  el._chartInst = new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#7d8590', font: { size: 10 }, boxWidth: 12, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtL(ctx.raw) }, backgroundColor: '#1c2330', titleColor: '#e6edf3', bodyColor: '#7d8590', borderColor: '#30363d', borderWidth: 1 },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, color: '#7d8590' }, grid: { color: '#21262d' } },
        y: { ticks: { font: { size: 9 }, color: '#7d8590', callback: v => fmtL(v) }, grid: { color: '#21262d' } },
      },
    },
  });
}

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
        { label: 'Monthly SIP (step-up)', data: annualSIPs, backgroundColor: annualSIPs.map((v, i) => `rgba(212,168,67,${(0.4 + (i / years) * 0.5).toFixed(2)})`), borderColor: '#d4a843', borderWidth: 1, borderRadius: 3, borderSkipped: false },
        { label: 'Monthly SIP (flat)',    data: annualFlatSIPs, backgroundColor: 'rgba(88,166,255,.25)', borderColor: '#58a6ff', borderWidth: 1, borderRadius: 3, borderSkipped: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#7d8590', font: { size: 10 }, boxWidth: 12, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmtL(ctx.raw) + '/mo' }, backgroundColor: '#1c2330', titleColor: '#e6edf3', bodyColor: '#7d8590', borderColor: '#30363d', borderWidth: 1 },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, color: '#7d8590', maxRotation: 45 }, grid: { color: '#21262d' } },
        y: { ticks: { font: { size: 9 }, color: '#7d8590', callback: v => fmtL(v) }, grid: { color: '#21262d' } },
      },
    },
  });
}

function _renderStepRateScenarios(baseSIP, rM, r, years, currentVal, flatCorpus) {
  const stepRates = [0, 5, 10, 15, 20, 25];
  const corpora = stepRates.map(sr => _stepUpCorpus(baseSIP, sr / 100, rM, years).corpus);
  const maxCorpus = Math.max(...corpora, 1);

  document.getElementById('su-scenarios').innerHTML = stepRates.map((sr, i) => {
    const { corpus, invested, finalSIP } = _stepUpCorpus(baseSIP, sr / 100, rM, years);
    const multVsFlat = flatCorpus > 0 ? (corpus / flatCorpus).toFixed(2) : '—';
    const isBase = sr === 10;

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

function _renderStepUpSchedule(baseSIP, stepRate, rM, years) {
  const YEAR_LABELS = [1,2,3,4,5,6,7,8,9,10,15,20,25,30].filter(y => y <= years);

  const rows = YEAR_LABELS.map(y => {
    const thisSIP  = Math.round(baseSIP * Math.pow(1 + stepRate, y - 1));
    const yearInv  = thisSIP * 12;
    const { corpus, invested } = _stepUpCorpus(baseSIP, stepRate, rM, y);
    const gain  = corpus - invested;
    const pct   = invested > 0 ? (gain / invested * 100).toFixed(1) : 0;

    return `<tr>
      <td style="color:var(--gold);font-weight:600">Year ${y}</td>
      <td style="font-weight:500">${fmtL(thisSIP)}/mo</td>
      <td class="td-muted">${fmtL(yearInv)}/yr</td>
      <td class="td-muted">${fmtL(Math.round(invested))}</td>
      <td style="font-weight:600">${fmtL(Math.round(corpus))}</td>
      <td class="td-up">${fmtL(Math.round(gain))}</td>
      <td class="td-up">${pct}%</td>
    </tr>`;
  }).join('');

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
