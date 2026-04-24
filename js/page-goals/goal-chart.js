// ── goal-chart.js — Deterministic projection chart ───────────────────

function renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded) {
  scheduleChart("chart-goal", 60, el => {
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
            callbacks: { label: ctx => ctx.dataset.label + ": " + fmtL(ctx.raw) },
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
            ticks: { font: { size: 9 }, color: "#7d8590", callback: v => fmtL(v) },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });
}
