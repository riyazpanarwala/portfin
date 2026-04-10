// ── boot.js — Router + boot. MUST load last (all page functions must exist) ──
//
// PAGES registry references render functions from every page-*.js module.
// initUploadListeners() is in page-tools.js.
// This file must be the final <script> tag in index.html.

// ── Router (updated) ──────────────────────────────────────────
const PAGES={
  overview:  {title:'Portfolio Overview',           render:renderOverview},
  mf:        {title:'Mutual Funds',                 render:renderMF},
  stocks:    {title:'Equity Stocks',                render:renderStocks},
  analytics: {title:'Analytics',                    render:renderAnalytics},
  timeline:  {title:'Investment Timeline',          render:renderTimeline},
  goals:     {title:'Goal Planner',                 render:renderGoalPlanner},
  rebalance: {title:'Portfolio Rebalancing Advisor',render:renderRebalance},
  waterfall: {title:'Wealth Waterfall',             render:renderWaterfall},
  signal:    {title:'Portfolio Action Signal',      render:renderSignal},
  snapshots: {title:'Snapshot History',             render:renderSnapshots},
  upload:    {title:'Import Excel Data',            render:renderUpload},
};
function switchPage(id){
  if(!PAGES[id]) { console.warn('switchPage: unknown page id "'+id+'"'); return; }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('page-'+id); if(pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{ if(n.dataset.page===id) n.classList.add('active'); });
  document.getElementById('page-title').textContent=PAGES[id].title;
  PAGES[id].render();
}

// ── Boot ──────────────────────────────────────────────────────
// Try to restore portfolio from localStorage before first render
const savedAt = loadDataFromStorage();
if (savedAt) {
  showPersistBanner(savedAt);
}

buildTicker();
buildStrip();
updateChrome();
renderOverview();
initUploadListeners();
