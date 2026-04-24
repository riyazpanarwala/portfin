// ══════════════════════════════════════════════════════════════
// TICKER
// ══════════════════════════════════════════════════════════════
function buildTicker() {
    const inner = document.getElementById('ticker-inner');
    if (!inner) return;
    if (!DATA.stocks.length && !DATA.funds.length) {
        inner.innerHTML = Array(6).fill(
            '<span class="tick-item"><span class="tick-name">Upload your Excel files</span>' +
            '<span class="tick-price" style="color:var(--gold)">→ Import Excel tab</span></span>'
        ).join('');
        return;
    }
    const stItems = DATA.stocks.filter(s => s.Latest_Price > 0).map(s =>
        `<span class="tick-item"><span class="tick-name">${esc(s.name)}</span>` +
        `<span class="tick-price">₹${s.Latest_Price.toFixed(2)}</span>` +
        `<span class="tick-chg ${s.Gain >= 0 ? 'up' : 'dn'}">${fmtP(s.RetPct)}</span></span>`
    );
    const mfItems = DATA.funds.slice(0, 6).map(f =>
        `<span class="tick-item"><span class="tick-name">${esc(f.name).split(' ').slice(0, 2).join(' ')}</span>` +
        `<span class="tick-price">${fmtL(f.Current)}</span>` +
        `<span class="tick-chg ${f.Gain >= 0 ? 'up' : 'dn'}">${fmtP(f.RetPct)}</span></span>`
    );
    const all = [...stItems, ...mfItems].join('');
    inner.innerHTML = all + all;
}

function buildStrip() {
    const strip = document.getElementById('cat-strip');
    if (!strip) return;
    const tot = DATA.mfCategories.reduce((s, c) => s + c.Invested, 0);
    if (!tot) { strip.innerHTML = ''; return; }
    strip.innerHTML = DATA.mfCategories.map(c =>
        `<div style="background:${CAT_CLR[c.Category] || '#444'};flex:${(c.Invested / tot) * 100}"></div>`
    ).join('');
}

// ══════════════════════════════════════════════════════════════
// TOPBAR / SIDEBAR CHROME
// ══════════════════════════════════════════════════════════════
function updateChrome() {
    const k = DATA.kpis;
    const sbVal = document.getElementById('sb-total-val');
    const sbPnl = document.getElementById('sb-pnl');
    const sbCagr = document.getElementById('sb-cagr');
    const sbDate = document.getElementById('sb-date');
    if (sbVal) sbVal.textContent = k.totalValue ? fmtL(k.totalValue) : '—';
    if (sbPnl) {
        sbPnl.textContent = k.totalReturn ? pSign(k.totalReturn) + k.totalReturn.toFixed(2) + '%' : '—';
        sbPnl.style.color = k.totalGain >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (sbCagr) sbCagr.textContent = k.mfCAGR ? k.mfCAGR.toFixed(2) + '% p.a.' : '—';
    const dateStr = k.latestDate ? fmtDate(k.latestDate) : k.totalValue ? fmtDate(new Date()) : '—';
    if (sbDate) sbDate.textContent = dateStr;

    const mfCount = DATA.funds.length, stCount = DATA.stocks.length;
    const metaEl = document.getElementById('topbar-meta');
    if (metaEl && (mfCount || stCount)) {
        const since = k.earliestMF ? ' · Since ' + fmtMonthYear(k.earliestMF) : '';
        metaEl.textContent = `${mfCount} mutual funds · ${stCount} equity stocks${since}`;
    }

    const badges = [];
    if (k.mfReturn !== undefined && mfCount)
        badges.push(`<span class="badge ${k.mfReturn >= 0 ? 'badge-g' : 'badge-r'}">MF ${pSign(k.mfReturn)}${k.mfReturn.toFixed(2)}%</span>`);
    if (k.stReturn !== undefined && stCount)
        badges.push(`<span class="badge ${k.stReturn >= 0 ? 'badge-g' : 'badge-r'}">Stocks ${pSign(k.stReturn)}${k.stReturn.toFixed(2)}%</span>`);
    if (k.totalReturn !== undefined && (mfCount || stCount))
        badges.push(`<span class="badge badge-a">Combined ${pSign(k.totalReturn)}${k.totalReturn.toFixed(2)}%</span>`);
    const badgeEl = document.getElementById('topbar-badges');
    if (badgeEl) badgeEl.innerHTML = badges.join('');
}

// ══════════════════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════════════════
function exportCSV(type) {
    let rows = [], headers = [];
    if (type === 'mf') {
        if (!DATA.funds.length) { alert('No MF data to export. Upload a file first.'); return; }
        headers = ['Fund Name', 'Category', 'Lots', 'Invested (₹)', 'Current Value (₹)', 'Gain/Loss (₹)', 'Return (%)', 'CAGR (%)', 'Holding Days'];
        rows = DATA.funds.map(f => ['"' + f.name.replace(/"/g, '""') + '"', f.Category, f.Lots, f.Invested.toFixed(2), f.Current.toFixed(2), f.Gain.toFixed(2), f.RetPct.toFixed(2), f.CAGR.toFixed(2), f.holdDays || 0]);
    } else {
        if (!DATA.stocks.length) { alert('No stocks data to export. Upload a file first.'); return; }
        headers = ['Stock', 'Sector', 'Quantity', 'CMP (₹)', 'Invested (₹)', 'Market Value (₹)', 'P&L (₹)', 'Return (%)', 'CAGR (%)', 'Holding Days'];
        rows = DATA.stocks.map(s => ['"' + s.name.replace(/"/g, '""') + '"', s.Sector, s.Qty, s.Latest_Price.toFixed(2), s.Invested.toFixed(2), s.Current.toFixed(2), s.Gain.toFixed(2), s.RetPct.toFixed(2), s.CAGR.toFixed(2), s.holdDays || 0]);
    }
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url; a.download = (type === 'mf' ? 'mutual_funds' : 'stocks') + '_portfolio.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally {
        URL.revokeObjectURL(url);
    }
}
// ══════════════════════════════════════════════════════════════
// THEME — async read from IndexedDB
// ══════════════════════════════════════════════════════════════
async function initTheme() {
    const saved = await PortFinDB.get('portfin-theme');
    if (saved === 'light') {
        document.documentElement.classList.add('light');
        const b = document.getElementById('theme-toggle-btn');
        if (b) b.textContent = '🌙';
    }
}

function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = isLight ? '🌙' : '☀️';
    // fire-and-forget — no need to await
    PortFinDB.set('portfin-theme', isLight ? 'light' : 'dark');
}

// ══════════════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ══════════════════════════════════════════════════════════════
function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.toggle('open');
}
function closeSidebar() {
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
}
document.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', closeSidebar);
});

document.addEventListener('visibilitychange', () => {
    const el = document.getElementById('ticker-inner');
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
});