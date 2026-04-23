// ── page-tools.js — Rebalancer, Wealth Waterfall, Action Signal, Upload ─────
//
// FIXES in this revision:
//  • Issue #3  — tryApplyData() clears DATA._cachedDrawdownSeries on upload
//  • Issue #5  — computeCAGR() returns annualised figure for <6mo holdings
//                with a flag; fmtCAGRDisplay() renders it with "~" prefix
//  • Issue #6  — SECTOR_MAP patterns now use word-boundary anchors to prevent
//                partial name matches (e.g. "adani" no longer matches everything)
//  • Issue #7  — _fundAnalysisCache is NOT cleared on period filter change
//                since per-fund analysis uses actual hold days, not bmPeriod
//  • Issue #9  — DATA.kpis.latestDate set to the actual latest lot date
//                instead of always new Date()
//  • Issue #13 — wfShowTip / wfHideTip use module-level _wfSegments/_wfTotal
//                (defined in common.js) instead of window.*

// ── Upload page ───────────────────────────────────────────────
let pendingMF = null,
  pendingST = null;

function renderUpload() {
  const list = document.getElementById("steps-list");
  if (!list) return;
  list.innerHTML = "";
  const steps = [
    [
      "1",
      "Export your Mutual Fund portfolio from your broker (Zerodha Kite, ET Money, Groww, etc.) as .xls or .xlsx",
    ],
    [
      "2",
      "Export your Equity Stocks portfolio the same way as a separate file",
    ],
    ["3", "Drop both files below — MF file first, then Stocks file"],
    [
      "4",
      "The entire dashboard updates instantly — no Python, no server, no extra tools",
    ],
    ["∞", "Repeat monthly for always-current portfolio tracking"],
  ];
  steps.forEach(([n, t]) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;gap:12px;margin-bottom:10px;align-items:flex-start";
    const num = document.createElement("div");
    num.style.cssText =
      "width:22px;height:22px;border-radius:50%;background:var(--bg4);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--gold);flex-shrink:0;margin-top:1px";
    num.textContent = n;
    const txt = document.createElement("div");
    txt.style.cssText = "font-size:12px;color:var(--muted);line-height:1.6";
    txt.textContent = t;
    row.append(num, txt);
    list.appendChild(row);
  });
}

function initUploadListeners() {
  _bindDropZone("drop-zone-mf", "file-input-mf", "mf");
  _bindDropZone("drop-zone-st", "file-input-st", "st");
}

function _bindDropZone(zoneId, inputId, type) {
  const dz = document.getElementById(zoneId);
  const fi = document.getElementById(inputId);
  if (!dz || !fi) return;
  dz.addEventListener("click", () => fi.click());
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.style.borderColor = "var(--gold)";
    dz.style.color = "var(--gold)";
  });
  dz.addEventListener("dragleave", () => {
    dz.style.borderColor = "";
    dz.style.color = "";
  });
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.style.borderColor = "";
    handleExcel(e.dataTransfer.files[0], type);
  });
  fi.addEventListener("change", (e) => handleExcel(e.target.files[0], type));
}