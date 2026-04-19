// ── page-goals.js — Goal Planner with Monte Carlo SIP Simulator ───────────
// FIXES applied vs original:
//   1. renderGoalChart: replaced raw setTimeout + chartGoalInst global
//      with scheduleChart() so charts are safely destroyed on page switch.
//   2. renderMonteCarloChart: replaced chartMCInst global with scheduleChart().
//   3. Removed chartGoalInst and chartMCInst globals entirely.

function renderGoalPlanner() {
  updateGoal();
  renderStepUpPlanner();
}

function updateGoal() {
  const corpus =
    parseInt(document.getElementById("goal-corpus").value) || 10000000;
  const year = parseInt(document.getElementById("goal-year").value) || 2035;
  const rate = parseFloat(document.getElementById("goal-rate").value) || 12;

  document.getElementById("goal-corpus-val").textContent = fmtL(corpus);
  document.getElementById("goal-year-val").textContent = year;
  document.getElementById("goal-rate-val").textContent = rate.toFixed(1) + "%";

  const k = DATA.kpis;
  const currentVal = k.totalValue || 0;
  const nowYear = new Date().getFullYear();
  const yrsLeft = Math.max(0.5, year - nowYear);
  const r = rate / 100;
  const rM = r / 12;
  const n = yrsLeft * 12;

  const fvCurrent = currentVal * Math.pow(1 + r, yrsLeft);
  const remaining = Math.max(0, corpus - fvCurrent);
  const sipNeeded =
    remaining > 0 && rM > 0
      ? Math.round((remaining * rM) / (Math.pow(1 + rM, n) - 1))
      : 0;

  const allMonths = buildCombinedMonthly();
  const avgMonthly = allMonths.length
    ? Math.round(
        allMonths.reduce((a, x) => a + x.v, 0) /
          allMonths.filter((x) => x.v > 0).length,
      )
    : 0;
  const fvWithSip =
    currentVal * Math.pow(1 + r, yrsLeft) +
    (avgMonthly > 0
      ? avgMonthly * ((Math.pow(1 + rM, n) - 1) / rM) * (1 + rM)
      : 0);
  const onTrack = fvWithSip >= corpus;
  const gap = corpus - fvWithSip;

  document.getElementById("goal-result-box").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div>
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">SIP needed</div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:700;color:var(--gold)">${sipNeeded > 0 ? fmtL(sipNeeded) + "/mo" : "Already on track!"}</div>
      </div>
      <div>
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Projected at current pace</div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:700;color:${onTrack ? "var(--green)" : "var(--red)"}">${fmtL(Math.round(fvWithSip))}</div>
      </div>
    </div>
    <div style="font-size:11px;color:${onTrack ? "var(--green)" : "var(--amber)"}">
      ${
        onTrack
          ? `✓ On track! Your current avg SIP of ${fmtL(avgMonthly)}/mo will reach ${fmtL(Math.round(fvWithSip))} by ${year} — ${fmtL(Math.round(fvWithSip - corpus))} surplus.`
          : `You need to increase SIP by ${fmtL(Math.max(0, sipNeeded - avgMonthly))}/mo. Current trajectory falls short by ${fmtL(Math.round(gap))}.`
      }
    </div>`;

  renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded);

  // FIX: use renderKpiCards helper (from common.js) instead of copy-pasted template
  document.getElementById("goal-summary-kpis").innerHTML = renderKpiCards([
    { l: "Goal Corpus",      v: fmtL(corpus),                                          s: "Target by " + year,        a: "#d4a843" },
    { l: "Current Portfolio",v: fmtL(currentVal),                                      s: "As of today",              a: "#58a6ff" },
    { l: "Years Remaining",  v: yrsLeft.toFixed(1) + "y",                              s: "To target date",           a: "#a371f7" },
    { l: "SIP Required",     v: sipNeeded > 0 ? fmtL(sipNeeded) + "/mo" : "On track!",s: "At " + rate + "% p.a.",   a: sipNeeded > 0 ? "#f85149" : "#3fb950" },
    { l: "Projected Value",  v: fmtL(Math.round(fvWithSip)),                           s: onTrack ? "Exceeds goal" : "Below goal", a: onTrack ? "#3fb950" : "#f85149" },
    { l: "Avg Current SIP",  v: avgMonthly ? fmtL(avgMonthly) + "/mo" : "—",          s: "Historical monthly avg",   a: "#7d8590" },
  ]);

  const rates = [8, 10, 12, 15, 18];
  const maxSip = Math.max(
    ...rates.map((rt) => {
      const rv = rt / 100, rMv = rv / 12;
      const fvC = currentVal * Math.pow(1 + rv, yrsLeft);
      const rem = Math.max(0, corpus - fvC);
      return rem > 0 && rMv > 0
        ? Math.round((rem * rMv) / (Math.pow(1 + rMv, n) - 1))
        : 0;
    }),
    1,
  );
  document.getElementById("goal-scenarios").innerHTML = rates
    .map((rt) => {
      const rv = rt / 100, rMv = rv / 12;
      const fvC = currentVal * Math.pow(1 + rv, yrsLeft);
      const rem = Math.max(0, corpus - fvC);
      const sip = rem > 0 && rMv > 0
        ? Math.round((rem * rMv) / (Math.pow(1 + rMv, n) - 1))
        : 0;
      const isSelected = Math.abs(rt - rate) < 1;
      return `<div class="goal-scenario-row">
      <span class="goal-scen-rate" style="color:${isSelected ? "var(--gold)" : "var(--muted)"}">${rt}% p.a.${isSelected ? " ◀" : ""}</span>
      <span class="goal-scen-sip" style="color:${sip === 0 ? "var(--green)" : "var(--text)"}">${sip > 0 ? fmtL(sip) + "/mo" : "On track!"}</span>
      <div class="goal-scen-bar"><div class="goal-scen-fill" style="width:${sip > 0 ? Math.round((sip / maxSip) * 100) : 0}%"></div></div>
      <span class="goal-scen-note">${sip > 0 ? "vs avg " + fmtL(avgMonthly) : fmtL(Math.round(currentVal * Math.pow(1 + rv, yrsLeft)))}</span>
    </div>`;
    })
    .join("");

  const milestones = [0.25, 0.5, 0.75, 1.0];
  document.getElementById("goal-milestones").innerHTML = milestones
    .map((pct) => {
      const target = corpus * pct;
      const reached = currentVal >= target;
      let reachYear = null;
      for (let y2 = nowYear; y2 <= 2060; y2++) {
        const yrs2 = y2 - nowYear;
        const fv =
          currentVal * Math.pow(1 + r, yrs2) +
          avgMonthly * ((Math.pow(1 + rM, yrs2 * 12) - 1) / rM) * (1 + rM);
        if (fv >= target) { reachYear = y2; break; }
      }
      const dotColor = reached ? "var(--green)" : reachYear ? "var(--gold)" : "var(--red)";
      return `<div class="milestone-row">
      <div class="milestone-dot" style="background:${dotColor}"></div>
      <span class="milestone-year">${Math.round(pct * 100)}%</span>
      <span class="milestone-corpus" style="color:var(--text)">${fmtL(target)}</span>
      <span class="milestone-status" style="color:${dotColor}">${reached ? "✓ Reached" : reachYear ? "Est. " + reachYear : "Beyond " + year}</span>
    </div>`;
    })
    .join("");

  renderMonteCarloChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded);
}

// ── Deterministic projection chart ───────────────────────────
// FIX: use scheduleChart() instead of raw setTimeout + chartGoalInst global.
// This ensures the chart is safely destroyed if the user navigates away
// before the delay fires, preventing orphaned Chart.js instances.
function renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded) {
  scheduleChart("chart-goal", 60, (el) => {
    const r = rate / 100, rM = r / 12;
    const nowYear = new Date().getFullYear();
    const labels = [], actualTraj = [], sipTraj = [], goalLine = [];

    for (let y = nowYear; y <= year; y++) {
      const yrs = y - nowYear;
      const n2 = yrs * 12;
      const fvCurrent = currentVal * Math.pow(1 + r, yrs);
      const fvActual =
        fvCurrent +
        (avgMonthly > 0
          ? avgMonthly * ((Math.pow(1 + rM, n2) - 1) / rM) * (1 + rM)
          : 0);
      const fvSip =
        fvCurrent +
        (sipNeeded > 0
          ? sipNeeded * ((Math.pow(1 + rM, n2) - 1) / rM) * (1 + rM)
          : fvCurrent);
      labels.push(y);
      actualTraj.push(Math.round(fvActual));
      sipTraj.push(sipNeeded > 0 ? Math.round(fvSip) : null);
      goalLine.push(corpus);
    }

    const datasets = [
      {
        label: "Goal",
        data: goalLine,
        borderColor: "#f85149",
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
      {
        label: "Current pace",
        data: actualTraj,
        borderColor: "#58a6ff",
        backgroundColor: "rgba(88,166,255,.07)",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
    ];
    if (sipNeeded > 0) {
      datasets.push({
        label: "With required SIP",
        data: sipTraj,
        borderColor: "#3fb950",
        backgroundColor: "rgba(63,185,80,.06)",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
        borderDash: [3, 2],
      });
    }

    return new Chart(el, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: "#7d8590", font: { size: 10 }, boxWidth: 12, padding: 10 },
          },
          tooltip: {
            callbacks: { label: (ctx) => ctx.dataset.label + ": " + fmtL(ctx.raw) },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, color: "#7d8590" },
            grid: { color: "#21262d" },
          },
          y: {
            ticks: { font: { size: 9 }, color: "#7d8590", callback: (v) => fmtL(v) },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });
}

// ══════════════════════════════════════════════════════════════
// MONTE CARLO SIP SIMULATOR
// FIX: replaced chartMCInst global + manual destroy with scheduleChart().
// ══════════════════════════════════════════════════════════════
const MC_SIMS = 500;
const MC_SIGMA = 0.18;

function _mcPRNG(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _randn(rand) {
  let u, v;
  do { u = rand(); v = rand(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function renderMonteCarloChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded) {
  const nowYear = new Date().getFullYear();
  const yrsLeft = Math.max(1, year - nowYear);
  const months = Math.round(yrsLeft * 12);
  const r = rate / 100;
  const monthlyDrift = r / 12;
  const monthlySigma = MC_SIGMA / Math.sqrt(12);
  const monthlyInv = avgMonthly > 0 ? avgMonthly : 0;

  const rand = _mcPRNG(42 + Math.round(rate * 100) + Math.round(yrsLeft));
  const allPaths = [];

  for (let sim = 0; sim < MC_SIMS; sim++) {
    let pv = currentVal;
    const path = [pv];
    for (let m = 0; m < months; m++) {
      pv += monthlyInv;
      const gbm = monthlyDrift + monthlySigma * _randn(rand);
      pv *= 1 + gbm;
      if (pv < 0) pv = 0;
      path.push(Math.round(pv));
    }
    allPaths.push(path);
  }

  const labels = [], p10Series = [], p25Series = [], p50Series = [];
  const p75Series = [], p90Series = [], goalSeries = [], detSeries = [];
  const rM = r / 12;
  const totalSteps = months + 1;
  const stepInterval = Math.max(1, Math.round(months / yrsLeft));

  for (let step = 0; step < totalSteps; step += stepInterval) {
    const yr = nowYear + step / 12;
    const yrsElapsed = step / 12;
    labels.push(Math.round(yr));

    const vals = allPaths
      .map((p) => p[Math.min(step, p.length - 1)])
      .sort((a, b) => a - b);
    const pct = (q) => vals[Math.max(0, Math.floor((q * vals.length) / 100))];

    p10Series.push(pct(10));
    p25Series.push(pct(25));
    p50Series.push(pct(50));
    p75Series.push(pct(75));
    p90Series.push(pct(90));
    goalSeries.push(corpus);

    const n2 = yrsElapsed * 12;
    const fvDet =
      currentVal * Math.pow(1 + r, yrsElapsed) +
      (monthlyInv > 0
        ? monthlyInv * ((Math.pow(1 + rM, n2) - 1) / rM) * (1 + rM)
        : 0);
    detSeries.push(Math.round(fvDet));
  }

  if (labels[labels.length - 1] !== year) {
    const finalVals = allPaths.map((p) => p[p.length - 1]).sort((a, b) => a - b);
    const fpct = (q) => finalVals[Math.max(0, Math.floor((q * finalVals.length) / 100))];
    labels.push(year);
    p10Series.push(fpct(10));
    p25Series.push(fpct(25));
    p50Series.push(fpct(50));
    p75Series.push(fpct(75));
    p90Series.push(fpct(90));
    goalSeries.push(corpus);
    const n2 = yrsLeft * 12;
    detSeries.push(
      Math.round(
        currentVal * Math.pow(1 + r, yrsLeft) +
          (monthlyInv > 0
            ? monthlyInv * ((Math.pow(1 + rM, n2) - 1) / rM) * (1 + rM)
            : 0),
      ),
    );
  }

  const finalVals = allPaths.map((p) => p[p.length - 1]);
  const probSuccess = Math.round(
    (finalVals.filter((v) => v >= corpus).length / MC_SIMS) * 100,
  );
  const medianFinal = [...finalVals].sort((a, b) => a - b)[Math.floor(MC_SIMS / 2)];

  const probEl = document.getElementById("mc-prob-display");
  if (probEl) {
    const probColor =
      probSuccess >= 70 ? "var(--green)" : probSuccess >= 40 ? "var(--amber)" : "var(--red)";
    probEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Probability of reaching goal</div>
          <div style="font-family:var(--sans);font-size:28px;font-weight:700;color:${probColor}">${probSuccess}%</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Median projected value</div>
          <div style="font-family:var(--sans);font-size:28px;font-weight:700;color:var(--gold)">${fmtL(medianFinal)}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Pessimistic (P10)</div>
          <div style="font-family:var(--sans);font-size:20px;font-weight:700;color:var(--red)">${fmtL(p10Series[p10Series.length - 1])}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Optimistic (P90)</div>
          <div style="font-family:var(--sans);font-size:20px;font-weight:700;color:var(--green)">${fmtL(p90Series[p90Series.length - 1])}</div>
        </div>
        <div style="flex:1;min-width:200px;font-size:11px;color:var(--muted);line-height:1.7">
          Based on ${MC_SIMS} simulated market paths using 18% annualised volatility (Indian equity historical).
          ${probSuccess >= 70 ? "✓ Strong probability — stay the course." : probSuccess >= 40 ? "⚠ Moderate probability — consider increasing SIP." : "✗ Low probability — a higher SIP or longer horizon is recommended."}
        </div>
      </div>`;
  }

  // FIX: scheduleChart() instead of manual chartMCInst destroy
  scheduleChart("chart-monte-carlo", 60, (el) => {
    return new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "P90 (optimistic)", data: p90Series, borderColor: "rgba(63,185,80,.5)", backgroundColor: "rgba(63,185,80,.08)", borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0, fill: "+3", tension: 0.3, order: 5 },
          { label: "P75",              data: p75Series, borderColor: "rgba(63,185,80,.3)", backgroundColor: "rgba(63,185,80,.06)", borderWidth: 1, pointRadius: 0, fill: false, tension: 0.3, order: 4 },
          { label: "Median (P50)",     data: p50Series, borderColor: "#3fb950", backgroundColor: "transparent", borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: false, tension: 0.3, order: 3 },
          { label: "P25",              data: p25Series, borderColor: "rgba(248,81,73,.3)", backgroundColor: "rgba(248,81,73,.06)", borderWidth: 1, pointRadius: 0, fill: false, tension: 0.3, order: 2 },
          { label: "P10 (pessimistic)",data: p10Series, borderColor: "rgba(248,81,73,.5)", backgroundColor: "rgba(248,81,73,.08)", borderWidth: 1.5, borderDash: [3, 3], pointRadius: 0, fill: false, tension: 0.3, order: 1 },
          { label: "Avg SIP (deterministic)", data: detSeries, borderColor: "#58a6ff", backgroundColor: "transparent", borderWidth: 2, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0.3, order: 6 },
          { label: "Goal",             data: goalSeries, borderColor: "#f85149", backgroundColor: "transparent", borderWidth: 1.5, borderDash: [8, 5], pointRadius: 0, fill: false, tension: 0, order: 7 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              color: "#7d8590",
              font: { size: 9 },
              boxWidth: 12,
              padding: 8,
              filter: (item) => !["P75", "P25"].includes(item.text),
            },
          },
          tooltip: {
            callbacks: { label: (ctx) => ctx.dataset.label + ": " + fmtL(ctx.raw) },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { font: { size: 9 }, color: "#7d8590" }, grid: { color: "#21262d" } },
          y: { ticks: { font: { size: 9 }, color: "#7d8590", callback: (v) => fmtL(v) }, grid: { color: "#21262d" } },
        },
      },
    });
  });
}
