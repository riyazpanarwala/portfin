// ── page-goals.js — Goal Planner with Monte Carlo SIP Simulator ───────────
// Entry point & main orchestrator.
// Load order (before this file):
//   1. goals/goal-state.js          — state vars, slider init, debounce
//   2. goals/monte-carlo-engine.js  — MC constants, _mcPRNG, _randn
//   3. goals/goal-chart.js          — renderGoalChart()
//   4. goals/monte-carlo-chart.js   — renderMonteCarloChart(), _finaliseMonteCarlo()
//   5. page-goals.js                ← this file (renderGoalPlanner, updateGoal)

function renderGoalPlanner() {
  _initGoalSliders();
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
  const activeMonths = allMonths.filter(x => x.v > 0);
  const avgMonthly = activeMonths.length
    ? Math.round(activeMonths.reduce((a, x) => a + x.v, 0) / activeMonths.length)
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
    ...rates.map(rt => {
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
    .map(rt => {
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
    .map(pct => {
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

  // cancel any in-flight async MC run, then kick off a fresh one
  renderMonteCarloChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded);
}
