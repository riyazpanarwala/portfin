// ── page-snapshots.js — Portfolio Snapshot History ──────────────────────────

// FIX: chart timer managed by scheduleChart() in common.js

function renderSnapshots() {
  const el = document.getElementById("page-snapshots");
  if (!el) return;

  const snapshots = getSnapshots();
  const container = document.getElementById("snapshots-content");
  if (!container) return;

  if (!snapshots.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--muted)">
        <div style="font-size:32px;margin-bottom:12px">📸</div>
        <div style="font-size:14px;font-weight:500;margin-bottom:8px">No snapshots yet</div>
        <div style="font-size:12px;line-height:1.7">Upload your MF and Stocks files to start tracking.<br>A snapshot is saved automatically on each upload.</div>
      </div>`;
    return;
  }

  // Sort oldest → newest for chart
  const sorted = [...snapshots].sort((a, b) => {
    // Support both old monthKey and new weekKey
    const ka = a.weekKey || a.monthKey || "";
    const kb = b.weekKey || b.monthKey || "";
    return ka.localeCompare(kb);
  });
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  // ── WoW delta helpers ────────────────────────────────────────
  const delta = (curr, prevVal) => {
    if (!prev || prevVal === undefined) return null;
    return curr - prevVal;
  };
  const deltaPct = (curr, prevVal) => {
    if (!prev || !prevVal) return null;
    return ((curr - prevVal) / Math.abs(prevVal)) * 100;
  };

  const valDelta = delta(latest.totalValue, prev?.totalValue);
  const gainDelta = delta(latest.totalGain, prev?.totalGain);
  const cagrDelta = delta(latest.mfCAGR, prev?.mfCAGR);
  const invDelta = delta(latest.totalInvested, prev?.totalInvested);

  // ── KPI strip ────────────────────────────────────────────────
  const wowTag = (d) => {
    if (d === null)
      return '<span style="font-size:10px;color:var(--muted)">No prev</span>';
    const sign = d >= 0 ? "+" : "";
    const color = d >= 0 ? "var(--green)" : "var(--red)";
    return `<span style="font-size:10px;color:${color}">${sign}${fmtL(d)} WoW</span>`;
  };
  const wowTagPct = (d) => {
    if (d === null) return "";
    const sign = d >= 0 ? "+" : "";
    const color = d >= 0 ? "var(--green)" : "var(--red)";
    return `<span style="font-size:10px;color:${color}">${sign}${d.toFixed(2)}pp WoW</span>`;
  };

  const kpiData = [
    {
      l: "Portfolio value",
      v: fmtL(latest.totalValue),
      s: wowTag(valDelta),
      a: "#d4a843",
    },
    {
      l: "Total invested",
      v: fmtL(latest.totalInvested),
      s: wowTag(invDelta),
      a: "#58a6ff",
    },
    {
      l: "Total gain",
      v: fmtL(latest.totalGain),
      s: wowTag(gainDelta),
      a: latest.totalGain >= 0 ? "#3fb950" : "#f85149",
    },
    {
      l: "MF CAGR",
      v: fmtP(latest.mfCAGR),
      s: wowTagPct(cagrDelta),
      a: "#a371f7",
    },
    {
      l: "Snapshots saved",
      v: snapshots.length,
      s: `Since ${sorted[0].label || sorted[0].shortLabel}`,
      a: "#7d8590",
    },
    {
      l: "Last updated",
      v: latest.shortLabel || latest.label,
      s: new Date(latest.savedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      a: "#f0c060",
    },
  ];

  const kpiHTML = renderKpiCards(kpiData);

  // ── Chart labels: use shortLabel (W18 '25) for compactness ───
  const labels = sorted.map((s) => s.shortLabel || s.label);

  // ── Snapshot table (newest first) ────────────────────────────
  const tableRows = [...sorted]
    .reverse()
    .map((snap, i) => {
      const prevSnap = [...sorted].reverse()[i + 1];
      const vDelta = prevSnap ? snap.totalValue - prevSnap.totalValue : null;
      const rDelta =
        prevSnap && prevSnap.totalInvested
          ? (snap.totalGain / snap.totalInvested -
              prevSnap.totalGain / prevSnap.totalInvested) *
            100
          : null;
      const isLatest =
        (snap.weekKey || snap.monthKey) === (latest.weekKey || latest.monthKey);
      return `<tr style="${isLatest ? "background:var(--bg3)" : ""}">
      <td style="font-weight:${isLatest ? "600" : "400"};white-space:nowrap">
        ${snap.label || snap.shortLabel}
        ${isLatest ? '<span style="font-size:9px;background:var(--gold);color:#0d1117;padding:1px 5px;border-radius:3px;margin-left:4px">LATEST</span>' : ""}
      </td>
      <td style="font-weight:500;color:var(--gold)">${fmtL(snap.totalValue)}</td>
      <td style="color:var(--muted)">${fmtL(snap.totalInvested)}</td>
      <td class="${snap.totalGain >= 0 ? "td-up" : "td-dn"}">${fmtL(snap.totalGain)}</td>
      <td class="${snap.totalReturn >= 0 ? "td-up" : "td-dn"}">${fmtP(snap.totalReturn)}</td>
      <td style="color:#a371f7">${fmtP(snap.mfCAGR)}</td>
      <td>${
        vDelta !== null
          ? `<span style="color:${vDelta >= 0 ? "var(--green)" : "var(--red)"};font-size:11px">${vDelta >= 0 ? "+" : ""}${fmtL(vDelta)}</span>`
          : '<span style="color:var(--muted)">—</span>'
      }</td>
      <td class="td-muted">${snap.fundCount || "—"} / ${snap.stockCount || "—"}</td>
    </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="kpi-grid" id="snap-kpis" style="margin-bottom:20px">${kpiHTML}</div>

    <div class="grid2" style="margin-bottom:20px">
      <div class="card">
        <div class="sec-head"><div class="sec-title">Portfolio value over time</div></div>
        <div class="chart-box" style="height:200px"><canvas id="snap-chart-value"></canvas></div>
      </div>
      <div class="card">
        <div class="sec-head"><div class="sec-title">MF CAGR trend</div></div>
        <div class="chart-box" style="height:200px"><canvas id="snap-chart-cagr"></canvas></div>
      </div>
    </div>

    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Week</th><th>Portfolio value</th><th>Invested</th>
            <th>Total gain</th><th>Return %</th><th>MF CAGR</th>
            <th>WoW change</th><th>MF / Stocks</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <div style="margin-top:12px;display:flex;justify-content:flex-end">
      <button class="export-btn" onclick="exportSnapshotsCSV()" style="margin-right:8px">⬇ Export CSV</button>
      <button onclick="if(confirm('Delete all snapshot history?')){clearSnapshots();renderSnapshots();}" style="background:var(--red-bg);border:1px solid var(--red-dim);border-radius:5px;color:var(--red);font-size:11px;padding:6px 14px;cursor:pointer">🗑 Clear history</button>
    </div>
  `;

  // ── Trend charts ─────────────────────────────────────────────
  scheduleChart("snap-chart-value", 60, (el) => {
    return new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Portfolio Value",
            data: sorted.map((s) => s.totalValue),
            borderColor: "#d4a843",
            backgroundColor: "rgba(212,168,67,.08)",
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3,
          },
          {
            label: "Total Invested",
            data: sorted.map((s) => s.totalInvested),
            borderColor: "#58a6ff",
            backgroundColor: "transparent",
            borderWidth: 1.5,
            pointRadius: 2,
            borderDash: [4, 3],
            tension: 0.3,
          },
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
              font: { size: 10 },
              boxWidth: 12,
              padding: 10,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + fmtL(ctx.raw),
            },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              maxRotation: 60,
              autoSkip: true,
              maxTicksLimit: 16,
            },
            grid: { color: "#21262d" },
          },
          y: {
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              callback: (v) => fmtL(v),
            },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });

  scheduleChart("snap-chart-cagr", 60, (el) => {
    return new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "MF CAGR %",
            data: sorted.map((s) => s.mfCAGR),
            borderColor: "#a371f7",
            backgroundColor: "rgba(163,113,247,.08)",
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + fmtP(ctx.raw),
            },
            backgroundColor: "#1c2330",
            titleColor: "#e6edf3",
            bodyColor: "#7d8590",
            borderColor: "#30363d",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              maxRotation: 60,
              autoSkip: true,
              maxTicksLimit: 16,
            },
            grid: { color: "#21262d" },
          },
          y: {
            ticks: {
              font: { size: 9 },
              color: "#7d8590",
              callback: (v) => v.toFixed(1) + "%",
            },
            grid: { color: "#21262d" },
          },
        },
      },
    });
  });
}

function exportSnapshotsCSV() {
  const snapshots = getSnapshots();
  if (!snapshots.length) {
    alert("No snapshots to export.");
    return;
  }
  const headers = [
    "Week",
    "Week Key",
    "Total Value",
    "Total Invested",
    "Total Gain",
    "Return %",
    "MF CAGR %",
    "MF Invested",
    "Stock Invested",
    "Funds",
    "Stocks",
    "Saved At",
  ];
  const rows = snapshots.map((s) => [
    '"' + (s.label || s.shortLabel || "").replace(/"/g, '""') + '"',
    s.weekKey || s.monthKey || "",
    Math.round(s.totalValue),
    Math.round(s.totalInvested),
    Math.round(s.totalGain),
    s.totalReturn?.toFixed(1) || "",
    s.mfCAGR?.toFixed(1) || "",
    Math.round(s.mfInvested || 0),
    Math.round(s.stInvested || 0),
    s.fundCount || "",
    s.stockCount || "",
    s.savedAt || "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfin_snapshot_history.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
