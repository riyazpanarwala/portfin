// ── common.js — shared data, formatters, helpers, router, boot ──────────────


// ══════════════════════════════════════════════════════════════
// DATA — seed / fallback; fully replaced when Excel uploaded
// ══════════════════════════════════════════════════════════════
const DATA = {
  kpis:{totalInvested:0,totalValue:0,totalGain:0,totalReturn:0,
        mfInvested:0,mfValue:0,mfGain:0,mfReturn:0,mfCAGR:0,
        stInvested:0,stValue:0,stGain:0,stReturn:0,
        earliestMF:'', earliestST:''},
  funds:[], mfCategories:[], stocks:[], sectors:[],
  monthlyMF:[],
  mfLots:[], stLots:[]   // raw lot arrays for XIRR
};
const fmtL = n => { const a=Math.abs(n),s=n<0?'−':''; return a>=1e7?s+'₹'+(a/1e7).toFixed(2)+' Cr':a>=1e5?s+'₹'+(a/1e5).toFixed(1)+' L':s+'₹'+Math.round(a).toLocaleString('en-IN'); };
const fmtN = n => n.toLocaleString('en-IN');
const fmtP = n => (n==null||isNaN(n)) ? '—' : (n>=0?'+':'')+n.toFixed(1)+'%';
const cls  = n => n>=0?'td-up':'td-dn';
const pSign= n => n>=0?'+':'';
// HTML escape — always use for user-supplied strings (fund names, stock names from Excel)
const esc  = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const CAT_CLR = {Value:'#d4a843','Large Cap':'#58a6ff','Mid Cap':'#3fb950','Small Cap':'#f0883e','Flexi Cap':'#a371f7',ELSS:'#e3b341',Index:'#79c0ff',Other:'#7d8590'};
const SEC_CLR = {Defence:'#58a6ff','Energy/PSU':'#3fb950',Speculative:'#f85149',Renewables:'#56d364','Finance/PSU':'#a371f7',FMCG:'#e3b341','Metals/Mining':'#d4a843',Banking:'#f0883e','Infra/PSU':'#79c0ff','Commodities ETF':'#7d8590','Index ETF':'#484f58',Other:'#7d8590'};
const gc = (k,m) => m[k]||'#7d8590';

function miniBar(pct, max) {
  const w = Math.min(100,max>0?Math.abs(pct)/max*100:0), up=pct>=0;
  return `<div class="bar-wrap"><div class="bar-track"><div class="bar-fill ${up?'up':'dn'}" style="width:${w}%"></div></div><span class="bar-pct ${up?'up':'dn'}">${fmtP(pct)}</span></div>`;
}
function riskBadge(s) {
  if(s.Sector==='Speculative'||s.RetPct<-30) return '<span class="pill pill-h">HIGH RISK</span>';
  if(s.RetPct<-10) return '<span class="pill pill-m">WATCH</span>';
  return '<span class="pill pill-l">SAFE</span>';
}
function donut(svgId, legId, data, colorMap) {
  const svg=document.getElementById(svgId), leg=document.getElementById(legId);
  if(!svg||!leg) return;
  const total=data.reduce((s,d)=>s+d.v,0); if(!total) return;
  let angle=-90; const cx=55,cy=55,r=42; let paths='';
  data.forEach(d=>{
    const pct=d.v/total,a1=angle,a2=angle+pct*360; angle=a2;
    const tr=deg=>deg*Math.PI/180;
    const x1=cx+r*Math.cos(tr(a1)),y1=cy+r*Math.sin(tr(a1));
    const x2=cx+r*Math.cos(tr(a2)),y2=cy+r*Math.sin(tr(a2));
    const lg=a2-a1>180?1:0;
    paths+=`<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${gc(d.k,colorMap)}" opacity=".9"/>`;
  });
  paths+=`<circle cx="${cx}" cy="${cy}" r="26" fill="var(--bg2)"/>`;
  svg.innerHTML=paths;
  leg.innerHTML=data.map(d=>`<div class="legend-row"><div class="legend-dot" style="background:${gc(d.k,colorMap)}"></div><span class="legend-name">${d.k}</span><span class="legend-pct">${Math.round(d.v/total*100)}%</span></div>`).join('');
}
function fmtDate(d){ return d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'; }
function fmtMonthYear(d){ return d?new Date(d).toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'—'; }

// ── XIRR via Newton-Raphson ───────────────────────────────────
function calcXIRR(cashflows, dates) {
  // cashflows: array of numbers (negative=outflow, positive=inflow)
  // dates: array of Date objects, same length
  if(!cashflows.length) return null;
  const base = dates[0];
  const t = dates.map(d=>(d-base)/(365.25*24*3600*1000));
  let r = 0.1;
  for(let iter=0;iter<100;iter++){
    let f=0,df=0;
    for(let i=0;i<cashflows.length;i++){
      const v=cashflows[i]*Math.pow(1+r,-t[i]);
      f+=v; df+=(-t[i])*cashflows[i]*Math.pow(1+r,-t[i]-1);
    }
    if(Math.abs(df)<1e-12) break;
    const rn=r-f/df;
    if(Math.abs(rn-r)<1e-8){r=rn;break;}
    r=rn;
    if(r<-0.9) r=-0.5;
  }
  return isFinite(r)?parseFloat((r*100).toFixed(1)):null;
}

// ── State ─────────────────────────────────────────────────────
let mfSort='RetPct',mfAsc=false,mfFil='All';
let stSort='RetPct',stAsc=false,stFil='All';
let chartInst=null;
// Cache for buildFundAnalysis() — invalidated when DATA changes, avoids recompute on every period toggle
let _fundAnalysisCache=null;

// ── Ticker ────────────────────────────────────────────────────
function buildTicker() {
  if(!DATA.stocks.length && !DATA.funds.length){
    document.getElementById('ticker-inner').innerHTML=
      '<span class="tick-item"><span class="tick-name">Upload your Excel files</span><span class="tick-price" style="color:var(--gold)">→ Import Excel tab</span></span>'.repeat(6);
    return;
  }
  const stItems=DATA.stocks.filter(s=>s.Latest_Price>0).map(s=>
    `<span class="tick-item"><span class="tick-name">${esc(s.name)}</span><span class="tick-price">₹${s.Latest_Price.toLocaleString('en-IN')}</span><span class="tick-chg ${s.Gain>=0?'up':'dn'}">${fmtP(s.RetPct)}</span></span>`);
  const mfItems=DATA.funds.slice(0,6).map(f=>
    `<span class="tick-item"><span class="tick-name">${esc(f.name).split(' ').slice(0,2).join(' ')}</span><span class="tick-price">${fmtL(f.Current)}</span><span class="tick-chg ${f.Gain>=0?'up':'dn'}">${fmtP(f.RetPct)}</span></span>`);
  const all=[...stItems,...mfItems].join('');
  document.getElementById('ticker-inner').innerHTML=all+all;
}

function buildStrip() {
  const tot=DATA.mfCategories.reduce((s,c)=>s+c.Invested,0);
  if(!tot){document.getElementById('cat-strip').innerHTML='';return;}
  document.getElementById('cat-strip').innerHTML=DATA.mfCategories.map(c=>
    `<div style="background:${CAT_CLR[c.Category]||'#444'};flex:${c.Invested/tot*100}"></div>`).join('');
}

// ── Update topbar + sidebar ───────────────────────────────────
function updateChrome() {
  const k=DATA.kpis;
  // Sidebar
  document.getElementById('sb-total-val').textContent = k.totalValue?fmtL(k.totalValue):'—';
  const pnlEl=document.getElementById('sb-pnl');
  pnlEl.textContent = k.totalReturn?(pSign(k.totalReturn)+k.totalReturn.toFixed(1)+'%'):'—';
  pnlEl.style.color = k.totalGain>=0?'var(--green)':'var(--red)';
  document.getElementById('sb-cagr').textContent = k.mfCAGR?(k.mfCAGR.toFixed(1)+'% p.a.'):'—';
  // Date: latest across both files
  const dateStr = k.latestDate ? fmtDate(k.latestDate) : (k.totalValue?fmtDate(new Date()):'—');
  document.getElementById('sb-date').textContent = dateStr;

  // Topbar meta
  const mfCount=DATA.funds.length, stCount=DATA.stocks.length;
  if(mfCount||stCount){
    const since = k.earliestMF?(' · Since '+fmtMonthYear(k.earliestMF)):'';
    document.getElementById('topbar-meta').textContent =
      `${mfCount} mutual funds · ${stCount} equity stocks${since}`;
  }

  // Topbar badges
  const badges=[];
  if(k.mfReturn!==undefined&&mfCount){
    const bc=k.mfReturn>=0?'badge-g':'badge-r';
    badges.push(`<span class="badge ${bc}">MF ${pSign(k.mfReturn)}${k.mfReturn.toFixed(1)}%</span>`);
  }
  if(k.stReturn!==undefined&&stCount){
    const bc=k.stReturn>=0?'badge-g':'badge-r';
    badges.push(`<span class="badge ${bc}">Stocks ${pSign(k.stReturn)}${k.stReturn.toFixed(1)}%</span>`);
  }
  if(k.totalReturn!==undefined&&(mfCount||stCount)){
    badges.push(`<span class="badge badge-a">Combined ${pSign(k.totalReturn)}${k.totalReturn.toFixed(1)}%</span>`);
  }
  document.getElementById('topbar-badges').innerHTML=badges.join('');
}


// ── Shared helpers: holding period, drill HTML ──────────────────────────────
// ── Helpers: holding period & drill HTML ──────────────────────
function fmtHoldPeriod(days){
  if(!days||days<=0) return '—';
  const y=Math.floor(days/365), m=Math.floor((days%365)/30);
  if(y>0&&m>0) return `${y}y ${m}m`;
  if(y>0) return `${y}y`;
  if(m>0) return `${m}m`;
  return `${days}d`;
}

function buildMFDrillHTML(f){
  if(!f.rawLots||!f.rawLots.length) return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';
  const lots=[...f.rawLots].sort((a,b)=>a.date-b.date);
  const rows=lots.map(l=>{
    const days=Math.floor((Date.now()-l.date.getTime())/(24*3600*1000));
    const holdStr=fmtHoldPeriod(days);
    const taxTag=days>=365?'<span class="ltcg-badge">LTCG</span>':'<span class="stcg-badge">STCG</span>';
    const lotGainPct=l.amt>0?((l.gain/l.amt)*100).toFixed(1):0;
    const lotCls=l.gain>=0?'td-up':'td-dn';
    return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td>${l.invPrice>0?'₹'+l.invPrice.toFixed(3):'—'}</td>
      <td>${l.qty>0?l.qty.toFixed(3):'—'}</td>
      <td>${fmtL(l.amt)}</td>
      <td class="${lotCls}">${fmtL(l.gain)}</td>
      <td class="${lotCls}">${l.amt>0?(l.gain>=0?'+':'')+lotGainPct+'%':'—'}</td>
      <td>${holdStr}</td>
      <td>${taxTag}</td>
    </tr>`;
  }).join('');
  return `<table class="drill-table">
    <thead><tr>
      <th>Buy Date</th><th>Buy NAV</th><th>Units</th><th>Invested</th>
      <th>Gain/Loss</th><th>Return</th><th>Holding</th><th>Tax</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildSTDrillHTML(s){
  if(!s.rawLots||!s.rawLots.length) return '<div style="color:var(--muted);font-size:11px;padding:6px">No lot-level data available</div>';
  const lots=[...s.rawLots].sort((a,b)=>a.date-b.date);
  const cmp=s.Latest_Price||0;
  const rows=lots.map(l=>{
    const days=Math.floor((Date.now()-l.date.getTime())/(24*3600*1000));
    const holdStr=fmtHoldPeriod(days);
    const taxTag=days>=365?'<span class="ltcg-badge">LTCG</span>':'<span class="stcg-badge">STCG</span>';
    const curVal=cmp>0&&l.qty>0?cmp*l.qty:l.cur||l.inv+l.gain;
    const lotGain=curVal-l.inv;
    const lotPct=l.inv>0?((lotGain/l.inv)*100).toFixed(1):0;
    const lotCls=lotGain>=0?'td-up':'td-dn';
    return `<tr>
      <td>${fmtDate(l.date)}</td>
      <td>${l.qty>0?fmtN(l.qty):'—'}</td>
      <td>${l.invPrice>0?'₹'+l.invPrice.toFixed(2):'—'}</td>
      <td>${cmp>0?'₹'+cmp.toLocaleString('en-IN'):'—'}</td>
      <td>${fmtL(l.inv)}</td>
      <td style="font-weight:500">${fmtL(curVal)}</td>
      <td class="${lotCls}">${fmtL(lotGain)}</td>
      <td class="${lotCls}">${l.inv>0?(lotGain>=0?'+':'')+lotPct+'%':'—'}</td>
      <td>${holdStr}</td>
      <td>${taxTag}</td>
    </tr>`;
  }).join('');
  return `<table class="drill-table">
    <thead><tr>
      <th>Buy Date</th><th>Qty</th><th>Buy Price</th><th>CMP</th>
      <th>Invested</th><th>Cur. Value</th><th>P&amp;L</th><th>Return</th><th>Holding</th><th>Tax</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

const drillState={};
function toggleDrill(type,i){
  const rowId=`drill-${type}-${i}`;
  const btnId=`drill-btn-${type}-${i}`;
  const row=document.getElementById(rowId);
  const btn=document.getElementById(btnId);
  if(!row) return;
  const open=row.style.display==='none';
  row.style.display=open?'table-row':'none';
  if(btn) btn.textContent=open?'▼':'▶';
}

// ── Health Score ──────────────────────────────────────────────

// ── Theme & sidebar ─────────────────────────────────────────────────────────
// ── Theme toggle ──────────────────────────────────────────────
function toggleTheme(){
  const isLight=document.documentElement.classList.toggle('light');
  document.getElementById('theme-toggle-btn').textContent=isLight?'🌙':'☀️';
  localStorage.setItem('portfin-theme',isLight?'light':'dark');
}
(function initTheme(){
  const saved=localStorage.getItem('portfin-theme');
  if(saved==='light'){document.documentElement.classList.add('light');const b=document.getElementById('theme-toggle-btn');if(b)b.textContent='🌙';}
})();

// ── Mobile sidebar ────────────────────────────────────────────
function toggleSidebar(){
  const sb=document.querySelector('.sidebar');
  const ov=document.getElementById('sidebar-overlay');
  sb.classList.toggle('mobile-open');
  ov.classList.toggle('open');
}
function closeSidebar(){
  document.querySelector('.sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
// Close sidebar on nav item click (mobile)
document.querySelectorAll('.nav-item').forEach(n=>{
  const orig=n.getAttribute('onclick')||'';
  n.setAttribute('onclick', orig+';closeSidebar()');
});


// ── Export CSV ──────────────────────────────────────────────────────────────
// ── Export CSV ────────────────────────────────────────────────
function exportCSV(type){
  let rows=[], headers=[];
  if(type==='mf'){
    if(!DATA.funds.length){alert('No MF data to export. Upload a file first.');return;}
    headers=['Fund Name','Category','Lots','Invested (₹)','Current Value (₹)','Gain/Loss (₹)','Return (%)','CAGR (%)','Holding Days'];
    rows=DATA.funds.map(f=>[
      '"'+f.name.replace(/"/g,'""')+'"', f.Category, f.Lots,
      Math.round(f.Invested), Math.round(f.Current), f.Gain,
      f.RetPct, f.CAGR, f.holdDays||0
    ]);
  } else {
    if(!DATA.stocks.length){alert('No stocks data to export. Upload a file first.');return;}
    headers=['Stock','Sector','Quantity','CMP (₹)','Invested (₹)','Market Value (₹)','P&L (₹)','Return (%)','CAGR (%)','Holding Days'];
    rows=DATA.stocks.map(s=>[
      '"'+s.name.replace(/"/g,'""')+'"', s.Sector, s.Qty,
      s.Latest_Price, Math.round(s.Invested), Math.round(s.Current),
      s.Gain, s.RetPct, s.CAGR, s.holdDays||0
    ]);
  }
  const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=(type==='mf'?'mutual_funds':'stocks')+'_portfolio.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
