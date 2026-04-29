// ══════════════════════════════════════════════════════════════
// monte-carlo-chart.js — Monte Carlo SIP Simulator
//
// Simulation runs in async RAF chunks of MC_CHUNK sims per frame.
//   • Each chunk takes ~1-2ms — well under the 16ms frame budget.
//   • A cancellation token (_mcRunToken) lets a new invocation abort
//     a still-running one immediately, so rapid slider changes never
//     queue up multiple expensive computations.
//   • The chart is only built once all paths are complete.
// ══════════════════════════════════════════════════════════════

function renderMonteCarloChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded) {
  // Cancel any in-flight run immediately
  if (_mcRunToken) { _mcRunToken.cancelled = true; }
  const token = { cancelled: false };
  _mcRunToken = token;

  const nowYear = new Date().getFullYear();
  const yrsLeft = Math.max(1, year - nowYear);
  const months = Math.round(yrsLeft * 12);
  const r = rate / 100;
  const monthlyDrift = r / 12;
  const monthlySigma = MC_SIGMA / Math.sqrt(12);
  const monthlyInv = avgMonthly > 0 ? avgMonthly : 0;

  const rand = _mcPRNG(42 + Math.round(rate * 100) + Math.round(yrsLeft));
  const allPaths = [];

  // Show a loading indicator while chunks run
  const probEl = document.getElementById("mc-prob-display");
  if (probEl) {
    probEl.innerHTML = `<div style="color:var(--muted);font-size:11px">
      ⏳ Running ${MC_SIMS} simulations…
    </div>`;
  }

  function runChunk(startSim) {
    // If sliders changed, a new token was issued — abandon this run
    if (token.cancelled) return;

    const end = Math.min(startSim + MC_CHUNK, MC_SIMS);
    for (let sim = startSim; sim < end; sim++) {
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

    if (end < MC_SIMS) {
      // Yield back to browser, continue next frame
      requestAnimationFrame(() => runChunk(end));
    } else {
      // All done — build stats and render
      if (!token.cancelled) {
        _finaliseMonteCarlo(
          token, allPaths, corpus, year, rate, currentVal,
          avgMonthly, sipNeeded, months, yrsLeft
        );
      }
    }
  }

  // Kick off first chunk after a short delay so the loading indicator paints
  requestAnimationFrame(() => runChunk(0));
}

function _finaliseMonteCarlo(
  token, allPaths, corpus, year, rate, currentVal,
  avgMonthly, sipNeeded, months, yrsLeft
) {
  if (token.cancelled) return;

  const nowYear = new Date().getFullYear();
  const r = rate / 100;
  const rM = r / 12;
  const monthlyInv = avgMonthly > 0 ? avgMonthly : 0;

  const labels = [], p10Series = [], p25Series = [], p50Series = [];
  const p75Series = [], p90Series = [], goalSeries = [], detSeries = [];
  const totalSteps = months + 1;
  const stepInterval = Math.max(1, Math.round(months / yrsLeft));

  for (let step = 0; step < totalSteps; step += stepInterval) {
    if (token.cancelled) return;
    const yr = nowYear + step / 12;
    const yrsElapsed = step / 12;
    labels.push(Math.round(yr));

    const vals = allPaths
      .map(p => p[Math.min(step, p.length - 1)])
      .sort((a, b) => a - b);
    const pct = q => vals[Math.max(0, Math.floor((q * vals.length) / 100))];

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
    const finalVals = allPaths.map(p => p[p.length - 1]).sort((a, b) => a - b);
    const fpct = q => finalVals[Math.max(0, Math.floor((q * finalVals.length) / 100))];
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

  if (token.cancelled) return;

  const finalVals = allPaths.map(p => p[p.length - 1]);
  const probSuccess = Math.round(
    (finalVals.filter(v => v >= corpus).length / MC_SIMS) * 100,
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

  if (token.cancelled) return;

  scheduleChart("chart-monte-carlo", 60, el => {
    if (token.cancelled) return null;
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
              filter: item => !["P75", "P25"].includes(item.text),
            },
          },
          tooltip: {
            callbacks: { label: ctx => ctx.dataset.label + ": " + fmtL(ctx.raw) },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: { ticks: { font: { size: 9 }, color: "#7d8590" }, grid: { color: "#21262d" } },
          y: { ticks: { font: { size: 9 }, color: "#7d8590", callback: v => fmtL(v) }, grid: { color: "#21262d" } },
        },
      },
    });
  });
}
