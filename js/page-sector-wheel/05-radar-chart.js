// ── page-sector-wheel/05-radar-chart.js ─────────────────────────────────────
// Chart.js radar: actual sector % vs equal-weight benchmark.
// Depends on: 01-constants.js, common scheduleChart().

function _drawSectorRadar(sectorData, equalWeight) {
  scheduleChart("chart-sector-radar", 60, (el) => {
    if (!window.Chart) return null;

    return new Chart(el, {
      type: "radar",
      data: {
        labels:   sectorData.map((s) => s.label),
        datasets: [
          {
            label:                "Your portfolio %",
            data:                 sectorData.map((s) => parseFloat(s.pct.toFixed(2))),
            borderColor:          "#d4a843",
            backgroundColor:      "rgba(212,168,67,.15)",
            borderWidth:          2,
            pointBackgroundColor: sectorData.map((s) => s.color),
            pointRadius:          4,
            pointHoverRadius:     6,
          },
          {
            label:                "Equal-weight benchmark",
            data:                 sectorData.map(() => parseFloat(equalWeight.toFixed(2))),
            borderColor:          "#58a6ff",
            backgroundColor:      "rgba(88,166,255,.05)",
            borderWidth:          1.5,
            borderDash:           [5, 4],
            pointBackgroundColor: "#58a6ff",
            pointRadius:          2,
            pointHoverRadius:     4,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display:  true,
            position: "top",
            labels: { color: "#7d8590", font: { size: 10 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`,
            },
            backgroundColor: "#1c2330",
            titleColor:      "#e6edf3",
            bodyColor:       "#7d8590",
            borderColor:     "#30363d",
            borderWidth:     1,
          },
        },
        scales: {
          r: {
            ticks: {
              font:          { size: 8 },
              color:         "#7d8590",
              backdropColor: "transparent",
              callback:      (v) => `${v}%`,
            },
            grid:        { color: "rgba(255,255,255,.08)" },
            angleLines:  { color: "rgba(255,255,255,.06)" },
            pointLabels: { color: "#7d8590", font: { size: 9 } },
          },
        },
      },
    });
  });
}
