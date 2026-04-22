// ── boot.js — Router + boot. MUST load last (all page functions must exist) ──
//
// CHANGES vs previous revision:
//  • boot() is now async — waits for PortFinDB.ready (IndexedDB open + migration),
//    loadDataFromStorage(), and initTheme() before rendering.
//  • The synchronous `const savedAt = loadDataFromStorage()` pattern replaced
//    with `const savedAt = await loadDataFromStorage()`.
//  • page-tools.js: saveDataToStorage / saveSnapshot are async; callers use
//    fire-and-forget (no await needed at call site unless ordering matters).

// ── Router ────────────────────────────────────────────────────
const PAGES = {
  overview:  { title: 'Portfolio Overview',            render: renderOverview   },
  mf:        { title: 'Mutual Funds',                  render: renderMF         },
  stocks:    { title: 'Equity Stocks',                 render: renderStocks     },
  analytics: { title: 'Analytics',                     render: renderAnalytics  },
  timeline:  { title: 'Investment Timeline',           render: renderTimeline   },
  goals:     { title: 'Goal Planner',                  render: renderGoalPlanner},
  rebalance: { title: 'Portfolio Rebalancing Advisor', render: renderRebalance  },
  waterfall: { title: 'Wealth Waterfall',              render: renderWaterfall  },
  signal:    { title: 'Portfolio Action Signal',       render: renderSignal     },
  snapshots: { title: 'Snapshot History',              render: renderSnapshots  },
  upload:    { title: 'Import Excel Data',             render: renderUpload     },
};

function switchPage(id) {
  if (!PAGES[id]) { console.warn('switchPage: unknown page id "' + id + '"'); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === id) n.classList.add('active');
  });
  document.getElementById('page-title').textContent = PAGES[id].title;
  PAGES[id].render();
}

// ── Async boot ────────────────────────────────────────────────
async function boot() {
  // 1. Wait for IndexedDB to be ready (includes localStorage migration)
  await PortFinDB.ready;

  // 2. Apply saved theme before any render to avoid flash
  await initTheme();

  // 3. Restore portfolio from IndexedDB (migrated from localStorage if needed)
  const savedAt = await loadDataFromStorage();
  if (savedAt) {
    showPersistBanner(savedAt);
  }

  // 4. Build UI chrome
  buildTicker();
  buildStrip();
  updateChrome();

  // 5. Render first page
  renderOverview();

  // 6. Wire upload listeners
  initUploadListeners();
}

// Kick off — any unhandled rejection will surface in the console
boot().catch(err => console.error('PortFin boot error:', err));
