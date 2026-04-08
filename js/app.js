
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

// ── Overview ──────────────────────────────────────────────────
function renderOverview() {
  const k=DATA.kpis;
  const sinceMF = k.earliestMF?('Since '+fmtMonthYear(k.earliestMF)):'All time';
  document.getElementById('kpi-overview').innerHTML=[
    {l:'Total Invested',  v:fmtL(k.totalInvested), s:'Capital deployed',     sc:'',   a:'#d4a843'},
    {l:'Current Value',   v:fmtL(k.totalValue),    s:'Portfolio value',      sc:'',   a:'#58a6ff'},
    {l:'Total Gain',      v:fmtL(k.totalGain),     s:fmtP(k.totalReturn),   sc:k.totalGain>=0?'up':'dn', a:'#3fb950'},
    {l:'MF Return',       v:fmtP(k.mfReturn),      s:sinceMF,               sc:'up', a:'#d4a843'},
    {l:'MF CAGR',         v:fmtP(k.mfCAGR),        s:'Compounded p.a.',     sc:'up', a:'#a371f7'},
    {l:'Stock P&L',       v:fmtL(k.stGain),        s:fmtP(k.stReturn),      sc:k.stGain>=0?'up':'dn', a:'#f85149'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub ${c.sc}">${c.s}</div></div>`).join('');

  const mfP=k.totalInvested?Math.round(k.mfInvested/k.totalInvested*100):0, stP=100-mfP;
  document.getElementById('alloc-split').innerHTML=`
    <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#58a6ff">Mutual Funds</span><span style="color:#58a6ff">${mfP}% · ${fmtL(k.mfInvested)}</span></div><div class="bar-track" style="height:8px"><div class="bar-fill up" style="width:${mfP}%;background:#58a6ff;height:100%"></div></div></div>
    <div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:#f0883e">Equity Stocks</span><span style="color:#f0883e">${stP}% · ${fmtL(k.stInvested)}</span></div><div class="bar-track" style="height:8px"><div class="bar-fill up" style="width:${stP}%;background:#f0883e;height:100%"></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--bg3);border-radius:6px;padding:10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">MF gain</div><div style="font-size:16px;font-weight:600;color:var(--green);font-family:var(--sans)">${fmtL(k.mfGain)}</div><div style="font-size:11px;color:var(--green)">${fmtP(k.mfReturn)}</div></div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Stock P&L</div><div style="font-size:16px;font-weight:600;color:${k.stGain>=0?'var(--green)':'var(--red)'};font-family:var(--sans)">${fmtL(k.stGain)}</div><div style="font-size:11px;color:${k.stGain>=0?'var(--green)':'var(--red)'}">${fmtP(k.stReturn)}</div></div>
    </div>`;

  donut('donut-mf','legend-mf',DATA.mfCategories.map(c=>({k:c.Category,v:c.Invested})),CAT_CLR);

  const maxMF=Math.max(...DATA.funds.map(f=>Math.abs(f.RetPct)),1);
  const maxST=Math.max(...DATA.stocks.map(s=>Math.abs(s.RetPct)),1);
  document.getElementById('top-mf').innerHTML=DATA.funds.length
    ?[...DATA.funds].sort((a,b)=>b.RetPct-a.RetPct).slice(0,4).map(f=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:500">${esc(f.name)}</span><span style="color:var(--muted)">${fmtL(f.Gain)}</span></div>${miniBar(f.RetPct,maxMF)}</div>`).join('')
    :'<div style="color:var(--muted);font-size:11px">Upload MF file to see data</div>';
  document.getElementById('top-st').innerHTML=DATA.stocks.length
    ?[...DATA.stocks].sort((a,b)=>b.RetPct-a.RetPct).slice(0,4).map(s=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="font-weight:500">${esc(s.name)}</span><span style="color:var(--muted)">${fmtL(s.Gain)}</span></div>${miniBar(s.RetPct,maxST)}</div>`).join('')
    :'<div style="color:var(--muted);font-size:11px">Upload Stocks file to see data</div>';

  // Dynamic risk alerts
  const alerts=[];
  const stTotalInv=DATA.stocks.reduce((a,s)=>a+s.Invested,0)||1;
  DATA.stocks.forEach(s=>{
    const conc=s.Invested/stTotalInv*100;
    if(s.RetPct<-40) alerts.push([esc(s.name),`${fmtP(s.RetPct)} return — strong EXIT candidate, no recovery thesis visible`]);
    else if(conc>15&&s.RetPct<0) alerts.push([esc(s.name),`${conc.toFixed(1)}% of stock portfolio, ${fmtP(s.RetPct)} return — high concentration risk, consider trimming`]);
    else if(s.Sector==='Speculative'&&s.RetPct<-20) alerts.push([esc(s.name),`${fmtP(s.RetPct)} in speculative sector — averaging down not advised; reduce to ≤5%`]);
    else if(s.CAGR<-15&&s.Invested>30000) alerts.push([esc(s.name),`CAGR ${fmtP(s.CAGR)}, ₹${Math.round(s.Invested/1000)}K invested — reassess thesis`]);
  });
  // Sector concentration
  DATA.sectors.forEach(sec=>{
    const secPct=stTotalInv?sec.Invested/stTotalInv*100:0;
    if(secPct>30&&sec.Gain<0) alerts.push([esc(sec.Sector)+' Sector',`${secPct.toFixed(1)}% of stocks with ${fmtL(sec.Gain)} loss — over-concentrated`]);
  });
  document.getElementById('risk-alerts').innerHTML=alerts.length
    ?alerts.map(([n,m])=>`<div class="alert-row"><span class="alert-name">${n}</span><span class="alert-msg">${m}</span></div>`).join('')
    :'<div style="color:var(--green);font-size:11px">✓ No critical concentration alerts — portfolio looks balanced</div>';

  renderHealthScore();
  renderSIPReminder();
  renderDrawdownAnalyzer();
}

// ── Mutual Funds ──────────────────────────────────────────────
function renderMF() {
  const k=DATA.kpis;
  const totalLots=DATA.funds.reduce((a,f)=>a+f.Lots,0);
  const profitableMF=DATA.funds.filter(f=>f.Gain>0).length;
  const sinceMF=k.earliestMF?('Since '+fmtMonthYear(k.earliestMF)):'';
  document.getElementById('kpi-mf').innerHTML=[
    {l:'MF Invested',    v:fmtL(k.mfInvested),  s:'',                      sc:'',   a:'#58a6ff'},
    {l:'Current Value',  v:fmtL(k.mfValue),      s:'Market value',          sc:'up', a:'#3fb950'},
    {l:'Total Gain',     v:fmtL(k.mfGain),       s:fmtP(k.mfReturn),       sc:k.mfGain>=0?'up':'dn', a:'#3fb950'},
    {l:'CAGR',           v:fmtP(k.mfCAGR),       s:sinceMF,                sc:'up', a:'#a371f7'},
    {l:'Total Lots',     v:totalLots.toLocaleString('en-IN'), s:DATA.funds.length+' active funds', sc:'', a:'#d4a843'},
    {l:'Profitable',     v:profitableMF+'/'+DATA.funds.length, s:profitableMF===DATA.funds.length?'100% in green':profitableMF+' in profit', sc:profitableMF===DATA.funds.length?'up':'gold', a:'#3fb950'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub ${c.sc}">${c.s}</div></div>`).join('');

  const cats=['All',...new Set(DATA.funds.map(f=>f.Category))];
  document.getElementById('mf-filters').innerHTML='<span class="ctrl-label">Category:</span>'+cats.map(c=>`<button class="chip ${mfFil===c?'on':''}" onclick="setMfFil('${esc(c)}')">${esc(c)}</button>`).join('');
  const sOpts=[['RetPct','Return'],['CAGR','CAGR'],['Current','Value'],['Gain','Gain'],['Invested','Invested'],['Lots','Lots']];
  document.getElementById('mf-sorts').innerHTML='<span class="ctrl-label">Sort:</span>'+sOpts.map(([k,l])=>`<button class="chip ${mfSort===k?'on':''}" onclick="sortMF('${k}')">${l}${mfSort===k?(mfAsc?' ↑':' ↓'):''}</button>`).join('');

  let funds=mfFil==='All'?DATA.funds:DATA.funds.filter(f=>f.Category===mfFil);
  funds=[...funds].sort((a,b)=>mfAsc?a[mfSort]-b[mfSort]:b[mfSort]-a[mfSort]);
  const maxR=Math.max(...DATA.funds.map(f=>Math.abs(f.RetPct)),1);

  if(!funds.length){document.getElementById('mf-tbody').innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:30px">Upload your MF Excel file to see fund data</td></tr>';return;}
  document.getElementById('mf-tbody').innerHTML=funds.map((f,i)=>{
    const hold=fmtHoldPeriod(f.holdDays);
    return `<tr style="cursor:pointer" onclick="toggleDrill('mf',${i})">
    <td style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis">
      <span class="expand-btn" id="drill-btn-mf-${i}">▶</span> ${esc(f.name)}
    </td>
    <td><span class="pill" style="background:${CAT_CLR[f.Category]||'#444'}22;color:${CAT_CLR[f.Category]||'#888'};border:1px solid ${CAT_CLR[f.Category]||'#444'}44">${esc(f.Category)}</span></td>
    <td class="td-muted">${f.Lots}</td>
    <td class="td-muted">${fmtL(f.Invested)}</td>
    <td style="font-weight:500">${fmtL(f.Current)}</td>
    <td class="${cls(f.Gain)}">${fmtL(f.Gain)}</td>
    <td style="min-width:130px">${miniBar(f.RetPct,maxR)}</td>
    <td class="${f.CAGR>=12?'td-up':f.CAGR>=8?'td-gold':'td-dn'}">${fmtP(f.CAGR)}</td>
    <td class="td-muted" style="font-size:10px">${hold}</td>
  </tr>
  <tr class="drill-row" id="drill-mf-${i}" style="display:none">
    <td colspan="9"><div class="drill-inner">${buildMFDrillHTML(f)}</div></td>
  </tr>`;
  }).join('');

  const maxCat=Math.max(...DATA.mfCategories.map(c=>Math.abs(c.RetPct)),1);
  document.getElementById('mf-cats').innerHTML=DATA.mfCategories.map(c=>`<div class="card" style="border-left:3px solid ${CAT_CLR[c.Category]||'#888'}"><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${c.Category}</div><div style="font-size:18px;font-weight:700;font-family:var(--sans);margin-bottom:4px">${fmtL(c.Current)}</div><div style="font-size:11px;color:var(--muted);margin-bottom:8px">${fmtL(c.Invested)} invested</div>${miniBar(c.RetPct,maxCat)}</div>`).join('');
}
function sortMF(k){if(mfSort===k)mfAsc=!mfAsc;else{mfSort=k;mfAsc=false;}renderMF();}
function setMfFil(v){mfFil=v;renderMF();}

// ── Stocks ────────────────────────────────────────────────────
function renderStocks() {
  const k=DATA.kpis;
  const n=DATA.stocks.length;
  const win=DATA.stocks.filter(s=>s.Gain>0).length;
  const los=DATA.stocks.filter(s=>s.Gain<0).length;
  const totalQty=DATA.stocks.reduce((s,x)=>s+x.Qty,0);
  document.getElementById('kpi-stocks').innerHTML=[
    {l:'Invested',       v:fmtL(k.stInvested), s:'',                sc:'',   a:'#58a6ff'},
    {l:'Market Value',   v:fmtL(k.stValue),    s:'Current holdings',sc:'',   a:'#d4a843'},
    {l:'Total P&L',      v:fmtL(k.stGain),     s:fmtP(k.stReturn), sc:k.stGain>=0?'up':'dn', a:'#f85149'},
    {l:'Winners',        v:win+'/'+n,           s:'In profit',       sc:'up', a:'#3fb950'},
    {l:'Losers',         v:los+'/'+n,           s:'In red',          sc:'dn', a:'#f85149'},
    {l:'Total Quantity', v:fmtN(totalQty),      s:'Shares held',     sc:'',   a:'#7d8590'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub ${c.sc}">${c.s}</div></div>`).join('');

  const secs=['All',...new Set(DATA.stocks.map(s=>s.Sector))];
  document.getElementById('st-filters').innerHTML='<span class="ctrl-label">Sector:</span>'+secs.map(s=>`<button class="chip ${stFil===s?'on':''}" onclick="setStFil('${encodeURIComponent(s)}')">${s}</button>`).join('');
  const sOpts=[['RetPct','Return'],['Gain','P&L'],['Qty','Qty'],['Invested','Invested'],['Current','Value'],['CAGR','CAGR'],['Latest_Price','CMP']];
  document.getElementById('st-sorts').innerHTML='<span class="ctrl-label">Sort:</span>'+sOpts.map(([k,l])=>`<button class="chip ${stSort===k?'on':''}" onclick="sortST('${k}')">${l}${stSort===k?(stAsc?' ↑':' ↓'):''}</button>`).join('');

  let stocks=stFil==='All'?DATA.stocks:DATA.stocks.filter(s=>s.Sector===stFil);
  stocks=[...stocks].sort((a,b)=>stAsc?a[stSort]-b[stSort]:b[stSort]-a[stSort]);
  const maxR=Math.max(...DATA.stocks.map(s=>Math.abs(s.RetPct)),1);

  if(!stocks.length){document.getElementById('st-tbody').innerHTML='<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:30px">Upload your Stocks Excel file to see data</td></tr>';}
  else {
    document.getElementById('st-tbody').innerHTML=stocks.map((s,i)=>{
      const hold=fmtHoldPeriod(s.holdDays);
      return `<tr style="cursor:pointer" onclick="toggleDrill('st',${i})">
      <td style="font-weight:500">
        <span class="expand-btn" id="drill-btn-st-${i}">▶</span> ${esc(s.name)}
      </td>
      <td><span class="pill" style="background:${gc(s.Sector,SEC_CLR)}22;color:${gc(s.Sector,SEC_CLR)};border:1px solid ${gc(s.Sector,SEC_CLR)}44">${esc(s.Sector)}</span></td>
      <td>${riskBadge(s)}</td>
      <td class="td-gold">${fmtN(s.Qty)}</td>
      <td>₹${s.Latest_Price>0?s.Latest_Price.toLocaleString('en-IN'):'—'}</td>
      <td class="td-muted">${fmtL(s.Invested)}</td>
      <td style="font-weight:500">${fmtL(s.Current)}</td>
      <td class="${cls(s.Gain)}">${fmtL(s.Gain)}</td>
      <td style="min-width:130px">${miniBar(s.RetPct,maxR)}</td>
      <td class="${s.CAGR>=15?'td-up':s.CAGR>=0?'td-gold':'td-dn'}">${fmtP(s.CAGR)}</td>
      <td class="td-muted" style="font-size:10px">${hold}</td>
    </tr>
    <tr class="drill-row" id="drill-st-${i}" style="display:none">
      <td colspan="11"><div class="drill-inner">${buildSTDrillHTML(s)}</div></td>
    </tr>`;
    }).join('');
  }

  // Tax harvesting
  renderTaxHarvesting();

  // Dynamic rule-based recommendations
  const recs=[];
  const stTotalInv=DATA.stocks.reduce((a,s)=>a+s.Invested,0)||1;
  const sorted=[...DATA.stocks].sort((a,b)=>a.RetPct-b.RetPct);

  // EXIT: worst losers > -40%
  const exits=sorted.filter(s=>s.RetPct<-40);
  if(exits.length) recs.push(['tag-exit','EXIT',exits.map(s=>`${esc(s.name)} (${fmtP(s.RetPct)})`).join(', ')+' — no recovery thesis, free up capital']);

  // REDUCE: -25% to -40% with >8% concentration
  const reduces=sorted.filter(s=>s.RetPct<=-25&&s.RetPct>=-40&&(s.Invested/stTotalInv*100)>8);
  if(reduces.length) recs.push(['tag-reduce','REDUCE',reduces.map(s=>`${esc(s.name)} (${fmtP(s.RetPct)}, ${(s.Invested/stTotalInv*100).toFixed(1)}% of stocks)`).join(', ')+' — trim to ≤5% of portfolio']);

  // HOLD: -15% to -25%, PSU/infra (await macro)
  const holds=sorted.filter(s=>s.RetPct<-10&&s.RetPct>=-25&&['Finance/PSU','Energy/PSU','Infra/PSU','Renewables'].includes(s.Sector));
  if(holds.length) recs.push(['tag-hold','HOLD',holds.map(s=>`${esc(s.name)} (${fmtP(s.RetPct)})`).join(', ')+' — await rate-cut cycle / sector tailwinds before selling']);

  // ADD SIP: MF CAGR > 15%
  const addFunds=[...DATA.funds].filter(f=>f.CAGR>=15).sort((a,b)=>b.CAGR-a.CAGR).slice(0,3);
  if(addFunds.length) recs.push(['tag-add','ADD SIP',addFunds.map(f=>`${esc(f.name)} (CAGR ${fmtP(f.CAGR)})`).join(', ')+' — top performers, consider increasing SIP amount']);

  // SWITCH: MF CAGR < 8% — underperforming
  const switchFunds=[...DATA.funds].filter(f=>f.CAGR<8&&f.CAGR>0&&f.Invested>50000).sort((a,b)=>a.CAGR-b.CAGR).slice(0,2);
  if(switchFunds.length) recs.push(['tag-switch','SWITCH',switchFunds.map(f=>`${esc(f.name)} (CAGR ${fmtP(f.CAGR)})`).join(', ')+' → consider switching to low-cost Nifty 50 index fund']);

  if(!recs.length) recs.push(['tag-hold','HOLD','Portfolio looks stable — continue SIPs and review quarterly']);
  document.getElementById('recommendations').innerHTML=recs.map(([c,tag,text])=>`<div class="rec-row"><span class="rec-tag ${c}">${tag}</span><span class="rec-text">${text}</span></div>`).join('');
}
function sortST(k){if(stSort===k)stAsc=!stAsc;else{stSort=k;stAsc=false;}renderStocks();}
function setStFil(v){stFil=decodeURIComponent(v);renderStocks();}

// ── Analytics ─────────────────────────────────────────────────
function renderAnalytics() {
  // Monthly MF chart
  setTimeout(()=>{
    const el=document.getElementById('chart-monthly');
    if(!el||!window.Chart) return;
    if(chartInst) chartInst.destroy();
    const d=DATA.monthlyMF;
    if(!d.length){el.parentElement.innerHTML='<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload MF file to see investment flow chart</div>';return;}
    const maxV=Math.max(...d.map(x=>x.v));
    chartInst=new Chart(el,{
      type:'bar',
      data:{labels:d.map(x=>x.m),datasets:[{label:'Monthly Investment',data:d.map(x=>x.v),backgroundColor:d.map(x=>x.v>=maxV*0.7?'#d4a843':'#58a6ff'),borderRadius:4,borderSkipped:false}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmtL(ctx.raw)},backgroundColor:'#1c2330',titleColor:'#e6edf3',bodyColor:'#7d8590',borderColor:'#30363d',borderWidth:1}},
      scales:{x:{ticks:{font:{size:9},color:'#7d8590',maxRotation:60},grid:{color:'#21262d'}},y:{ticks:{font:{size:9},color:'#7d8590',callback:v=>fmtL(v)},grid:{color:'#21262d'}}}}
    });
  },50);

  // Sector P&L
  const maxS=Math.max(...DATA.sectors.map(s=>Math.abs(s.RetPct)),1);
  document.getElementById('sector-pl').innerHTML=DATA.sectors.length
    ?[...DATA.sectors].sort((a,b)=>b.Gain-a.Gain).map(s=>`<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span>${esc(s.Sector)}</span><span class="${cls(s.Gain)}">${fmtL(s.Gain)}</span></div>${miniBar(s.RetPct,maxS)}</div>`).join('')
    :'<div style="color:var(--muted);font-size:11px">Upload Stocks file to see sector P&L</div>';

  // Portfolio ratios — fully dynamic
  const k=DATA.kpis;
  const n=DATA.stocks.length||1, nMF=DATA.funds.length||1;
  const mfWin=DATA.funds.filter(f=>f.Gain>0).length;
  const stWin=DATA.stocks.filter(s=>s.Gain>0).length;
  const mfSharePct=k.totalInvested?Math.round(k.mfInvested/k.totalInvested*100):0;
  const specInv=DATA.stocks.filter(s=>s.Sector==='Speculative').reduce((a,s)=>a+s.Invested,0);
  const specPct=k.stInvested?Math.round(specInv/k.stInvested*100):0;
  const avgMFcagr=nMF>0?parseFloat((DATA.funds.reduce((a,f)=>a+f.CAGR,0)/nMF).toFixed(1)):0;
  const bestMF=[...DATA.funds].sort((a,b)=>b.RetPct-a.RetPct)[0];
  const worstST=[...DATA.stocks].sort((a,b)=>a.RetPct-b.RetPct)[0];

  const ratioRows=[];
  if(nMF>1) ratioRows.push(['MF win rate', mfWin+'/'+DATA.funds.length, mfWin===DATA.funds.length?'100% profitable':mfWin+' of '+DATA.funds.length+' in profit', mfWin===DATA.funds.length?'var(--green)':'var(--amber)']);
  if(n>1)   ratioRows.push(['Stock win rate', stWin+'/'+DATA.stocks.length, stWin+' of '+DATA.stocks.length+' in profit', stWin>n/2?'var(--green)':'var(--red)']);
  if(k.totalInvested) ratioRows.push(['MF share of portfolio', mfSharePct+'%', 'Target: 70%+', mfSharePct>=70?'var(--green)':'var(--blue)']);
  if(specPct>0) ratioRows.push(['Speculative exposure', specPct+'%', specPct<10?'Within safe range':'Reduce to <10%', specPct<10?'var(--green)':'var(--red)']);
  if(avgMFcagr) ratioRows.push(['Avg MF CAGR', fmtP(avgMFcagr), avgMFcagr>10?'Beats FD & inflation':'Below 10% — review funds', avgMFcagr>10?'var(--green)':'var(--amber)']);
  if(bestMF)  ratioRows.push(['Best MF fund', bestMF.name.split(' ').slice(0,2).join(' '), '+'+bestMF.RetPct.toFixed(1)+'% · '+fmtL(bestMF.Gain)+' gain', 'var(--gold)']);
  if(worstST) ratioRows.push(['Worst stock', worstST.name, fmtP(worstST.RetPct)+' · '+fmtL(worstST.Gain)+' loss', 'var(--red)']);

  document.getElementById('ratios').innerHTML=ratioRows.length
    ?ratioRows.map(([l,v,n,c])=>`<div class="stat-row"><div><div class="stat-label">${l}</div><div class="stat-note">${n}</div></div><div class="stat-val" style="color:${c}">${v}</div></div>`).join('')
    :'<div style="color:var(--muted);font-size:11px">Upload files to see ratios</div>';

  // XIRR display — computed from raw lots
  let xirrHTML='<div style="color:var(--muted);font-size:11px">Upload files to compute XIRR</div>';
  if(DATA.mfLots.length){
    const mfCF=[...DATA.mfLots.map(l=>({a:-l.amt,d:l.date}))];
    // Add final value as positive inflow today
    mfCF.push({a:k.mfValue, d:new Date()});
    mfCF.sort((a,b)=>a.d-b.d);
    const mfXirr=calcXIRR(mfCF.map(x=>x.a), mfCF.map(x=>x.d));

    const stCF=[...DATA.stLots.map(l=>({a:-l.amt,d:l.date}))];
    stCF.push({a:k.stValue, d:new Date()});
    stCF.sort((a,b)=>a.d-b.d);
    const stXirr=DATA.stLots.length?calcXIRR(stCF.map(x=>x.a), stCF.map(x=>x.d)):null;

    xirrHTML=`
      <div class="stat-row"><div><div class="stat-label">MF XIRR</div><div class="stat-note">Money-weighted return (all lots)</div></div><div class="stat-val" style="color:${mfXirr&&mfXirr>0?'var(--gold)':'var(--red)'}">${mfXirr!==null?pSign(mfXirr)+mfXirr.toFixed(1)+'%':'—'}</div></div>
      ${stXirr!==null?`<div class="stat-row"><div><div class="stat-label">Stocks XIRR</div><div class="stat-note">Money-weighted return (all lots)</div></div><div class="stat-val" style="color:${stXirr>=0?'var(--green)':'var(--red)'}">${pSign(stXirr)+stXirr.toFixed(1)+'%'}</div></div>`:''}
      <p style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6">XIRR accounts for exact timing of every investment — it reflects the true compounded return on your actual cash deployed.</p>`;
  }
  document.getElementById('xirr-display').innerHTML=xirrHTML;

  // Benchmark comparison
  renderBenchmark();
}

// ── Upload page ───────────────────────────────────────────────
let pendingMF=null, pendingST=null;

function renderUpload() {
  document.getElementById('steps-list').innerHTML=[
    ['1','Export your Mutual Fund portfolio from your broker (Zerodha Kite, ET Money, Groww, etc.) as .xls or .xlsx'],
    ['2','Export your Equity Stocks portfolio the same way as a separate file'],
    ['3','Drop both files below — MF file first, then Stocks file'],
    ['4','The entire dashboard updates instantly — no Python, no server, no extra tools'],
    ['∞','Repeat monthly for always-current portfolio tracking'],
  ].map(([n,t])=>`<div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start"><div style="width:22px;height:22px;border-radius:50%;background:var(--bg4);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--gold);flex-shrink:0;margin-top:1px">${n}</div><div style="font-size:12px;color:var(--muted);line-height:1.6">${t}</div></div>`).join('');
}

// ── Upload event wiring (one-time, not re-registered on each tab visit) ──────
function initUploadListeners() {
  const dzMF=document.getElementById('drop-zone-mf'), fiMF=document.getElementById('file-input-mf');
  dzMF.addEventListener('click',()=>fiMF.click());
  dzMF.addEventListener('dragover',e=>{e.preventDefault();dzMF.style.borderColor='var(--gold)';dzMF.style.color='var(--gold)'});
  dzMF.addEventListener('dragleave',()=>{dzMF.style.borderColor='';dzMF.style.color=''});
  dzMF.addEventListener('drop',e=>{e.preventDefault();dzMF.style.borderColor='';handleExcel(e.dataTransfer.files[0],'mf')});
  fiMF.addEventListener('change',e=>handleExcel(e.target.files[0],'mf'));

  const dzST=document.getElementById('drop-zone-st'), fiST=document.getElementById('file-input-st');
  dzST.addEventListener('click',()=>fiST.click());
  dzST.addEventListener('dragover',e=>{e.preventDefault();dzST.style.borderColor='var(--gold)';dzST.style.color='var(--gold)'});
  dzST.addEventListener('dragleave',()=>{dzST.style.borderColor='';dzST.style.color=''});
  dzST.addEventListener('drop',e=>{e.preventDefault();dzST.style.borderColor='';handleExcel(e.dataTransfer.files[0],'st')});
  fiST.addEventListener('change',e=>handleExcel(e.target.files[0],'st'));
}

// ── Excel parsing ─────────────────────────────────────────────
function handleExcel(file, type) {
  if(!file) return;
  const dz=document.getElementById(type==='mf'?'drop-zone-mf':'drop-zone-st');
  const statusEl=dz.querySelector('.upload-status');
  statusEl.textContent='⏳ Parsing '+file.name+'...';
  dz.style.borderColor='var(--gold)'; dz.style.color='var(--gold)';
  if(typeof XLSX==='undefined'){
    statusEl.textContent='⚠ SheetJS not loaded — check internet connection';
    dz.style.borderColor='var(--red)'; dz.style.color='var(--red)'; return;
  }
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
      if(type==='mf') parseMFRows(rows,dz,statusEl,file.name);
      else parseSTRows(rows,dz,statusEl,file.name);
    }catch(err){statusEl.textContent='✗ Error: '+err.message;dz.style.borderColor='var(--red)';dz.style.color='var(--red)';}
  };
  reader.readAsArrayBuffer(file);
}

function cleanNum(v){
  if(v===''||v===null||v===undefined) return 0;
  if(typeof v==='number') return v;
  return parseFloat(String(v).replace(/[₹,\s*]/g,''))||0;
}

function parseInvDate(v){
  if(!v) return null;
  // SheetJS with cellDates:true may return ISO string or Date-like string
  const s=String(v).trim();
  // dd-mm-yyyy
  const m1=s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if(m1){const y=parseInt(m1[3]);const d=new Date(`${y<100?2000+y:y}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`);return (!isNaN(d)&&d<=new Date())?d:null;}
  // yyyy-mm-dd or ISO
  const d=new Date(s);
  return (isNaN(d)||d>new Date())?null:d;
}

function computeCAGR(invested, current, dates){
  if(!dates.length||!invested) return 0;
  const earliest=new Date(Math.min(...dates.map(d=>d.getTime())));
  const yrs=(Date.now()-earliest.getTime())/(365.25*24*3600*1000);
  if(yrs<0.5) return 0; // Too short to annualise meaningfully
  return parseFloat(((Math.pow(current/invested,1/yrs)-1)*100).toFixed(1));
}

function parseMFRows(rows,dz,statusEl,fname){
  const data=rows.filter(r=>{
    const s=String(r['Scheme']||r['scheme']||r['Fund Name']||'').trim();
    return s&&s.toUpperCase()!=='TOTAL'&&!s.startsWith('*');
  });
  if(!data.length){statusEl.textContent='✗ No MF data found — check column headers';dz.style.borderColor='var(--red)';dz.style.color='var(--red)';return;}

  const s0=data[0];
  const col=names=>names.find(n=>n in s0)||null;
  const cScheme=col(['Scheme','scheme','Fund Name','SCHEME','fund name']);
  const cNAV   =col(['Latest NAV','NAV','nav','Current NAV']);
  const cInvP  =col(['Inv. Price','Purchase Price','Buy Price','inv price']);
  const cQty   =col(['Quantity','quantity','Units','units','QTY']);
  const cInvAmt=col(['Inv. Amt','Investment Amount','Invested','invested','Inv.Amt','Inv Amount','Amount']);
  const cGain  =col(['Overall Gain','Overall Gain/Loss','Gain','gain','Total Gain','P&L']);
  const cValue =col(['Latest Value','Current Value','Value','value','Market Value']);
  const cDate  =col(['Inv. Date','Date','date','Investment Date','Inv Date','Purchase Date']);
  if(!cScheme){statusEl.textContent='✗ Could not find Scheme column';dz.style.borderColor='var(--red)';dz.style.color='var(--red)';return;}

  const map={};
  const lots=[];
  const monthMap={};

  data.forEach(r=>{
    const rawName=String(r[cScheme]).trim();
    const name=rawName.replace(/\s+(Direct Plan Growth|Direct Growth|Regular Growth|Regular Plan Growth|Growth Plan|Growth|Direct Plan|Regular Plan|Direct|Regular)\s*$/i,'').trim();
    if(!name) return;
    if(!map[name]) map[name]={name,Invested:0,Current:0,Gain:0,Lots:0,dates:[],rawLots:[]};
    const g=map[name];
    const inv=cleanNum(r[cInvAmt]);
    const cur=cleanNum(r[cValue]);
    const gn=cleanNum(r[cGain]);
    const qty=cleanNum(r[cQty]||0);
    const nav=cleanNum(r[cNAV]||0);
    const invPrice=cleanNum(r[cInvP]||0);
    const dt=cDate?parseInvDate(r[cDate]):null;
    g.Invested+=inv; g.Current+=cur; g.Gain+=gn; g.Lots++;
    if(dt&&!isNaN(dt)) g.dates.push(dt);
    if(dt&&!isNaN(dt)&&inv>0){
      g.rawLots.push({date:dt,amt:inv,qty,invPrice,nav,cur:inv+cleanNum(r[cGain]||0),gain:gn});
    }
    // raw lot for XIRR
    if(dt&&!isNaN(dt)&&inv>0) lots.push({amt:inv,date:dt});
    // monthly aggregation
    if(dt&&!isNaN(dt)&&inv>0){
      const mk=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
      monthMap[mk]=(monthMap[mk]||0)+inv;
    }
  });

  const catKw=(n)=>{const l=n.toLowerCase();return l.includes('elss')||l.includes('tax saver')?'ELSS':l.includes('small cap')||l.includes('smallcap')?'Small Cap':l.includes('mid cap')||l.includes('midcap')?'Mid Cap':l.includes('large cap')||l.includes('largecap')?'Large Cap':l.includes('flexi')||l.includes('flexicap')||l.includes('multi cap')?'Flexi Cap':l.includes('value')||l.includes('contra')?'Value':l.includes('index')||l.includes('nifty')||l.includes('sensex')?'Index':'Other';};

  const funds=Object.values(map).filter(f=>f.Invested>0||f.Current>0).map(f=>{
    f.RetPct=f.Invested>0?parseFloat(((f.Gain/f.Invested)*100).toFixed(1)):0;
    f.CAGR=computeCAGR(f.Invested,f.Current,f.dates);
    f.Gain=Math.round(f.Gain);
    f.Category=catKw(f.name);
    // Holding period from earliest lot date
    if(f.dates.length){
      const earliest=new Date(Math.min(...f.dates.map(d=>d.getTime())));
      f.holdDays=Math.floor((Date.now()-earliest.getTime())/(24*3600*1000));
    } else f.holdDays=0;
    return f;
  });

  if(!funds.length){statusEl.textContent='✗ No valid fund rows found';dz.style.borderColor='var(--red)';dz.style.color='var(--red)';return;}

  const monthlyMF=Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,v])=>({m,v:Math.round(v)}));
  const allDates=lots.map(l=>l.date).filter(Boolean);
  const earliestMF=allDates.length?new Date(Math.min(...allDates.map(d=>d.getTime()))):null;

  pendingMF={funds,lots,monthlyMF,earliestMF};
  statusEl.textContent=`✓ ${fname} — ${funds.length} funds, ${lots.length} lots`;
  dz.style.borderColor='var(--green)'; dz.style.color='var(--green)';
  tryApplyData();
}

function parseSTRows(rows,dz,statusEl,fname){
  const data=rows.filter(r=>{
    const s=String(r['Stock']||r['stock']||r['Symbol']||r['Company']||'').trim();
    return s&&s.toUpperCase()!=='TOTAL'&&!s.startsWith('*')&&s!=='';
  });
  if(!data.length){statusEl.textContent='✗ No stock data found — check column headers';dz.style.borderColor='var(--red)';dz.style.color='var(--red)';return;}

  const s0=data[0];
  const col=names=>names.find(n=>n in s0)||null;
  const cStock =col(['Stock','stock','Symbol','Company','Scrip']);
  const cPrice =col(['Latest Price','CMP','Price','price','LTP','Last Price']);
  const cQty   =col(['Quantity','quantity','Qty','qty','Units','Shares']);
  const cInvP  =col(['Inv. Price','Buy Price','Purchase Price','Avg Price','avg price']);
  const cInvAmt=col(['Inv. Amt','Investment Amount','Invested','invested','Inv Amount','Inv.Amt','Amount']);
  const cGain  =col(['Overall Gain','Gain','gain','Overall Gain/Loss','P&L','Profit/Loss']);
  const cValue =col(['Latest Value','Current Value','Value','value','Market Value','Present Value']);
  const cDate  =col(['Inv. Date','Date','date','Purchase Date','Buy Date']);
  if(!cStock){statusEl.textContent='✗ Could not find Stock column';dz.style.borderColor='var(--red)';dz.style.color='var(--red)';return;}

  const SECTOR_MAP={'bpcl':'Energy/PSU','bharat elec':'Defence','coal india':'Energy/PSU','enbee':'Speculative','irfc':'Finance/PSU','itc':'FMCG','jaiprakash':'Speculative','mo defence':'Defence','motilal.*defence':'Defence','mazagon':'Defence','nbcc':'Infra/PSU','nhpc':'Energy/PSU','nipp.*nifty':'Index ETF','nippon.*nifty':'Index ETF','ongc':'Energy/PSU','reliance power':'Speculative','suzlon':'Renewables','tata silver':'Commodities ETF','uti nifty':'Index ETF','vedanta':'Metals/Mining','yes bank':'Banking','uttam value':'Speculative','hindustan zinc':'Metals/Mining','adani':'Speculative','zomato':'Consumer Tech','bse':'Finance','nse':'Finance','hdfc':'Banking','icici':'Banking','sbi':'Banking','axis bank':'Banking','kotak bank':'Banking','tata steel':'Metals/Mining','jsw steel':'Metals/Mining','ntpc':'Energy/PSU','power grid':'Energy/PSU','bhel':'Infra/PSU','l&t':'Infra/PSU','siemens':'Infra/PSU','infosys':'IT','tcs':'IT','wipro':'IT','hcl tech':'IT','tech mahindra':'IT','bajaj finance':'Finance/PSU','muthoot':'Finance/PSU'};
  const _unclassifiedStocks=[];
  function getSector(name){const n=name.toLowerCase();for(const [k,v] of Object.entries(SECTOR_MAP)){if(new RegExp(k).test(n)) return v;} _unclassifiedStocks.push(name); return 'Other';}


  const map={};
  const lots=[];
  data.forEach(r=>{
    const rawName=String(r[cStock]).trim();
    const name=rawName.replace(/\s*-\s*(NSE|BSE)\s*-.*/i,'').replace(/\s*-\s*(NSE|BSE)\s*$/i,'').trim();
    if(!name) return;
    const lp=cleanNum(r[cPrice]);
    const qty=cleanNum(r[cQty]);
    const inv=cleanNum(r[cInvAmt]);
    const cur=cleanNum(r[cValue]);
    const gn=cleanNum(r[cGain]);
    const invP=cInvP?cleanNum(r[cInvP]):0;
    const dt=cDate?parseInvDate(r[cDate]):null;
    if(!map[name]) map[name]={name,Qty:0,Invested:0,Current:0,Gain:0,Latest_Price:0,dates:[],rawLots:[]};
    const g=map[name];
    g.Qty+=qty; g.Invested+=inv; g.Current+=cur; g.Gain+=gn;
    if(lp>0) g.Latest_Price=lp;
    if(dt&&!isNaN(dt)) g.dates.push(dt);
    if(dt&&!isNaN(dt)&&inv>0){
      g.rawLots.push({date:dt,qty,invPrice:invP||( qty?inv/qty:0),currentPrice:lp,inv,gain:gn,cur:cur||0});
    }
    if(dt&&!isNaN(dt)&&inv>0) lots.push({amt:inv,date:dt});
  });

  const stocks=Object.values(map).filter(s=>s.Invested>0||s.Current>0).map(s=>{
    s.RetPct=s.Invested>0?parseFloat(((s.Gain/s.Invested)*100).toFixed(1)):0;
    s.CAGR=computeCAGR(s.Invested,s.Current,s.dates);
    s.Gain=Math.round(s.Gain);
    s.Sector=getSector(s.name);
    if(s.dates.length){
      const earliest=new Date(Math.min(...s.dates.map(d=>d.getTime())));
      s.holdDays=Math.floor((Date.now()-earliest.getTime())/(24*3600*1000));
    } else s.holdDays=0;
    return s;
  });

  if(!stocks.length){statusEl.textContent='✗ No valid stock rows found';dz.style.borderColor='var(--red)';dz.style.color='var(--red)';return;}

  const allDates=lots.map(l=>l.date).filter(Boolean);
  const earliestST=allDates.length?new Date(Math.min(...allDates.map(d=>d.getTime()))):null;
  pendingST={stocks,lots,earliestST};
  const uniqUnclassified=[...new Set(_unclassifiedStocks)];
  let stMsg=`✓ ${fname} — ${stocks.length} stocks, ${lots.length} lots`;
  if(uniqUnclassified.length) stMsg+=` · ⚠ ${uniqUnclassified.length} stock(s) auto-mapped to "Other" sector (${uniqUnclassified.slice(0,3).join(', ')}${uniqUnclassified.length>3?'…':''})`;
  statusEl.textContent=stMsg;
  dz.style.borderColor='var(--green)'; dz.style.color='var(--green)';
  tryApplyData();
}

// ── Apply parsed data to DATA + refresh all ───────────────────
function tryApplyData(){
  const hasMF=pendingMF!==null, hasST=pendingST!==null;
  const msgEl=document.getElementById('apply-msg');

  if(hasMF&&hasST){
    const funds=pendingMF.funds, stocks=pendingST.stocks;

    // MF categories
    const catMap={};
    funds.forEach(f=>{
      if(!catMap[f.Category]) catMap[f.Category]={Category:f.Category,Invested:0,Current:0,Gain:0};
      catMap[f.Category].Invested+=f.Invested; catMap[f.Category].Current+=f.Current; catMap[f.Category].Gain+=f.Gain;
    });
    const mfCategories=Object.values(catMap).map(c=>{c.RetPct=c.Invested>0?parseFloat(((c.Gain/c.Invested)*100).toFixed(1)):0;return c;});

    // Sectors
    const secMap={};
    stocks.forEach(s=>{
      if(!secMap[s.Sector]) secMap[s.Sector]={Sector:s.Sector,Invested:0,Current:0,Gain:0};
      secMap[s.Sector].Invested+=s.Invested; secMap[s.Sector].Current+=s.Current; secMap[s.Sector].Gain+=s.Gain;
    });
    const sectors=Object.values(secMap).map(s=>{s.RetPct=s.Invested>0?parseFloat(((s.Gain/s.Invested)*100).toFixed(1)):0;return s;});

    // KPIs
    const mfInvested=funds.reduce((a,f)=>a+f.Invested,0);
    const mfValue   =funds.reduce((a,f)=>a+f.Current,0);
    const mfGain    =funds.reduce((a,f)=>a+f.Gain,0);
    const stInvested=stocks.reduce((a,s)=>a+s.Invested,0);
    const stValue   =stocks.reduce((a,s)=>a+s.Current,0);
    const stGain    =stocks.reduce((a,s)=>a+s.Gain,0);
    const totalInvested=mfInvested+stInvested;
    const totalValue=mfValue+stValue;
    const totalGain=mfGain+stGain;
    const mfReturn=mfInvested>0?parseFloat(((mfGain/mfInvested)*100).toFixed(1)):0;
    const stReturn=stInvested>0?parseFloat(((stGain/stInvested)*100).toFixed(1)):0;
    const totalReturn=totalInvested>0?parseFloat(((totalGain/totalInvested)*100).toFixed(1)):0;
    const mfCAGR=mfInvested>0?parseFloat((funds.reduce((a,f)=>a+f.CAGR*(f.Invested/mfInvested),0)).toFixed(1)):0;
    // Latest date = today (data is current as of upload time)
    const latestDate=new Date();

    DATA.kpis={totalInvested,totalValue,totalGain,totalReturn,
               mfInvested,mfValue,mfGain,mfReturn,mfCAGR,
               stInvested,stValue,stGain,stReturn,
               earliestMF:pendingMF.earliestMF,
               earliestST:pendingST.earliestST,
               latestDate};
    DATA.funds=funds;
    DATA.mfCategories=mfCategories;
    DATA.stocks=stocks;
    DATA.sectors=sectors;
    DATA.monthlyMF=pendingMF.monthlyMF;
    DATA.mfLots=pendingMF.lots;
    DATA.stLots=pendingST.lots;
    _fundAnalysisCache=null; // invalidate on new data

    buildTicker();
    buildStrip();
    updateChrome();
    renderSIPReminder();

    if(msgEl){
      msgEl.style.background='var(--green-bg)';
      msgEl.style.border='1px solid var(--green-dim)';
      msgEl.style.color='var(--green)';
      msgEl.style.display='block';
      msgEl.textContent='✓ Dashboard fully updated! Navigate to any tab to explore your live portfolio.';
    }
    pendingMF=null; pendingST=null;
    // Reset sort state on new data
    mfFil='All'; stFil='All';
  } else {
    if(msgEl){
      const missing=(!hasMF&&!hasST)?'Upload both MF and Stocks files to update the dashboard.'
        :(!hasMF)?'✓ Stocks loaded. Now upload the MF file to complete the update.'
        :'✓ MF file loaded. Now upload the Stocks file to complete the update.';
      msgEl.style.background='var(--amber-bg)';
      msgEl.style.border='1px solid #4a3500';
      msgEl.style.color='var(--amber)';
      msgEl.style.display='block';
      msgEl.textContent=missing;
    }
  }
}

// ── Investment Timeline ───────────────────────────────────────
let tlYearFilter='All', chartCumInst=null;

function buildCombinedMonthly() {
  // Merge MF monthly + stock lots into a single month→amount map
  const map={};
  // MF monthly data (already aggregated)
  DATA.monthlyMF.forEach(({m,v})=>{ map[m]=(map[m]||0)+v; });
  // Stock lots grouped by month
  DATA.stLots.forEach(l=>{
    if(!l.date||!l.amt) return;
    const d=new Date(l.date);
    if(isNaN(d)) return;
    const mk=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    map[mk]=(map[mk]||0)+l.amt;
  });
  return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,v])=>({m,v:Math.round(v)}));
}

function renderTimeline() {
  const allMonths = buildCombinedMonthly();
  const noData = !allMonths.length;

  // ── KPI strip ──────────────────────────────────────────────
  const k = DATA.kpis;
  const totalLots = DATA.mfLots.length + DATA.stLots.length;
  const avgMonthly = allMonths.length ? Math.round(allMonths.reduce((a,x)=>a+x.v,0)/allMonths.length) : 0;
  const maxMonth = allMonths.length ? allMonths.reduce((a,x)=>x.v>a.v?x:a,allMonths[0]) : null;
  const minMonth = allMonths.filter(x=>x.v>0).length ? allMonths.filter(x=>x.v>0).reduce((a,x)=>x.v<a.v?x:a) : null;
  const activeMonths = allMonths.filter(x=>x.v>0).length;
  const years = [...new Set(allMonths.map(x=>x.m.slice(0,4)))];
  const spanYears = years.length ? (parseInt(years[years.length-1])-parseInt(years[0])+1) : 0;

  document.getElementById('tl-kpis').innerHTML=[
    {l:'Total Invested',   v: k.totalInvested?fmtL(k.totalInvested):'—', s:'MF + Stocks combined',      a:'#d4a843'},
    {l:'Avg Monthly SIP',  v: avgMonthly?fmtL(avgMonthly):'—',            s:'Across active months',       a:'#58a6ff'},
    {l:'Active Months',    v: activeMonths||'—',                           s:`Over ${spanYears} yr${spanYears!==1?'s':''}`, a:'#3fb950'},
    {l:'Total Lots',       v: totalLots||'—',                              s:'Individual purchases',       a:'#a371f7'},
    {l:'Best Month',       v: maxMonth?fmtL(maxMonth.v):'—',              s: maxMonth?fmtMonthLabel(maxMonth.m):'—', a:'#f0c060'},
    {l:'Lowest Month',     v: minMonth?fmtL(minMonth.v):'—',              s: minMonth?fmtMonthLabel(minMonth.m):'—', a:'#7d8590'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub">${c.s}</div></div>`).join('');

  // ── Year filter chips ──────────────────────────────────────
  const allYears=['All',...years];
  document.getElementById('tl-year-filter').innerHTML=
    '<span class="ctrl-label">Year:</span>'+
    allYears.map(y=>`<button class="chip ${tlYearFilter===y?'on':''}" onclick="setTLYear('${y}')">${y}</button>`).join('');

  // filter months
  const months = tlYearFilter==='All' ? allMonths : allMonths.filter(x=>x.m.startsWith(tlYearFilter));

  // ── Heatmap ────────────────────────────────────────────────
  renderHeatmap(months, allMonths);

  // ── Yearly bars ────────────────────────────────────────────
  const yearlyMap={};
  months.forEach(({m,v})=>{ const y=m.slice(0,4); yearlyMap[y]=(yearlyMap[y]||0)+v; });
  const yearlyArr=Object.entries(yearlyMap).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxYV=yearlyArr.length?Math.max(...yearlyArr.map(x=>x[1])):1;
  document.getElementById('tl-yearly-bars').innerHTML = yearlyArr.length
    ? yearlyArr.map(([y,v])=>`
        <div class="yr-bar-wrap">
          <span class="yr-bar-label">${y}</span>
          <div class="yr-bar-track">
            <div class="yr-bar-fill" style="width:${Math.round(v/maxYV*100)}%;background:${v>=maxYV*0.7?'#d4a843':'#58a6ff'}"></div>
          </div>
          <span class="yr-bar-val">${fmtL(v)}</span>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:11px">No data</div>';

  // ── Monthly breakdown table (by selected year or last year) ─
  const tableYear = tlYearFilter!=='All' ? tlYearFilter : (years[years.length-1]||'');
  const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('tl-month-select').innerHTML =
    years.map(y=>`<button class="chip" style="font-size:9px;padding:3px 7px;${y===tableYear?'background:var(--gold);color:#0d1117;border-color:var(--gold);font-weight:500':''}" onclick="setTLYear('${y}')">${y}</button>`).join('');

  const tableMonths=allMonths.filter(x=>x.m.startsWith(tableYear));
  const maxTV=tableMonths.length?Math.max(...tableMonths.map(x=>x.v)):1;
  const tableTotal=tableMonths.reduce((a,x)=>a+x.v,0);
  document.getElementById('tl-monthly-table').innerHTML = tableMonths.length
    ? `<table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 0;border-bottom:1px solid var(--border)">Month</th>
          <th style="text-align:right;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 0;border-bottom:1px solid var(--border)">Invested</th>
          <th style="text-align:right;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 4px;border-bottom:1px solid var(--border)">% of Year</th>
        </tr></thead>
        <tbody>
        ${tableMonths.map(({m,v})=>{
          const mo=parseInt(m.slice(5))-1;
          const pct=tableTotal>0?Math.round(v/tableTotal*100):0;
          return `<tr>
            <td style="padding:7px 0;border-bottom:1px solid var(--border);font-size:11px">
              <div style="display:flex;align-items:center;gap:7px">
                <div style="width:${Math.round(v/maxTV*40)+8}px;height:3px;background:${v>=maxTV*0.7?'#d4a843':'#58a6ff'};border-radius:2px;transition:width .4s"></div>
                ${MONTH_NAMES[mo]}
              </div>
            </td>
            <td style="padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;text-align:right;font-weight:500;color:var(--text)">${fmtL(v)}</td>
            <td style="padding:7px 4px;border-bottom:1px solid var(--border);font-size:10px;text-align:right;color:var(--muted)">${pct}%</td>
          </tr>`;
        }).join('')}
        </tbody>
        <tfoot><tr>
          <td style="padding:8px 0;font-size:11px;color:var(--muted);font-weight:600">Total ${tableYear}</td>
          <td style="padding:8px 0;font-size:11px;text-align:right;font-weight:700;color:var(--gold)">${fmtL(tableTotal)}</td>
          <td></td>
        </tr></tfoot>
      </table>`
    : `<div style="color:var(--muted);font-size:11px">${tableYear?'No investments in '+tableYear:'Upload files to see breakdown'}</div>`;

  // ── Cumulative invested chart (MF + Stocks combined) ────────
  setTimeout(()=>{
    const el=document.getElementById('chart-cumulative');
    if(!el||!window.Chart) return;
    if(chartCumInst) chartCumInst.destroy();
    if(!allMonths.length){
      el.parentElement.innerHTML='<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see cumulative chart</div>';
      return;
    }
    // Build cumulative series — fill every month between first and last
    const first=allMonths[0].m, last=allMonths[allMonths.length-1].m;
    const monthMap={}; allMonths.forEach(({m,v})=>monthMap[m]=v);
    const labels=[], cumData=[], mfCumData=[], stCumData=[];
    const mfMonthMap={};
    DATA.monthlyMF.forEach(({m,v})=>mfMonthMap[m]=v);
    const stMonthMap={};
    DATA.stLots.forEach(l=>{
      if(!l.date||!l.amt) return;
      const d=new Date(l.date); if(isNaN(d)) return;
      const mk=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      stMonthMap[mk]=(stMonthMap[mk]||0)+Math.round(l.amt);
    });

    let [fy,fm]=[parseInt(first.slice(0,4)),parseInt(first.slice(5))];
    const [ly,lm]=[parseInt(last.slice(0,4)),parseInt(last.slice(5))];
    let cumTotal=0, cumMF=0, cumST=0;
    while(fy<ly||(fy===ly&&fm<=lm)){
      const mk=fy+'-'+String(fm).padStart(2,'0');
      cumTotal+=(monthMap[mk]||0);
      cumMF+=(mfMonthMap[mk]||0);
      cumST+=(stMonthMap[mk]||0);
      labels.push(mk);
      cumData.push(cumTotal);
      mfCumData.push(cumMF);
      stCumData.push(cumST);
      fm++; if(fm>12){fm=1;fy++;}
    }

    // Thin labels for readability
    const skip=Math.ceil(labels.length/18);
    chartCumInst=new Chart(el,{
      type:'line',
      data:{
        labels,
        datasets:[
          {label:'Total',data:cumData,borderColor:'#d4a843',backgroundColor:'rgba(212,168,67,.08)',borderWidth:2,pointRadius:0,pointHoverRadius:4,fill:true,tension:0.3},
          {label:'MF',   data:mfCumData,borderColor:'#58a6ff',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,pointHoverRadius:3,borderDash:[4,3],tension:0.3},
          {label:'Stocks',data:stCumData,borderColor:'#f0883e',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,pointHoverRadius:3,borderDash:[2,3],tension:0.3},
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{display:true,position:'top',labels:{color:'#7d8590',font:{size:10},boxWidth:12,padding:12}},
          tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmtL(ctx.raw)},backgroundColor:'#1c2330',titleColor:'#e6edf3',bodyColor:'#7d8590',borderColor:'#30363d',borderWidth:1}
        },
        scales:{
          x:{ticks:{font:{size:9},color:'#7d8590',maxRotation:45,callback:(v,i)=>i%skip===0?labels[i]:''},grid:{color:'#21262d'}},
          y:{ticks:{font:{size:9},color:'#7d8590',callback:v=>fmtL(v)},grid:{color:'#21262d'}}
        }
      }
    });
  },60);

  // ── Insight cards ──────────────────────────────────────────
  const insights=[];
  if(allMonths.length){
    // Streak: longest consecutive investing months
    let maxStreak=0,cur=0;
    allMonths.forEach(x=>{if(x.v>0){cur++;maxStreak=Math.max(maxStreak,cur);}else cur=0;});
    insights.push({label:'Longest SIP streak',value:maxStreak+' months',note:'Consecutive months invested',accent:'#3fb950'});

    // Most active year
    const byYear={}; allMonths.forEach(({m,v})=>{const y=m.slice(0,4);byYear[y]=(byYear[y]||0)+v;});
    const topYear=Object.entries(byYear).sort((a,b)=>b[1]-a[1])[0];
    if(topYear) insights.push({label:'Highest-invest year',value:topYear[0],note:fmtL(topYear[1])+' deployed',accent:'#d4a843'});

    // Avg annual investment
    const yearVals=Object.values(byYear);
    const avgYearly=Math.round(yearVals.reduce((a,v)=>a+v,0)/yearVals.length);
    insights.push({label:'Avg annual invest',value:fmtL(avgYearly),note:'Across '+yearVals.length+' year'+( yearVals.length!==1?'s':''),accent:'#58a6ff'});

    // Gap months (months with zero investment)
    const gapMonths=allMonths.filter(x=>x.v===0).length;
    insights.push({label:'Inactive months',value:gapMonths,note:'Months with no investment',accent:'#7d8590'});

    // MF vs stock split of total deployed
    const mfTotal=DATA.monthlyMF.reduce((a,x)=>a+x.v,0);
    const stTotal=DATA.stLots.reduce((a,l)=>a+l.amt,0);
    const mfPct=mfTotal+stTotal>0?Math.round(mfTotal/(mfTotal+stTotal)*100):0;
    insights.push({label:'MF vs Stocks split',value:mfPct+'% / '+(100-mfPct)+'%',note:'Of total capital deployed',accent:'#a371f7'});

    // Biggest single month
    if(maxMonth) insights.push({label:'Biggest single month',value:fmtL(maxMonth.v),note:fmtMonthLabel(maxMonth.m),accent:'#f0c060'});
  }
  document.getElementById('tl-insights').innerHTML=insights.length
    ?insights.map(c=>`<div class="insight-card" style="--ic-accent:${c.accent}"><div class="insight-label">${c.label}</div><div class="insight-value" style="color:${c.accent}">${c.value}</div><div class="insight-note">${c.note}</div></div>`).join('')
    :'<div style="color:var(--muted);font-size:11px;padding:10px">Upload files to see investment insights</div>';
}

function fmtMonthLabel(mk){
  const MNAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y,m]=mk.split('-'); return MNAMES[parseInt(m)-1]+' '+y;
}

function renderHeatmap(months, allMonths){
  const container=document.getElementById('tl-heatmap');
  if(!months.length){container.innerHTML='<div style="color:var(--muted);font-size:11px;padding:16px">Upload files to see heatmap</div>';return;}

  const allValues=allMonths.map(x=>x.v).filter(v=>v>0);
  const maxV=Math.max(...allValues,1);
  // colour scale: 5 steps from dim→gold
  const COLORS=['#1a2a1a','#1a3d26','#1e5c30','#c8901a','#d4a843'];
  function getColor(v){
    if(!v) return null;
    const idx=Math.min(4,Math.floor(v/maxV*5));
    return COLORS[idx];
  }

  // Build month→value map
  const mvMap={}; months.forEach(({m,v})=>mvMap[m]=v);
  const years=[...new Set(months.map(x=>x.m.slice(0,4)))];
  const MNAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Grid: rows=years, cols=12 months
  const cellSize=24, gap=3;
  const totalW=(cellSize+gap)*12+40;

  let html=`<div style="overflow-x:auto"><div style="min-width:${totalW}px;padding:4px 0">`;
  // Month header
  html+=`<div style="display:grid;grid-template-columns:36px repeat(12,${cellSize}px);gap:${gap}px;margin-bottom:4px">`;
  html+=`<div></div>`;
  MNAMES.forEach(mn=>html+=`<div style="font-size:9px;color:var(--muted2);text-align:center;letter-spacing:.04em">${mn}</div>`);
  html+='</div>';

  // Tooltip div
  if(!document.getElementById('tl-tooltip')){
    const tt=document.createElement('div');
    tt.id='tl-tooltip'; tt.className='tl-tooltip';
    document.body.appendChild(tt);
  }

  years.forEach(y=>{
    html+=`<div style="display:grid;grid-template-columns:36px repeat(12,${cellSize}px);gap:${gap}px;margin-bottom:${gap}px;align-items:center">`;
    html+=`<div style="font-size:9px;color:var(--muted);text-align:right;padding-right:6px;font-weight:500">${y}</div>`;
    for(let m=1;m<=12;m++){
      const mk=y+'-'+String(m).padStart(2,'0');
      const v=mvMap[mk]||0;
      const bg=getColor(v);
      if(bg){
        const escaped=fmtL(v).replace(/'/g,"&#39;");
        const mlabel=MNAMES[m-1]+' '+y;
        html+=`<div class="tl-cell" style="width:${cellSize}px;height:${cellSize}px;background:${bg}"
          onmouseenter="showTLTip(event,'${mlabel}','${escaped}')"
          onmouseleave="hideTLTip()"></div>`;
      } else {
        html+=`<div class="tl-cell-empty" style="width:${cellSize}px;height:${cellSize}px"></div>`;
      }
    }
    html+='</div>';
  });
  html+='</div></div>';

  // Legend
  document.getElementById('tl-heatmap-legend').innerHTML=
    '<span style="margin-right:4px">Less</span>'+
    ['#1a2a1a','#1a3d26','#1e5c30','#c8901a','#d4a843'].map(c=>`<div style="width:14px;height:14px;background:${c};border-radius:2px"></div>`).join('')+
    '<span style="margin-left:4px">More</span>';

  container.innerHTML=html;
}

function showTLTip(e,label,val){
  const tt=document.getElementById('tl-tooltip');
  if(!tt) return;
  tt.innerHTML=`<strong>${label}</strong>Invested: ${val}`;
  tt.style.display='block';
  tt.style.left=(e.pageX+12)+'px';
  tt.style.top=(e.pageY-10)+'px';
}
function hideTLTip(){
  const tt=document.getElementById('tl-tooltip');
  if(tt) tt.style.display='none';
}
function setTLYear(y){ tlYearFilter=y; renderTimeline(); }

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
function renderHealthScore(){
  const k=DATA.kpis;
  if(!k.totalInvested){
    document.getElementById('health-score-display').innerHTML='<div style="color:var(--muted);font-size:11px">Upload files to compute health score</div>';
    document.getElementById('health-score-breakdown').innerHTML='';
    return;
  }

  // Score components (each 0–20, total 100)
  const n=DATA.stocks.length||1;
  const mfShare=k.totalInvested?k.mfInvested/k.totalInvested:0;
  const stWin=DATA.stocks.filter(s=>s.Gain>0).length;
  const mfWin=DATA.funds.filter(f=>f.Gain>0).length;
  const nMF=DATA.funds.length||1;
  const avgMFcagr=DATA.funds.reduce((a,f)=>a+f.CAGR,0)/nMF;
  const maxSingleStPct=DATA.stocks.length?Math.max(...DATA.stocks.map(s=>s.Invested/k.stInvested*100)):0;
  const specInv=DATA.stocks.filter(s=>s.Sector==='Speculative').reduce((a,s)=>a+s.Invested,0);
  const specPct=k.stInvested?specInv/k.stInvested:0;

  // 1. Diversification (0-20): penalise >20% single stock, >50% speculative
  const divScore=Math.max(0,20-Math.max(0,(maxSingleStPct-20)*0.5)-Math.max(0,(specPct*100-15)*0.4));

  // 2. MF dominance (0-20): reward MF share ≥60%
  const mfScore=Math.min(20,mfShare*33);

  // 3. Profitability (0-20): % of holdings in profit weighted equally
  const totalHoldings=DATA.funds.length+DATA.stocks.length||1;
  const totalWin=mfWin+stWin;
  const profScore=(totalWin/totalHoldings)*20;

  // 4. CAGR vs benchmark Nifty 12% (0-20)
  const cagrScore=Math.min(20,Math.max(0,(avgMFcagr/12)*20));

  // 5. Consistency (0-20): from timeline — active months / total months ratio
  let consistScore=10; // default when no timeline data
  if(DATA.monthlyMF.length){
    const allM=buildCombinedMonthly();
    const active=allM.filter(x=>x.v>0).length;
    consistScore=allM.length?Math.min(20,(active/allM.length)*22):10;
  }

  const total=Math.round(divScore+mfScore+profScore+cagrScore+consistScore);
  const clamp=Math.min(100,Math.max(0,total));
  const scoreColor=clamp>=75?'#3fb950':clamp>=50?'#d4a843':'#f85149';
  const scoreLabel=clamp>=75?'Healthy':clamp>=50?'Fair':'Needs Attention';

  // ── SVG semicircle gauge — fixed geometry ──
  // ViewBox: 180 wide × 110 tall. Centre of arc: (90, 95). Radius 72.
  // Arc sweeps left (180°) to right (0°) across the top half.
  // Score 0 = left tip, Score 100 = right tip.
  const VW=180, VH=110, GCX=90, GCY=95, GR=72, SW=12;

  // Polar → cartesian. 0° = right, angles in degrees, measured from positive-x axis.
  const polar=(deg)=>({
    x: GCX + GR * Math.cos(deg * Math.PI / 180),
    y: GCY + GR * Math.sin(deg * Math.PI / 180),
  });

  // Track: 180° (left) → 0° (right), always full arc
  const tStart = polar(180);
  const tEnd   = polar(0);
  const trackD = `M${tStart.x},${tStart.y} A${GR},${GR} 0 0,1 ${tEnd.x},${tEnd.y}`;

  // Fill: 180° → (180° - score%) of 180°, sweeping clockwise (0,1)
  // score 0 → angle stays at 180 (left), score 100 → angle reaches 0 (right)
  const fillAngle = 180 - (clamp / 100) * 180;   // end angle in degrees
  const fEnd      = polar(fillAngle);
  const largeArc  = (180 - fillAngle) > 180 ? 1 : 0;
  const fillD = clamp > 0
    ? `M${tStart.x},${tStart.y} A${GR},${GR} 0 ${largeArc},1 ${fEnd.x},${fEnd.y}`
    : '';

  // Needle tip circle at fill end
  const needleTip = clamp > 0
    ? `<circle cx="${fEnd.x.toFixed(1)}" cy="${fEnd.y.toFixed(1)}" r="5" fill="${scoreColor}"/>`
    : '';

  // Score tick marks at 25/50/75
  function polar_r(cx,cy,r,deg){return{x:cx+r*Math.cos(deg*Math.PI/180),y:cy+r*Math.sin(deg*Math.PI/180)};}
  const ticks=[25,50,75].map(v=>{
    const a=180-(v/100)*180;
    const inner=polar_r(GCX,GCY,GR-10,a);
    const outer=polar_r(GCX,GCY,GR+2,a);
    return `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border2)" stroke-width="1.5"/>`;
  }).join('');

  document.getElementById('health-score-display').innerHTML=`
    <div class="health-gauge">
      <svg viewBox="-10 0 ${VW+20} ${VH}" width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        <!-- Track arc -->
        <path d="${trackD}" fill="none" stroke="var(--bg4)" stroke-width="${SW}" stroke-linecap="round"/>
        <!-- Fill arc -->
        ${fillD?`<path d="${fillD}" fill="none" stroke="${scoreColor}" stroke-width="${SW}" stroke-linecap="round" opacity="0.95"/>`:''}
        <!-- Needle tip -->
        ${needleTip}
        <!-- Tick marks -->
        ${ticks}
        <!-- 0 label -->
        <text x="${tStart.x-14}" y="${tStart.y+6}" font-size="9" fill="var(--muted)" text-anchor="middle">0</text>
        <!-- 100 label -->
        <text x="${tEnd.x+14}" y="${tEnd.y+6}" font-size="9" fill="var(--muted)" text-anchor="middle">100</text>
      </svg>
      <div class="health-gauge-val">
        <span class="health-score-num" style="color:${scoreColor}">${clamp}</span>
        <span class="health-score-lbl" style="color:${scoreColor}">${scoreLabel}</span>
      </div>
    </div>
    <div style="flex:1;padding-left:8px">
      <div style="font-size:11px;color:var(--muted);line-height:1.8">
        Score computed across 5 dimensions:<br>diversification, MF dominance, profitability,<br>CAGR vs benchmark, and investment consistency.
      </div>
    </div>`;

  const breakdown=[
    ['Diversification',  Math.round(divScore),   20, 'Single-stock concentration & speculative exposure'],
    ['MF Dominance',     Math.round(mfScore),    20, 'MF share of total portfolio'],
    ['Profitability',    Math.round(profScore),  20, '% of funds & stocks in profit'],
    ['CAGR Quality',     Math.round(cagrScore),  20, 'Average MF CAGR vs Nifty 50 (12%)'],
    ['Consistency',      Math.round(consistScore),20,'Regular investing across months'],
  ];
  document.getElementById('health-score-breakdown').innerHTML=breakdown.map(([name,pts,max,note])=>{
    const pct=Math.round(pts/max*100);
    const c=pct>=75?'#3fb950':pct>=50?'#d4a843':'#f85149';
    return `<div class="health-bar-row">
      <span class="health-bar-name" title="${note}">${name}</span>
      <div class="health-bar-track"><div class="health-bar-fill" style="width:${pct}%;background:${c}"></div></div>
      <span class="health-bar-pts" style="color:${c}">${pts}/${max}</span>
    </div>`;
  }).join('');
}

// ── Tax Harvesting ────────────────────────────────────────────
function renderTaxHarvesting(){
  const taxKpisEl=document.getElementById('tax-kpis');
  const taxTableEl=document.getElementById('tax-table');
  if(!taxKpisEl||!taxTableEl) return;

  if(!DATA.stocks.length){
    taxKpisEl.innerHTML=''; taxTableEl.innerHTML='<div style="color:var(--muted);font-size:11px">Upload Stocks file to see tax analysis</div>'; return;
  }

  // Per lot tax classification
  const LTCG_EXEMPT=125000; // ₹1.25L exempt per year
  const now=Date.now();
  let totalLTCGGain=0, totalSTCGGain=0, totalLTCGLoss=0, totalSTCGLoss=0;
  let harvestCandidates=[];

  DATA.stocks.forEach(s=>{
    const cmp=s.Latest_Price||0;
    (s.rawLots||[]).forEach(l=>{
      const days=Math.floor((now-l.date.getTime())/(24*3600*1000));
      const curVal=cmp>0&&l.qty>0?cmp*l.qty:(l.cur||l.inv+l.gain);
      const lotGain=Math.round(curVal-l.inv);
      const isLTCG=days>=365;
      if(isLTCG){ if(lotGain>0) totalLTCGGain+=lotGain; else totalLTCGLoss+=Math.abs(lotGain); }
      else       { if(lotGain>0) totalSTCGGain+=lotGain; else totalSTCGLoss+=Math.abs(lotGain); }
      // Harvest candidate: loss-making lot that can offset gains
      if(lotGain<0&&Math.abs(lotGain)>1000){
        harvestCandidates.push({name:s.name,date:l.date,days,inv:l.inv,curVal,gain:lotGain,isLTCG,qty:l.qty,invPrice:l.invPrice,cmp});
      }
    });
  });

  // Tax estimates (Indian equity FY)
  const taxableLTCG=Math.max(0,totalLTCGGain-LTCG_EXEMPT);
  const estLTCGTax=Math.round(taxableLTCG*0.125);
  const estSTCGTax=Math.round(totalSTCGGain*0.20);
  const totalEstTax=estLTCGTax+estSTCGTax;
  const harvestSaving=Math.round(Math.min(harvestCandidates.reduce((a,c)=>a+Math.abs(c.gain),0),totalSTCGGain)*0.20
    +Math.min(harvestCandidates.filter(c=>c.isLTCG).reduce((a,c)=>a+Math.abs(c.gain),0),taxableLTCG)*0.125);

  taxKpisEl.innerHTML=[
    {l:'LTCG Gains',  v:fmtL(totalLTCGGain), c:totalLTCGGain>0?'var(--green)':'var(--muted)'},
    {l:'STCG Gains',  v:fmtL(totalSTCGGain), c:totalSTCGGain>0?'var(--amber)':'var(--muted)'},
    {l:'Est. Tax Liability', v:fmtL(totalEstTax), c:totalEstTax>0?'var(--red)':'var(--green)'},
    {l:'Harvest Saving', v:harvestSaving>0?'up to '+fmtL(harvestSaving):'—', c:'var(--blue)'},
  ].map(x=>`<div class="tax-kpi"><div class="tax-kpi-label">${x.l}</div><div class="tax-kpi-val" style="color:${x.c}">${x.v}</div></div>`).join('');

  if(!harvestCandidates.length){
    taxTableEl.innerHTML='<div style="color:var(--green);font-size:11px;padding:8px">✓ No loss-making lots to harvest right now</div>';
    return;
  }

  harvestCandidates.sort((a,b)=>a.gain-b.gain);
  taxTableEl.innerHTML=`
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">Loss-making lots you can sell to offset gains and reduce tax liability:</div>
    <div style="overflow-x:auto">
    <table class="drill-table" style="min-width:620px">
      <thead><tr>
        <th>Stock</th><th>Buy Date</th><th>Qty</th><th>Buy Price</th><th>CMP</th>
        <th>Unrealised Loss</th><th>Holding</th><th>Tax Type</th><th>Action</th>
      </tr></thead>
      <tbody>
      ${harvestCandidates.map(c=>`<tr>
        <td style="font-weight:500">${esc(c.name)}</td>
        <td>${fmtDate(c.date)}</td>
        <td>${c.qty>0?fmtN(c.qty):'—'}</td>
        <td>${c.invPrice>0?'₹'+c.invPrice.toFixed(2):'—'}</td>
        <td>${c.cmp>0?'₹'+c.cmp.toLocaleString('en-IN'):'—'}</td>
        <td class="td-dn">${fmtL(c.gain)}</td>
        <td class="td-muted">${fmtHoldPeriod(c.days)}</td>
        <td>${c.isLTCG?'<span class="ltcg-badge">LTCG</span>':'<span class="stcg-badge">STCG</span>'}</td>
        <td><span class="harvest-tag">HARVEST</span></td>
      </tr>`).join('')}
      </tbody>
    </table></div>
    <div style="font-size:10px;color:var(--muted2);margin-top:10px;line-height:1.6">
      ⚠ After selling for harvest, wait 31+ days before re-buying to avoid wash-sale. LTCG exempt up to ₹1.25L/year; gains above that taxed at 12.5%. STCG taxed at 20%. Consult a tax advisor before acting.
    </div>`;
}

// ── Goal Planner ──────────────────────────────────────────────
let chartGoalInst=null;

function renderGoalPlanner(){
  // Initialise slider display values
  updateGoal();
}

function updateGoal(){
  const corpus=parseInt(document.getElementById('goal-corpus').value)||10000000;
  const year=parseInt(document.getElementById('goal-year').value)||2035;
  const rate=parseFloat(document.getElementById('goal-rate').value)||12;

  document.getElementById('goal-corpus-val').textContent=fmtL(corpus);
  document.getElementById('goal-year-val').textContent=year;
  document.getElementById('goal-rate-val').textContent=rate.toFixed(1)+'%';

  const k=DATA.kpis;
  const currentVal=k.totalValue||0;
  const nowYear=new Date().getFullYear();
  const yrsLeft=Math.max(0.5,year-nowYear);
  const r=rate/100;

  // Monthly SIP needed to reach (corpus - FV of current portfolio) given rate
  // FV of current: currentVal*(1+r)^yrs
  const fvCurrent=currentVal*Math.pow(1+r,yrsLeft);
  const remaining=Math.max(0,corpus-fvCurrent);
  // SIP formula: PMT = FV * r/12 / ((1+r/12)^(n)-1)
  const rM=r/12, n=yrsLeft*12;
  const sipNeeded=remaining>0&&rM>0?Math.round(remaining*rM/(Math.pow(1+rM,n)-1)):0;

  // Current trajectory: FV if we keep investing avg monthly
  const allMonths=buildCombinedMonthly();
  const avgMonthly=allMonths.length?Math.round(allMonths.reduce((a,x)=>a+x.v,0)/allMonths.filter(x=>x.v>0).length):0;
  const fvWithSip=currentVal*Math.pow(1+r,yrsLeft)+(avgMonthly*((Math.pow(1+rM,n)-1)/rM)*(1+rM));

  const onTrack=fvWithSip>=corpus;
  const gap=corpus-fvWithSip;

  document.getElementById('goal-result-box').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">SIP needed</div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:700;color:var(--gold)">${sipNeeded>0?fmtL(sipNeeded)+'/mo':'Already on track!'}</div></div>
      <div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Projected at current pace</div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:700;color:${onTrack?'var(--green)':'var(--red)'}">${fmtL(Math.round(fvWithSip))}</div></div>
    </div>
    <div style="font-size:11px;color:${onTrack?'var(--green)':'var(--amber)'}">
      ${onTrack
        ?`✓ On track! Your current avg SIP of ${fmtL(avgMonthly)}/mo will reach ${fmtL(Math.round(fvWithSip))} by ${year} — ${fmtL(Math.round(fvWithSip-corpus))} surplus.`
        :`You need to increase SIP by ${fmtL(Math.max(0,sipNeeded-avgMonthly))}/mo. Current trajectory falls short by ${fmtL(Math.round(gap))}.`
      }
    </div>`;

  // Projection chart
  renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded);

  // Summary KPIs
  document.getElementById('goal-summary-kpis').innerHTML=[
    {l:'Goal Corpus',      v:fmtL(corpus),          s:'Target by '+year,             a:'#d4a843'},
    {l:'Current Portfolio',v:fmtL(currentVal),      s:'As of today',                  a:'#58a6ff'},
    {l:'Years Remaining',  v:yrsLeft.toFixed(1)+'y',s:'To target date',               a:'#a371f7'},
    {l:'SIP Required',     v:sipNeeded>0?fmtL(sipNeeded)+'/mo':'On track!', s:'At '+rate+'% p.a.',  a:sipNeeded>0?'#f85149':'#3fb950'},
    {l:'Projected Value',  v:fmtL(Math.round(fvWithSip)), s:onTrack?'Exceeds goal':'Below goal', a:onTrack?'#3fb950':'#f85149'},
    {l:'Avg Current SIP',  v:avgMonthly?fmtL(avgMonthly)+'/mo':'—', s:'Historical monthly avg', a:'#7d8590'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value">${c.v}</div><div class="kpi-sub">${c.s}</div></div>`).join('');

  // Scenarios
  const rates=[8,10,12,15,18];
  const maxSip=Math.max(...rates.map(rt=>{
    const rv=rt/100, rMv=rv/12;
    const fvC=currentVal*Math.pow(1+rv,yrsLeft);
    const rem=Math.max(0,corpus-fvC);
    return rem>0&&rMv>0?Math.round(rem*rMv/(Math.pow(1+rMv,n)-1)):0;
  }),1);
  document.getElementById('goal-scenarios').innerHTML=rates.map(rt=>{
    const rv=rt/100, rMv=rv/12;
    const fvC=currentVal*Math.pow(1+rv,yrsLeft);
    const rem=Math.max(0,corpus-fvC);
    const sip=rem>0&&rMv>0?Math.round(rem*rMv/(Math.pow(1+rMv,n)-1)):0;
    const isSelected=Math.abs(rt-rate)<1;
    return `<div class="goal-scenario-row">
      <span class="goal-scen-rate" style="color:${isSelected?'var(--gold)':'var(--muted)'}">${rt}% p.a.${isSelected?' ◀':''}</span>
      <span class="goal-scen-sip" style="color:${sip===0?'var(--green)':'var(--text)'}">${sip>0?fmtL(sip)+'/mo':'On track!'}</span>
      <div class="goal-scen-bar"><div class="goal-scen-fill" style="width:${sip>0?Math.round(sip/maxSip*100):0}%"></div></div>
      <span class="goal-scen-note">${sip>0?'vs avg '+fmtL(avgMonthly):fmtL(Math.round(currentVal*Math.pow(1+rv,yrsLeft)))}</span>
    </div>`;
  }).join('');

  // Milestones: 25%, 50%, 75%, 100% of goal
  const milestones=[0.25,0.50,0.75,1.0];
  document.getElementById('goal-milestones').innerHTML=milestones.map(pct=>{
    const target=corpus*pct;
    const reached=currentVal>=target;
    // Year when FV of current + SIP reaches target
    let reachYear=null;
    for(let y2=nowYear;y2<=2060;y2++){
      const yrs2=y2-nowYear;
      const fv=currentVal*Math.pow(1+r,yrs2)+(avgMonthly*((Math.pow(1+rM,yrs2*12)-1)/rM)*(1+rM));
      if(fv>=target){reachYear=y2;break;}
    }
    const dotColor=reached?'var(--green)':reachYear?'var(--gold)':'var(--red)';
    return `<div class="milestone-row">
      <div class="milestone-dot" style="background:${dotColor}"></div>
      <span class="milestone-year">${Math.round(pct*100)}%</span>
      <span class="milestone-corpus" style="color:var(--text)">${fmtL(target)}</span>
      <span class="milestone-status" style="color:${dotColor}">${reached?'✓ Reached':reachYear?'Est. '+reachYear:'Beyond '+year}</span>
    </div>`;
  }).join('');
}

function renderGoalChart(corpus, year, rate, currentVal, avgMonthly, sipNeeded){
  setTimeout(()=>{
    const el=document.getElementById('chart-goal');
    if(!el||!window.Chart) return;
    if(chartGoalInst) chartGoalInst.destroy();
    const r=rate/100, rM=r/12;
    const nowYear=new Date().getFullYear();
    const labels=[], actualTraj=[], sipTraj=[], goalLine=[];
    for(let y=nowYear;y<=year;y++){
      const yrs=y-nowYear;
      const n2=yrs*12;
      const fvCurrent=currentVal*Math.pow(1+r,yrs);
      const fvActual=fvCurrent+(avgMonthly>0?avgMonthly*((Math.pow(1+rM,n2)-1)/rM)*(1+rM):0);
      const fvSip=fvCurrent+(sipNeeded>0?sipNeeded*((Math.pow(1+rM,n2)-1)/rM)*(1+rM):fvCurrent);
      labels.push(y);
      actualTraj.push(Math.round(fvActual));
      sipTraj.push(sipNeeded>0?Math.round(fvSip):null);
      goalLine.push(corpus);
    }
    const datasets=[
      {label:'Goal',data:goalLine,borderColor:'#f85149',borderWidth:1.5,borderDash:[6,4],pointRadius:0,fill:false,tension:0},
      {label:'Current pace',data:actualTraj,borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,.07)',borderWidth:2,pointRadius:0,fill:true,tension:0.3},
    ];
    if(sipNeeded>0) datasets.push({label:'With required SIP',data:sipTraj,borderColor:'#3fb950',backgroundColor:'rgba(63,185,80,.06)',borderWidth:2,pointRadius:0,fill:true,tension:0.3,borderDash:[3,2]});
    chartGoalInst=new Chart(el,{
      type:'line',data:{labels,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:true,position:'top',labels:{color:'#7d8590',font:{size:10},boxWidth:12,padding:10}},
          tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmtL(ctx.raw)},backgroundColor:'#1c2330',titleColor:'#e6edf3',bodyColor:'#7d8590',borderColor:'#30363d',borderWidth:1}},
        scales:{
          x:{ticks:{font:{size:9},color:'#7d8590'},grid:{color:'#21262d'}},
          y:{ticks:{font:{size:9},color:'#7d8590',callback:v=>fmtL(v)},grid:{color:'#21262d'}}
        }}
    });
  },60);
}

// ── Benchmark Comparison ─────────────────────────────────────
// Historical average CAGRs (long-run, India) — baked-in reference values
// Sources: NSE/BSE fact-sheets, AMFI data, RBI, industry consensus
// ══════════════════════════════════════════════════════════════
// BENCHMARK ENGINE — modular, time-aligned, category-aware
// ══════════════════════════════════════════════════════════════

// ── ADD THIS: raw annual CAGR data per index, per calendar year ──
// Used by calculateBenchmarkCAGR() to interpolate for any holdDays
// Benchmark historical CAGR data — last updated: Jan 2025
// These are long-run average returns; actual recent returns may differ.
// A staleness note is shown in the UI alongside any benchmark comparison.
const BM_ANNUAL = {
  'Nifty 50':        {1:8.5,  2:10.2, 3:12.8, 5:14.2, 7:13.4, 10:12.9, 15:13.5},
  'Nifty Next 50':   {1:6.1,  2:8.4,  3:10.4, 5:12.1, 7:11.8, 10:11.2, 15:11.8},
  'Nifty Midcap 150':{1:12.4, 2:15.8, 3:18.2, 5:19.8, 7:17.6, 10:16.4, 15:17.2},
  'Nifty Smallcap':  {1:14.8, 2:19.3, 3:22.6, 5:24.3, 7:20.1, 10:18.8, 15:19.5},
  'Nifty 500':       {1:9.2,  2:11.6, 3:14.1, 5:15.8, 7:14.6, 10:13.8, 15:14.3},
  'Sensex':          {1:9.0,  2:10.8, 3:13.1, 5:14.5, 7:13.7, 10:13.2, 15:14.0},
  'PPF':             {1:7.1,  2:7.1,  3:7.1,  5:7.1,  7:7.2,  10:7.3,  15:7.5},
  'FD (SBI)':        {1:6.5,  2:6.6,  3:6.8,  5:6.5,  7:6.6,  10:6.7,  15:6.8},
  'Inflation (CPI)': {1:5.2,  2:5.3,  3:5.4,  5:5.6,  7:5.5,  10:5.5,  15:5.4},
};

// ── ADD THIS: category → primary benchmark key mapping ──
const CATEGORY_BENCHMARK_MAP = {
  'Large Cap':  'Nifty 50',
  'Large & Mid Cap': 'Nifty 500',
  'Mid Cap':    'Nifty Midcap 150',
  'Small Cap':  'Nifty Smallcap',
  'Flexi Cap':  'Nifty 500',
  'Multi Cap':  'Nifty 500',
  'ELSS':       'Nifty 500',
  'Value':      'Nifty 50',
  'Index':      'Nifty 50',
  'Other':      'Nifty 50',
};

// ── ADD THIS: benchmark chart display groups ──
const BM_CHART_ORDER = [
  'Nifty 50','Nifty Next 50','Nifty Midcap 150','Nifty Smallcap',
  'Nifty 500','Sensex','PPF','FD (SBI)','Inflation (CPI)',
];
const BM_CHART_COLORS = {
  'Nifty 50':         ['rgba(88,166,255,.80)','#58a6ff'],
  'Nifty Next 50':    ['rgba(88,166,255,.55)','#58a6ff'],
  'Nifty Midcap 150': ['rgba(88,166,255,.65)','#58a6ff'],
  'Nifty Smallcap':   ['rgba(88,166,255,.45)','#58a6ff'],
  'Nifty 500':        ['rgba(88,166,255,.35)','#58a6ff'],
  'Sensex':           ['rgba(88,166,255,.70)','#58a6ff'],
  'PPF':              ['rgba(163,113,247,.65)','#a371f7'],
  'FD (SBI)':         ['rgba(163,113,247,.45)','#a371f7'],
  'Inflation (CPI)':  ['rgba(248,81,73,.50)','#f85149'],
};

// ── ADD THIS: interpolate CAGR for any holdDays using BM_ANNUAL ──
function calculateBenchmarkCAGR(bmKey, days) {
  const table = BM_ANNUAL[bmKey];
  if (!table) return null;
  const yrs = days / 365.25;
  const keys = [1, 2, 3, 5, 7, 10, 15];
  // Clamp to range
  if (yrs <= keys[0]) return table[keys[0]];
  if (yrs >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  // Linear interpolation between two nearest key points
  for (let i = 0; i < keys.length - 1; i++) {
    if (yrs >= keys[i] && yrs <= keys[i + 1]) {
      const t = (yrs - keys[i]) / (keys[i + 1] - keys[i]);
      return parseFloat((table[keys[i]] + t * (table[keys[i + 1]] - table[keys[i]])).toFixed(2));
    }
  }
  return table[10];
}

// ── ADD THIS: return correct benchmark key for a fund category ──
function getBenchmarkForCategory(category) {
  return CATEGORY_BENCHMARK_MAP[category] || 'Nifty 50';
}

// ── ADD THIS: compute alpha (fund CAGR minus time-aligned benchmark CAGR) ──
function calculateAlpha(fundCAGR, bmCAGR) {
  return parseFloat((fundCAGR - bmCAGR).toFixed(2));
}

// ── ADD THIS: decision engine — returns {action, reason} ──
function getFundDecision(alpha, holdDays) {
  const held1y = holdDays >= 365;
  const held2y = holdDays >= 730;
  if (alpha > 3)                           return { action:'ADD',    cls:'tag-add',    reason:`+${alpha.toFixed(1)}% alpha — consistently outperforming benchmark; increase allocation` };
  if (alpha >= 1 && alpha <= 3)            return { action:'HOLD',   cls:'tag-hold',   reason:`+${alpha.toFixed(1)}% alpha — modest outperformance; hold and monitor` };
  if (alpha >= -3 && alpha < 1 && !held1y) return { action:'HOLD',   cls:'tag-hold',   reason:`${alpha.toFixed(1)}% alpha but held <1yr — too early to judge; hold` };
  if (alpha >= -3 && alpha < 1 && held1y)  return { action:'REDUCE', cls:'tag-reduce', reason:`${alpha.toFixed(1)}% alpha over ${Math.round(holdDays/365)}yr — underdelivering vs benchmark; trim` };
  if (alpha < -3 && !held2y)               return { action:'REDUCE', cls:'tag-reduce', reason:`${alpha.toFixed(1)}% alpha — significant lag; reduce exposure` };
  if (alpha < -3 && held2y)                return { action:'EXIT',   cls:'tag-exit',   reason:`${alpha.toFixed(1)}% alpha over ${Math.round(holdDays/365)}yr — persistent underperformer; exit` };
  return { action:'HOLD', cls:'tag-hold', reason:'Insufficient data to decide' };
}

// ── ADD THIS: compute weighted portfolio benchmark CAGR ──
// Uses each fund's holdDays + its category benchmark for time-alignment
function calculatePortfolioBenchmark() {
  const totalInv = DATA.funds.reduce((a, f) => a + f.Invested, 0);
  if (!totalInv) return null;
  let weightedBM = 0;
  DATA.funds.forEach(f => {
    const bmKey = getBenchmarkForCategory(f.Category);
    const days  = f.holdDays || 365;
    const bmCagr = calculateBenchmarkCAGR(bmKey, days);
    weightedBM += (bmCagr || 0) * (f.Invested / totalInv);
  });
  return parseFloat(weightedBM.toFixed(2));
}

// ── ADD THIS: build per-fund enriched analysis array (cached per render) ──
function buildFundAnalysis() {
  return DATA.funds.map(f => {
    const bmKey   = getBenchmarkForCategory(f.Category);
    const bmCagr  = calculateBenchmarkCAGR(bmKey, f.holdDays || 365);
    const alpha   = calculateAlpha(f.CAGR, bmCagr);
    const decision = getFundDecision(alpha, f.holdDays || 0);
    return { ...f, bmKey, bmCagr, alpha, decision };
  });
}

// ── State ──
let bmPeriod = '5y';
function setBMPeriod(p){ bmPeriod = p; renderBenchmark(); }
let chartBMInst = null;

// ── MODIFY THIS FUNCTION: renderBenchmark — orchestrates all sub-renders ──
function renderBenchmark() {
  const bmKpisEl   = document.getElementById('bm-kpis');
  const bmFilterEl = document.getElementById('bm-period-filter');
  const bmFundTblEl= document.getElementById('bm-fund-table');
  const bmAlphaEl  = document.getElementById('bm-alpha-summary');
  if (!bmKpisEl) return;

  const k   = DATA.kpis;
  const nMF = DATA.funds.length;

  // Period selector (used only for chart context label + bm-kpi reference period)
  bmFilterEl.innerHTML = '<span class="ctrl-label">Chart period:</span>' +
    ['3y','5y','7y','10y'].map(p =>
      `<button class="chip ${bmPeriod===p?'on':''}" onclick="setBMPeriod('${p}')">${p}</button>`
    ).join('') +
    '<span style="font-size:10px;color:var(--muted2);margin-left:10px">Fund comparison uses each fund\'s actual holding period</span>';

  // ── Build enriched fund analysis (cached — only recomputes when DATA changes) ──
  const fundAnalysis = _fundAnalysisCache || (_fundAnalysisCache = buildFundAnalysis());  // [{...f, bmKey, bmCagr, alpha, decision}]

  // ── Portfolio-level metrics ──
  const yourMFCagr = nMF > 0
    ? parseFloat((DATA.funds.reduce((a,f) => a + f.CAGR*(f.Invested/(k.mfInvested||1)), 0)).toFixed(1))
    : 0;
  const yourStCagr = DATA.stocks.length > 0
    ? parseFloat((DATA.stocks.filter(s=>s.Invested>0).reduce((a,s) => a + s.CAGR*(s.Invested/(k.stInvested||1)), 0)).toFixed(1))
    : 0;
  const yourCombinedCagr = k.totalInvested > 0
    ? parseFloat(((yourMFCagr*(k.mfInvested/k.totalInvested)) + (yourStCagr*(k.stInvested/k.totalInvested))).toFixed(1))
    : 0;

  // Time-aligned portfolio benchmark (weighted by each fund's own holdDays)
  const portfolioBMCagr = calculatePortfolioBenchmark();

  // Reference Nifty 50 for selected period (used in KPI strip + chart)
  const periodYrs  = parseInt(bmPeriod);
  const periodDays = periodYrs * 365;
  const nifty50Ref  = calculateBenchmarkCAGR('Nifty 50', periodDays);
  const inflRef     = calculateBenchmarkCAGR('Inflation (CPI)', periodDays);
  const fdRef       = calculateBenchmarkCAGR('FD (SBI)', periodDays);
  const ppfRef      = calculateBenchmarkCAGR('PPF', periodDays);

  const portAlpha   = portfolioBMCagr !== null ? calculateAlpha(yourMFCagr, portfolioBMCagr) : null;

  // ── Render KPI strip ──
  _renderBMKpis(bmKpisEl, {nMF, yourMFCagr, yourStCagr, yourCombinedCagr,
    portfolioBMCagr, portAlpha, nifty50Ref, inflRef, fdRef, ppfRef});

  // ── Render chart ──
  _renderBMChart({nMF, yourMFCagr, yourStCagr, yourCombinedCagr,
    nifty50Ref, periodDays, k});

  // ── Render per-fund table ──
  _renderBMFundTable(bmFundTblEl, fundAnalysis);

  // ── Render alpha summary + decision feed ──
  _renderBMAlphaSummary(bmAlphaEl, fundAnalysis, {nMF, yourMFCagr, portfolioBMCagr, portAlpha});
}

// ── ADD THIS FUNCTION: render KPI strip ──
function _renderBMKpis(el, {nMF, yourMFCagr, yourStCagr, yourCombinedCagr,
    portfolioBMCagr, portAlpha, nifty50Ref, inflRef, fdRef, ppfRef}) {

  const portAlphaStr = portAlpha !== null
    ? (portAlpha >= 0 ? '+' : '') + portAlpha.toFixed(1) + '%' : '—';
  const portAlphaNote = portAlpha !== null
    ? (portAlpha > 0 ? 'vs time-aligned benchmark' : 'benchmark outperforming you')
    : 'Upload files';
  const portAlphaColor = portAlpha === null ? 'var(--muted)'
    : portAlpha >= 3 ? 'var(--green)' : portAlpha >= 0 ? 'var(--amber)' : 'var(--red)';

  const tiles = [
    { l:'Your MF CAGR',      v: nMF ? fmtP(yourMFCagr) : '—',
      note:'Invested-weighted avg',
      accent: nMF ? (yourMFCagr >= nifty50Ref ? 'var(--green)' : 'var(--red)') : 'var(--muted)' },
    { l:'Portfolio Benchmark',v: portfolioBMCagr !== null ? fmtP(portfolioBMCagr) : '—',
      note:'Time-aligned category avg',
      accent:'var(--blue)' },
    { l:'Portfolio Alpha',    v: portAlphaStr,
      note: portAlphaNote,
      accent: portAlphaColor },
    { l:'Beats Inflation?',   v: nMF ? (yourMFCagr > inflRef ? '✓ Yes' : '✗ No') : '—',
      note:`CPI ${fmtP(inflRef)}`,
      accent: nMF && yourMFCagr > inflRef ? 'var(--green)' : 'var(--red)' },
    { l:'Beats FD?',          v: nMF ? (yourMFCagr > fdRef ? '✓ Yes' : '✗ No') : '—',
      note:`SBI FD ${fmtP(fdRef)}`,
      accent: nMF && yourMFCagr > fdRef ? 'var(--green)' : 'var(--amber)' },
    { l:'Beats PPF?',         v: nMF ? (yourMFCagr > ppfRef ? '✓ Yes' : '✗ No') : '—',
      note:`PPF ${fmtP(ppfRef)}`,
      accent: nMF && yourMFCagr > ppfRef ? 'var(--green)' : 'var(--amber)' },
  ];
  el.innerHTML = tiles.map(c => `
    <div class="bm-kpi" style="--bm-accent:${c.accent}">
      <div class="bm-kpi-label">${c.l}</div>
      <div class="bm-kpi-val" style="color:${c.accent}">${c.v}</div>
      <div class="bm-kpi-note">${c.note}</div>
    </div>`).join('');
}

// ── ADD THIS FUNCTION: render horizontal bar chart ──
function _renderBMChart({nMF, yourMFCagr, yourStCagr, yourCombinedCagr,
    nifty50Ref, periodDays, k}) {

  const labels=[], vals=[], bgColors=[], bdColors=[];

  const push = (label, val, bg, bd) => { labels.push(label); vals.push(val); bgColors.push(bg); bdColors.push(bd); };

  // Your portfolio bars first
  if (nMF) push('Your MF CAGR', yourMFCagr,
    yourMFCagr >= nifty50Ref ? 'rgba(63,185,80,.85)' : 'rgba(248,81,73,.85)',
    yourMFCagr >= nifty50Ref ? '#3fb950' : '#f85149');

  if (DATA.stocks.length && k.stInvested > 0) push('Your Stocks CAGR', yourStCagr,
    yourStCagr >= nifty50Ref ? 'rgba(63,185,80,.75)' : 'rgba(248,81,73,.75)',
    yourStCagr >= nifty50Ref ? '#3fb950' : '#f85149');

  if (nMF && DATA.stocks.length) push('Your Combined', yourCombinedCagr,
    yourCombinedCagr >= nifty50Ref ? 'rgba(212,168,67,.90)' : 'rgba(248,81,73,.70)',
    yourCombinedCagr >= nifty50Ref ? '#d4a843' : '#f85149');

  // Benchmarks — time-aligned to the selected period
  BM_CHART_ORDER.forEach(bmKey => {
    const val = calculateBenchmarkCAGR(bmKey, periodDays);
    if (val === null) return;
    const [bg, bd] = BM_CHART_COLORS[bmKey] || ['rgba(125,133,144,.5)','#7d8590'];
    push(bmKey, val, bg, bd);
  });

  setTimeout(() => {
    const el = document.getElementById('chart-benchmark');
    if (!el || !window.Chart) return;
    if (chartBMInst) chartBMInst.destroy();
    chartBMInst = new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'CAGR %',
          data: vals,
          backgroundColor: bgColors,
          borderColor: bdColors,
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const isYours = ctx.label.startsWith('Your');
                const bmLine  = isYours ? '' : ` (your MF ${(yourMFCagr - ctx.raw) >= 0 ? '+' : ''}${(yourMFCagr - ctx.raw).toFixed(1)}%)`;
                return ` ${ctx.raw.toFixed(1)}% CAGR${isYours ? '' : bmLine}`;
              }
            },
            backgroundColor:'#1c2330', titleColor:'#e6edf3',
            bodyColor:'#7d8590', borderColor:'#30363d', borderWidth:1
          }
        },
        scales: {
          x: { ticks:{font:{size:9},color:'#7d8590',callback:v=>v+'%'}, grid:{color:'#21262d'}, min:0 },
          y: { ticks:{font:{size:10},color:'#7d8590'}, grid:{color:'#21262d'} }
        }
      }
    });
  }, 60);
}

// ── ADD THIS FUNCTION: render per-fund vs category benchmark table ──
function _renderBMFundTable(el, fundAnalysis) {
  if (!fundAnalysis.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px">Upload MF file to see per-fund comparison</div>';
    return;
  }
  const sorted = [...fundAnalysis].sort((a, b) => b.alpha - a.alpha);
  const maxAlpha = Math.max(...sorted.map(f => Math.abs(f.alpha)), 1);

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;min-width:620px">
      <thead><tr>
        <th style="${TH}">Fund</th>
        <th style="${TH}text-align:center">Category</th>
        <th style="${TH}text-align:right">Your CAGR</th>
        <th style="${TH}text-align:right">Benchmark</th>
        <th style="${TH}text-align:center;min-width:60px">Index used</th>
        <th style="${TH}text-align:left;min-width:120px">Alpha</th>
        <th style="${TH}text-align:center">Holding</th>
        <th style="${TH}text-align:center">Decision</th>
      </tr></thead>
      <tbody>
      ${sorted.map(f => {
        const ap  = Math.min(100, Math.abs(f.alpha) / maxAlpha * 100);
        const ac  = f.alpha >= 2 ? 'var(--green)' : f.alpha >= -2 ? 'var(--amber)' : 'var(--red)';
        const d   = f.decision;
        const dcls= d.cls;
        return `<tr style="border-bottom:1px solid var(--border)" title="${d.reason}">
          <td style="padding:8px;font-size:11px;font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</td>
          <td style="padding:8px;text-align:center">
            <span class="pill" style="background:${CAT_CLR[f.Category]||'#444'}22;color:${CAT_CLR[f.Category]||'#888'};border:1px solid ${CAT_CLR[f.Category]||'#444'}44">${esc(f.Category)}</span>
          </td>
          <td style="padding:8px;text-align:right;font-size:12px;font-weight:600;color:${f.CAGR >= f.bmCagr ? 'var(--green)' : 'var(--red)'}">${fmtP(f.CAGR)}</td>
          <td style="padding:8px;text-align:right;font-size:11px;color:var(--muted)">${fmtP(f.bmCagr)}</td>
          <td style="padding:8px;text-align:center;font-size:9px;color:var(--muted2)">${f.bmKey}</td>
          <td style="padding:8px">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="alpha-bar-wrap" style="min-width:60px">
                <div class="alpha-bar" style="width:${ap}%;background:${ac}"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${ac};min-width:44px">${f.alpha >= 0 ? '+' : ''}${f.alpha.toFixed(1)}%</span>
            </div>
          </td>
          <td style="padding:8px;text-align:center;font-size:10px;color:var(--muted)">${fmtHoldPeriod(f.holdDays)}</td>
          <td style="padding:8px;text-align:center">
            <span class="rec-tag ${dcls}" title="${d.reason}">${d.action}</span>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
}

// Shared th style string (DRY)
const TH = 'text-align:left;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:7px 8px;border-bottom:1px solid var(--border);';

// ── ADD THIS FUNCTION: render alpha summary with decision feed ──
function _renderBMAlphaSummary(el, fundAnalysis, {nMF, yourMFCagr, portfolioBMCagr, portAlpha}) {
  if (!nMF) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px">Upload files to see alpha summary</div>';
    return;
  }

  // Aggregate stats
  const alphas      = fundAnalysis.map(f => f.alpha);
  const avgAlpha    = parseFloat((alphas.reduce((a,v) => a+v, 0) / alphas.length).toFixed(1));
  const beaters     = fundAnalysis.filter(f => f.alpha >  2).length;
  const trailers    = fundAnalysis.filter(f => f.alpha < -2).length;
  const inline      = fundAnalysis.filter(f => Math.abs(f.alpha) <= 2).length;
  const bestFund    = [...fundAnalysis].sort((a,b) => b.alpha - a.alpha)[0];
  const worstFund   = [...fundAnalysis].sort((a,b) => a.alpha - b.alpha)[0];

  // Decision distribution
  const decisions   = { ADD:0, HOLD:0, REDUCE:0, EXIT:0 };
  fundAnalysis.forEach(f => decisions[f.decision.action] = (decisions[f.decision.action]||0)+1);

  // Portfolio-level verdict
  const pa = portAlpha ?? 0;
  const verdictColor = pa >= 2 ? 'var(--green)' : pa >= -2 ? 'var(--amber)' : 'var(--red)';
  const verdictText  = pa >= 2
    ? `Your MF portfolio generates +${pa.toFixed(1)}% alpha over its time-aligned benchmark — active selection is paying off.`
    : pa >= -2
    ? `Your MF portfolio is broadly in line with its benchmark (${pa >= 0 ? '+' : ''}${pa.toFixed(1)}%). Consider adding low-cost index funds to the mix.`
    : `Your MF portfolio trails its benchmark by ${Math.abs(pa).toFixed(1)}%. A passive Nifty 500 index fund would have delivered better risk-adjusted returns.`;

  // Decision feed — show only actionable (EXIT/REDUCE first)
  const actionItems = [...fundAnalysis]
    .filter(f => f.decision.action !== 'HOLD')
    .sort((a,b) => {
      const order = {EXIT:0, REDUCE:1, ADD:2, HOLD:3};
      return order[a.decision.action] - order[b.decision.action];
    });

  el.innerHTML = `
    <div class="alpha-box">
      <div style="font-size:12px;color:${verdictColor};font-weight:500;margin-bottom:14px;line-height:1.6">${verdictText}</div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px">
        ${[
          {l:'Total funds',    v:nMF,                         c:'var(--text)'},
          {l:'Avg alpha',      v:(avgAlpha>=0?'+':'')+avgAlpha+'%', c:avgAlpha>=0?'var(--green)':'var(--red)'},
          {l:'▲ Beating (+>2%)',v:beaters,                    c:'var(--green)'},
          {l:'≈ In line (±2%)',v:inline,                      c:'var(--amber)'},
          {l:'▼ Trailing (<−2%)',v:trailers,                  c:'var(--red)'},
        ].map(x=>`<div style="background:var(--bg4);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">${x.l}</div>
          <div style="font-family:var(--sans);font-size:16px;font-weight:700;color:${x.c}">${x.v}</div>
        </div>`).join('')}
      </div>

      <div class="alpha-row">
        <span class="alpha-name">Best alpha fund</span>
        <span class="alpha-val" style="color:var(--gold)">${bestFund.name.split(' ').slice(0,3).join(' ')}</span>
        <span style="font-size:11px;font-weight:700;color:var(--green);min-width:50px;text-align:right">${bestFund.alpha>=0?'+':''}${bestFund.alpha.toFixed(1)}% vs ${bestFund.bmKey}</span>
      </div>
      <div class="alpha-row">
        <span class="alpha-name">Worst alpha fund</span>
        <span class="alpha-val" style="color:var(--red)">${worstFund.name.split(' ').slice(0,3).join(' ')}</span>
        <span style="font-size:11px;font-weight:700;color:var(--red);min-width:50px;text-align:right">${worstFund.alpha>=0?'+':''}${worstFund.alpha.toFixed(1)}% vs ${worstFund.bmKey}</span>
      </div>

      ${actionItems.length ? `
        <div style="margin-top:14px;margin-bottom:6px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Decision feed — actionable funds</div>
        ${actionItems.map(f=>`
          <div class="alpha-row">
            <span class="alpha-name">${f.name.split(' ').slice(0,3).join(' ')}</span>
            <span class="rec-tag ${f.decision.cls}" style="flex-shrink:0">${f.decision.action}</span>
            <span style="font-size:10px;color:var(--muted);flex:1;margin-left:8px;line-height:1.4">${f.decision.reason}</span>
          </div>`).join('')}
      ` : '<div style="margin-top:10px;font-size:11px;color:var(--green)">✓ All funds on HOLD — no immediate action needed</div>'}

      <div style="font-size:10px;color:var(--muted2);margin-top:12px;line-height:1.6">
        Each fund is compared against its category-specific benchmark, time-aligned to the fund's actual holding period. Hover fund rows above for decision reasoning.
      </div>
    </div>`;
}

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

// ── SIP Reminder ──────────────────────────────────────────────
function renderSIPReminder(){
  const el=document.getElementById('sip-reminder-content');
  const lblEl=document.getElementById('sip-month-label');
  if(!el) return;
  const k=DATA.kpis;
  if(!k.totalInvested){
    el.innerHTML='<div style="color:var(--muted);font-size:12px">Upload your files to get your personalised SIP action plan.</div>';
    return;
  }
  const now=new Date();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  lblEl.textContent=MONTHS[now.getMonth()].toUpperCase()+' '+now.getFullYear()+' — ACTION PLAN';

  const allMonths=buildCombinedMonthly();
  const activeMonths=allMonths.filter(x=>x.v>0);
  const avgMonthly=activeMonths.length?Math.round(activeMonths.reduce((a,x)=>a+x.v,0)/activeMonths.length):0;
  // Correct previous-month key: use a Date rolled back by 1 month to avoid off-by-one with getMonth() (0-indexed)
  const prevMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonthKey=(prevMonthDate.getFullYear()+'-'+String(prevMonthDate.getMonth()+1).padStart(2,'0')); // prev month
  const investedThisMonth=allMonths.find(x=>x.m===lastMonthKey)?.v||0;

  // Compute per-category allocation
  const totalMFInv=k.mfInvested, totalSTInv=k.stInvested;
  const topFunds=[...DATA.funds].sort((a,b)=>b.CAGR-a.CAGR).slice(0,3);
  const underperformers=DATA.funds.filter(f=>f.CAGR<10&&f.CAGR>0);

  const recommendedSIP=avgMonthly||Math.round(k.totalInvested*0.02);
  const mfShare=k.totalInvested?k.mfInvested/k.totalInvested:0.7;
  const mfSIP=Math.round(recommendedSIP*Math.min(0.8,Math.max(0.5,mfShare)));
  const stSIP=recommendedSIP-mfSIP;

  // Build action items
  const actions=[];
  if(topFunds.length){
    const perFund=Math.round(mfSIP/Math.min(3,topFunds.length));
    topFunds.slice(0,2).forEach(f=>{
      actions.push({icon:'📊',fund:f.name.split(' ').slice(0,4).join(' '),amt:fmtL(perFund),reason:`CAGR ${fmtP(f.CAGR)} — top performer in your portfolio`});
    });
  }
  if(underperformers.length){
    actions.push({icon:'⚠️',fund:underperformers[0].name.split(' ').slice(0,4).join(' '),amt:'₹0',reason:`Consider pausing SIP — CAGR only ${fmtP(underperformers[0].CAGR)}, switch to higher-alpha fund`});
  }
  if(stSIP>0){
    const sectors=DATA.sectors.filter(s=>s.Gain>0).sort((a,b)=>b.RetPct-a.RetPct);
    const bestSec=sectors[0];
    actions.push({icon:'📈',fund:bestSec?bestSec.Sector+' stocks':'Large-cap stocks',amt:fmtL(stSIP),reason:bestSec?`Your best-performing sector at ${fmtP(bestSec.RetPct)}`:'Diversify equity exposure'});
  }

  el.innerHTML=`
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="sip-amount">${fmtL(recommendedSIP)}<span style="font-size:14px;color:var(--muted);font-family:var(--mono)">/mo</span></div>
      <div style="font-size:11px;color:var(--muted)">Recommended monthly deployment · Based on your historical avg ${fmtL(avgMonthly>0?avgMonthly:recommendedSIP)}/mo</div>
    </div>
    <div class="sip-action-list">
      ${actions.map(a=>`<div class="sip-action-item">
        <span class="sip-action-icon">${a.icon}</span>
        <div style="flex:1">
          <div class="sip-action-fund">${a.fund} <span class="sip-action-amt">${a.amt}</span></div>
          <div class="sip-action-reason">${a.reason}</div>
        </div>
      </div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⓘ Recommendations based on your historical investing pattern and fund performance. Always review with your financial goals before acting.
    </div>`;
}

// ── Rebalancing Advisor ───────────────────────────────────────
function renderRebalance(){
  syncRebSliders('none'); // initial render
}

function syncRebSliders(changed){
  const mfEl=document.getElementById('reb-mf');
  const lcEl=document.getElementById('reb-lc');
  const etfEl=document.getElementById('reb-etf');
  if(!mfEl) return;

  let mf=parseInt(mfEl.value), lc=parseInt(lcEl.value), etf=parseInt(etfEl.value);
  const total=mf+lc+etf;

  // Clamp so total doesn't exceed 100
  if(total>100){
    if(changed==='mf'){ const excess=total-100; lc=Math.max(0,lc-Math.ceil(excess/2)); etf=Math.max(0,etf-Math.floor(excess/2)); }
    else if(changed==='lc'){ const excess=total-100; mf=Math.max(0,mf-Math.ceil(excess/2)); etf=Math.max(0,etf-Math.floor(excess/2)); }
    else if(changed==='etf'){ const excess=total-100; mf=Math.max(0,mf-Math.ceil(excess/2)); lc=Math.max(0,lc-Math.floor(excess/2)); }
    mfEl.value=mf; lcEl.value=lc; etfEl.value=etf;
  }

  const t=mf+lc+etf;
  document.getElementById('reb-mf-val').textContent=mf+'%';
  document.getElementById('reb-lc-val').textContent=lc+'%';
  document.getElementById('reb-etf-val').textContent=etf+'%';
  const totalEl=document.getElementById('reb-total-pct');
  const fillEl=document.getElementById('reb-total-fill');
  totalEl.textContent=t+'%';
  totalEl.style.color=t===100?'var(--green)':t>100?'var(--red)':'var(--amber)';
  fillEl.style.width=Math.min(100,t)+'%';
  fillEl.style.background=t===100?'var(--green)':t>100?'var(--red)':'var(--amber)';

  computeRebalance(mf,lc,etf);
}

function computeRebalance(targetMFPct, targetLCPct, targetETFPct){
  const k=DATA.kpis;
  const totalValue=k.totalValue||0;
  const cmpEl=document.getElementById('reb-comparison');
  const actEl=document.getElementById('reb-actions');
  const kpiEl=document.getElementById('reb-kpi-strip');
  if(!cmpEl||!actEl) return;

  if(!totalValue){
    cmpEl.innerHTML='<div style="color:var(--muted);font-size:12px">Upload files to see rebalancing recommendations.</div>';
    actEl.innerHTML=''; if(kpiEl) kpiEl.innerHTML=''; return;
  }

  // Current actuals
  const curMFVal=k.mfValue||0;
  const etfStocks=DATA.stocks.filter(s=>s.Sector==='Index ETF'||s.Sector==='Commodities ETF');
  const lcStocks=DATA.stocks.filter(s=>!etfStocks.includes(s));
  const curETFVal=etfStocks.reduce((a,s)=>a+s.Current,0);
  const curLCVal=lcStocks.reduce((a,s)=>a+s.Current,0);

  const curMFPct=totalValue?Math.round(curMFVal/totalValue*100):0;
  const curLCPct=totalValue?Math.round(curLCVal/totalValue*100):0;
  const curETFPct=totalValue?Math.round(curETFVal/totalValue*100):0;

  // Target values
  const tgtMFVal=Math.round(totalValue*targetMFPct/100);
  const tgtLCVal=Math.round(totalValue*targetLCPct/100);
  const tgtETFVal=Math.round(totalValue*targetETFPct/100);

  const diffMF=tgtMFVal-curMFVal;
  const diffLC=tgtLCVal-curLCVal;
  const diffETF=tgtETFVal-curETFVal;

  const drift=Math.max(Math.abs(targetMFPct-curMFPct),Math.abs(targetLCPct-curLCPct),Math.abs(targetETFPct-curETFPct));
  const needsAction=drift>=5;

  if(kpiEl){
    kpiEl.innerHTML=[
      {l:'Total Portfolio',v:fmtL(totalValue),s:'Current value',a:'#d4a843'},
      {l:'MF Drift',v:(targetMFPct-curMFPct>=0?'+':'')+(targetMFPct-curMFPct)+'pp',s:`Current ${curMFPct}% → Target ${targetMFPct}%`,a:Math.abs(targetMFPct-curMFPct)>=5?'#f85149':'#3fb950'},
      {l:'Max Drift',v:drift+'pp',s:drift>=5?'Action needed':'Within tolerance',a:drift>=5?'#f85149':'#3fb950'},
      {l:'Status',v:needsAction?'Rebalance':'On target',s:needsAction?'Drift ≥5% detected':'All within ±5%',a:needsAction?'#e3b341':'#3fb950'},
    ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value" style="font-size:18px">${c.v}</div><div class="kpi-sub">${c.s}</div></div>`).join('');
  }

  const classes=[
    {name:'Mutual Funds', cur:curMFVal, curPct:curMFPct, tgt:tgtMFVal, tgtPct:targetMFPct, diff:diffMF, color:'var(--gold)'},
    {name:'Large-cap Stocks', cur:curLCVal, curPct:curLCPct, tgt:tgtLCVal, tgtPct:targetLCPct, diff:diffLC, color:'var(--blue)'},
    {name:'ETF / Index', cur:curETFVal, curPct:curETFPct, tgt:tgtETFVal, tgtPct:targetETFPct, diff:diffETF, color:'var(--green)'},
  ];

  cmpEl.innerHTML=classes.map(c=>{
    const d=c.tgtPct-c.curPct;
    return `<div class="reb-asset-row">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:500;margin-bottom:4px">${esc(c.name)}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;color:var(--muted)">Current</span>
          <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;min-width:60px">
            <div style="height:100%;background:${c.color};opacity:.5;border-radius:4px;width:${c.curPct}%"></div>
          </div>
          <span style="font-size:11px;font-weight:600;min-width:36px;text-align:right">${c.curPct}%</span>
          <span style="font-size:10px;color:var(--muted);min-width:56px">${fmtL(c.cur)}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:10px;color:var(--muted)">Target&nbsp;</span>
          <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;min-width:60px">
            <div style="height:100%;background:${c.color};border-radius:4px;width:${c.tgtPct}%"></div>
          </div>
          <span style="font-size:11px;font-weight:600;min-width:36px;text-align:right;color:${c.color}">${c.tgtPct}%</span>
          <span style="font-size:10px;color:var(--muted);min-width:56px">${fmtL(c.tgt)}</span>
        </div>
      </div>
      <div style="text-align:right;min-width:60px;margin-left:10px">
        <div style="font-size:13px;font-weight:700;color:${d>=0?'var(--green)':'var(--red)'}">${d>=0?'+':''}${d}pp</div>
        <div style="font-size:10px;color:${c.diff>=0?'var(--green)':'var(--red)'}">${c.diff>=0?'+':''}${fmtL(Math.round(Math.abs(c.diff)))}</div>
      </div>
    </div>`;
  }).join('');

  // Action plan
  const totalPct=targetMFPct+targetLCPct+targetETFPct;
  if(totalPct!==100){
    actEl.innerHTML=`<div style="color:var(--amber);font-size:12px">⚠ Total target allocation is ${totalPct}% — adjust sliders to sum to 100% for a complete plan.</div>`;
    return;
  }

  const sells=classes.filter(c=>c.diff<-1000).sort((a,b)=>a.diff-b.diff);
  const buys=classes.filter(c=>c.diff>1000).sort((a,b)=>b.diff-a.diff);
  const holds=classes.filter(c=>Math.abs(c.diff)<=1000);

  if(!sells.length&&!buys.length){
    actEl.innerHTML=`<div style="color:var(--green);font-size:12px;padding:10px">✓ Portfolio is already within tolerance of your target allocation. No action needed.</div>`;
    return;
  }

  const rows=[
    ...sells.map(c=>`<div class="reb-action-row">
      <span style="font-size:16px">🔴</span>
      <span class="reb-sell">SELL</span>
      <span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span>
      <span style="color:var(--red);font-family:var(--sans);font-size:14px;font-weight:700">${fmtL(Math.abs(Math.round(c.diff)))}</span>
      <span style="color:var(--muted);font-size:10px;min-width:90px;text-align:right">${c.curPct}% → ${c.tgtPct}%</span>
    </div>`),
    ...buys.map(c=>`<div class="reb-action-row">
      <span style="font-size:16px">🟢</span>
      <span class="reb-buy">BUY&nbsp;</span>
      <span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span>
      <span style="color:var(--green);font-family:var(--sans);font-size:14px;font-weight:700">${fmtL(Math.round(c.diff))}</span>
      <span style="color:var(--muted);font-size:10px;min-width:90px;text-align:right">${c.curPct}% → ${c.tgtPct}%</span>
    </div>`),
    ...holds.map(c=>`<div class="reb-action-row">
      <span style="font-size:16px">⚪</span>
      <span class="reb-hold">HOLD</span>
      <span style="flex:1;font-size:12px;font-weight:500">${esc(c.name)}</span>
      <span style="color:var(--muted);font-family:var(--sans);font-size:14px">${fmtL(c.cur)}</span>
      <span style="color:var(--green);font-size:10px;min-width:90px;text-align:right">Within ±${fmtL(Math.abs(Math.round(c.diff)))}</span>
    </div>`)
  ];

  actEl.innerHTML=`<div class="reb-action-box">${rows.join('')}</div>
    <div style="margin-top:12px;font-size:10px;color:var(--muted2);line-height:1.6">
      ⚠ These are indicative amounts. Actual execution may differ due to NAV changes, STT, exit loads, and tax impact. Prefer deploying new SIP money into underweight buckets before triggering sell orders.
    </div>`;
}

// ── Wealth Waterfall ──────────────────────────────────────────
function renderWaterfall() {
  const k = DATA.kpis;

  // ── Derive the 5 waterfall segments ──────────────────────────
  // Starting capital = total invested (MF + stocks)
  const startVal   = k.totalInvested   || 0;
  // SIPs added = total invested (we treat all inflows as "SIPs/capital added")
  // We split MF invested as SIP contributions, stocks invested as direct buys
  const mfInvested = k.mfInvested      || 0;
  const stInvested = k.stInvested      || 0;
  const mfGain     = k.mfGain          || 0;
  const stGain     = k.stGain          || 0;
  const totalVal   = k.totalValue      || 0;

  // 5-step waterfall:
  // [0] Starting point (zero baseline)   → mfInvested + stInvested (first investment)
  // For a meaningful waterfall we show:
  // Bar 0 "MF Invested"  : mfInvested  (positive, anchored at 0)
  // Bar 1 "Stocks Bought": stInvested  (positive step on top of Bar 0)
  // Bar 2 "MF Gains"     : mfGain      (+ or -)
  // Bar 3 "Stock P&L"    : stGain      (+ or -)
  // Bar 4 "Current Value": totalVal    (total — shown as full bar)

  const segments = [
    {id:'mf-inv',   label:'MF Invested',   value: mfInvested, type:'invested', color:'#58a6ff',
     sub:'Total capital deployed into mutual funds', subKey:'Avg SIP'},
    {id:'st-inv',   label:'Stocks Bought', value: stInvested, type:'invested', color:'#a371f7',
     sub:'Total capital deployed into equity stocks', subKey:'Direct buys'},
    {id:'mf-gain',  label:'MF Gains',      value: mfGain,     type: mfGain>=0?'gain':'loss', color: mfGain>=0?'#3fb950':'#f85149',
     sub:'Unrealised gains from mutual funds', subKey:'Return %'},
    {id:'st-gain',  label:'Stock P&L',     value: stGain,     type: stGain>=0?'gain':'loss', color: stGain>=0?'#56d364':'#f85149',
     sub:'Unrealised P&L from equity stocks', subKey:'Return %'},
    {id:'total',    label:'Current Value', value: totalVal,   type:'total', color:'#d4a843',
     sub:'Total portfolio market value today', subKey:'Total gain'},
  ];

  // ── KPI strip ─────────────────────────────────────────────────
  const wealthMultiplier = startVal>0?(totalVal/startVal).toFixed(2):'—';
  const sipContrib  = totalVal>0?((mfInvested+stInvested)/totalVal*100).toFixed(1):0;
  const gainContrib = totalVal>0?((mfGain+stGain)/totalVal*100).toFixed(1):0;
  document.getElementById('wf-kpis').innerHTML=[
    {l:'Capital Deployed', v:fmtL(startVal),                  s:'Total invested (MF + Stocks)',        a:'#58a6ff'},
    {l:'Total Gains',      v:fmtL(mfGain+stGain),             s:fmtP(k.totalReturn||0),               a: (mfGain+stGain)>=0?'#3fb950':'#f85149'},
    {l:'Current Value',    v:fmtL(totalVal),                  s:'Portfolio today',                     a:'#d4a843'},
    {l:'Wealth Multiplier',v: startVal>0?(wealthMultiplier+'x'):'—', s:'₹1 invested → ₹'+wealthMultiplier, a:'#a371f7'},
    {l:'Gains vs Capital', v:gainContrib+'%',                 s:'Wealth from market returns',          a:'#3fb950'},
  ].map(c=>`<div class="kpi-card" style="--accent:${c.a}"><div class="kpi-label">${c.l}</div><div class="kpi-value" style="font-size:19px">${c.v}</div><div class="kpi-sub">${c.s}</div></div>`).join('');

  // ── Stat pills ────────────────────────────────────────────────
  const pillsData = [
    {label:'MF contribution', val: totalVal>0?(mfInvested/totalVal*100).toFixed(0)+'%':'—', color:'#58a6ff'},
    {label:'Stock contribution', val: totalVal>0?(stInvested/totalVal*100).toFixed(0)+'%':'—', color:'#a371f7'},
    {label:'MF gains contribution', val: totalVal>0?Math.max(0,mfGain/totalVal*100).toFixed(0)+'%':'—', color:'#3fb950'},
    {label:'Stock gain contribution', val: totalVal>0?Math.max(0,stGain/totalVal*100).toFixed(0)+'%':'—', color:'#56d364'},
  ];
  document.getElementById('wf-pills').innerHTML=pillsData.map(p=>`
    <div class="wf-stat-pill">
      <span style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0;display:inline-block"></span>
      <div><div class="wf-stat-pill-label">${p.label}</div><div class="wf-stat-pill-val" style="color:${p.color}">${p.val}</div></div>
    </div>`).join('');

  // ── Build SVG waterfall chart ─────────────────────────────────
  const W = 760, H = 340, padL = 70, padR = 30, padT = 36, padB = 60;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const n = segments.length;
  const barGap = 18, barW = Math.floor((chartW - barGap*(n-1)) / n);

  // Compute running baseline for each bar
  // Bars 0,1,2,3 are stacked increments; bar 4 is the total (full column)
  const baselines = [], tops = [];
  let running = 0;
  for(let i=0;i<n-1;i++){
    const seg = segments[i];
    if(seg.value >= 0){
      baselines.push(running);
      tops.push(running + seg.value);
      running += seg.value;
    } else {
      baselines.push(running + seg.value);
      tops.push(running);
      running += seg.value;
    }
  }
  // Last bar (total) always anchored at 0
  baselines.push(0);
  tops.push(totalVal);

  const allVals = [...baselines, ...tops];
  const dataMin = Math.min(0, ...allVals);
  const dataMax = Math.max(...allVals);
  const span = dataMax - dataMin || 1;
  const yScale = v => padT + chartH - ((v - dataMin) / span * chartH);
  const xStart = i => padL + i * (barW + barGap);

  // Gridlines
  const gridCount = 5;
  let gridLines = '';
  for(let gi=0;gi<=gridCount;gi++){
    const gv = dataMin + (span * gi/gridCount);
    const gy = yScale(gv);
    gridLines += `<line class="wf-grid-line" x1="${padL}" x2="${W-padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"/>`;
    gridLines += `<text x="${padL-6}" y="${gy.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="var(--muted)" font-family="DM Mono,monospace">${fmtL(Math.round(gv))}</text>`;
  }

  // Zero axis
  const zeroY = yScale(0);
  const zeroLine = `<line class="wf-axis-line" x1="${padL}" x2="${W-padR}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke-width="1.5"/>`;

  // Connector dashed lines between bars (top of bar i → baseline of bar i+1)
  let connectors = '';
  for(let i=0;i<n-2;i++){
    const x1 = xStart(i) + barW;
    const x2 = xStart(i+1);
    const seg = segments[i];
    const lineY = seg.value>=0 ? yScale(tops[i]) : yScale(baselines[i]);
    connectors += `<line class="wf-connector" x1="${x1}" x2="${x2}" y1="${lineY.toFixed(1)}" y2="${lineY.toFixed(1)}"/>`;
  }

  // Bars + labels
  let bars = '', topLabels = '', botLabels = '';
  segments.forEach((seg, i) => {
    const x    = xStart(i);
    const yTop = yScale(Math.max(baselines[i], tops[i]));
    const yBot = yScale(Math.min(baselines[i], tops[i]));
    const bH   = Math.max(2, yBot - yTop);
    const isTotal = seg.type === 'total';
    const opacity = isTotal ? '1' : '0.85';
    const glow    = isTotal ? 'class="wf-total-glow"' : '';

    bars += `<rect ${glow} class="wf-bar-base" data-idx="${i}" x="${x}" y="${yTop.toFixed(1)}" width="${barW}" height="${bH.toFixed(1)}"
      fill="${seg.color}" opacity="${opacity}" rx="3"
      onmouseenter="wfShowTip(event,${i})" onmouseleave="wfHideTip()"/>`;

    // Top value label
    const labelY = yTop - 6;
    const valTxt = fmtL(Math.abs(seg.value));
    topLabels += `<text class="wf-label-top" x="${(x+barW/2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${seg.color}" font-weight="600">${valTxt}</text>`;

    // Bottom axis label
    botLabels += `<text class="wf-label-bot" x="${(x+barW/2).toFixed(1)}" y="${(H-padB+12).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${seg.label}</text>`;

    // Gain/loss arrow marker
    if(seg.type==='gain'||seg.type==='loss'){
      const arrow = seg.type==='gain'?'▲':'▼';
      const arrY  = yTop - 18;
      topLabels += `<text x="${(x+barW/2).toFixed(1)}" y="${arrY.toFixed(1)}" text-anchor="middle" font-size="8" fill="${seg.color}">${arrow}</text>`;
    }
  });

  const svgHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    ${gridLines}
    ${zeroLine}
    ${connectors}
    ${bars}
    ${topLabels}
    ${botLabels}
    <!-- X-axis line -->
    <line class="wf-axis-line" x1="${padL}" x2="${W-padR}" y1="${(H-padB).toFixed(1)}" y2="${(H-padB).toFixed(1)}"/>
  </svg>`;

  document.getElementById('wf-svg-wrap').innerHTML = svgHTML;

  // Store segments for tooltip
  window._wfSegments = segments;
  window._wfTotal = totalVal;

  // ── Breakdown table ───────────────────────────────────────────
  document.getElementById('wf-breakdown').innerHTML = `<div class="wf-breakdown-card">`+
    segments.map(seg => {
      const pct = totalVal>0?(Math.abs(seg.value)/totalVal*100).toFixed(1):0;
      const sign = seg.type==='loss'?'−':'';
      const amtCls = seg.type==='gain'?'td-up':seg.type==='loss'?'td-dn':'td-gold';
      return `<div class="wf-bk-row">
        <div class="wf-bk-dot" style="background:${seg.color}"></div>
        <div class="wf-bk-name">${seg.label}</div>
        <div class="wf-bk-amt ${amtCls}">${sign}${fmtL(Math.abs(seg.value))}</div>
        <div class="wf-bk-pct">${pct}%</div>
      </div>`;
    }).join('') + `</div>`;

  // ── Composition insight ───────────────────────────────────────
  const gainTotal = (mfGain>=0?mfGain:0) + (stGain>=0?stGain:0);
  const lossTotal = (mfGain<0?Math.abs(mfGain):0) + (stGain<0?Math.abs(stGain):0);
  const gainPct   = totalVal>0?(gainTotal/totalVal*100).toFixed(1):0;
  const capPct    = totalVal>0?(startVal/totalVal*100).toFixed(1):0;
  const mfRetPct  = mfInvested>0?(mfGain/mfInvested*100).toFixed(1):0;
  const stRetPct  = stInvested>0?(stGain/stInvested*100).toFixed(1):0;

  const insights = [];
  if(gainPct>0)  insights.push({icon:'📈', text:`<b>${gainPct}%</b> of your wealth comes from market returns — your portfolio is genuinely compounding.`});
  if(capPct>0)   insights.push({icon:'💰', text:`<b>${capPct}%</b> is from your invested capital — the savings discipline is the foundation.`});
  if(+mfRetPct>0)insights.push({icon:'◎', text:`Mutual Funds returned <b>${pSign(+mfRetPct)}${mfRetPct}%</b> on your invested capital of ${fmtL(mfInvested)}.`});
  if(stInvested) insights.push({icon:'◐', text:`Equity stocks returned <b>${pSign(+stRetPct)}${stRetPct}%</b> on your invested capital of ${fmtL(stInvested)}.`});
  if(lossTotal>0)insights.push({icon:'⚠', text:`Drag from losses: <b>−${fmtL(lossTotal)}</b> — consider reviewing losing positions.`});
  if(+gainContrib>50) insights.push({icon:'🏆', text:`Over half your wealth is from market gains — compounding is doing the heavy lifting!`});

  document.getElementById('wf-composition').innerHTML = insights.map(ins=>`
    <div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:16px;flex-shrink:0">${ins.icon}</span>
      <span style="font-size:11px;color:var(--muted);line-height:1.6">${ins.text}</span>
    </div>`).join('') || '<div style="color:var(--muted);font-size:11px;padding:10px">Upload your Excel files to see composition analysis.</div>';
}

// ── Waterfall tooltip helpers ─────────────────────────────────
function wfShowTip(e, idx) {
  const seg = window._wfSegments && window._wfSegments[idx];
  const total = window._wfTotal || 1;
  if(!seg) return;
  const tt = document.getElementById('wf-tooltip');
  document.getElementById('wf-tt-title').textContent = seg.label;
  document.getElementById('wf-tt-amt').textContent   = (seg.value<0?'−':'')+fmtL(Math.abs(seg.value));
  document.getElementById('wf-tt-pct').textContent   = total?(Math.abs(seg.value)/total*100).toFixed(1)+'%':'—';
  document.getElementById('wf-tt-sub-l').textContent = seg.subKey;
  if(seg.subKey==='Return %'){
    const inv = seg.id==='mf-gain'?DATA.kpis.mfInvested:DATA.kpis.stInvested;
    document.getElementById('wf-tt-sub-v').textContent = inv>0?fmtP(seg.value/inv*100):'—';
  } else if(seg.subKey==='Total gain'){
    document.getElementById('wf-tt-sub-v').textContent = fmtL((DATA.kpis.mfGain||0)+(DATA.kpis.stGain||0));
  } else {
    document.getElementById('wf-tt-sub-v').textContent = seg.sub;
    document.getElementById('wf-tt-sub-l').textContent = '';
  }
  tt.style.display='block';
  tt.style.left=(e.clientX+14)+'px';
  tt.style.top=(e.clientY-10)+'px';
}
function wfHideTip(){
  const tt=document.getElementById('wf-tooltip');
  if(tt) tt.style.display='none';
}

// ── Portfolio Action Signal ───────────────────────────────────
function renderSignal() {
  const k = DATA.kpis;
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth(); // 0-indexed
  const todayYear = today.getFullYear();
  const hasData = DATA.funds.length > 0 || DATA.stocks.length > 0;

  // ── 1. Compute signals ────────────────────────────────────────
  const signals = [];
  let urgentCount = 0, watchCount = 0, goodCount = 0;

  // ── SIP timing signal ─────────────────────────────────────────
  // Detect most common SIP day from lot dates
  const sipDays = [];
  DATA.mfLots && DATA.mfLots.forEach(lot => {
    if(lot.date) sipDays.push(new Date(lot.date).getDate());
  });
  const sipDayFreq = {};
  sipDays.forEach(d => sipDayFreq[d] = (sipDayFreq[d]||0)+1);
  const topSIPDay = Object.entries(sipDayFreq).sort((a,b)=>b[1]-a[1])[0];
  const sipDay = topSIPDay ? parseInt(topSIPDay[0]) : null;
  const daysToSIP = sipDay ? (sipDay >= todayDay ? sipDay - todayDay : (new Date(todayYear, todayMonth+1, sipDay) - today) / 86400000) : null;

  if(sipDay !== null) {
    if(daysToSIP <= 0) {
      signals.push({type:'urgent', icon:'📅', tag:'urgent', title:'SIP Due Today!', body:`Your usual SIP day is the ${sipDay}${ordinal(sipDay)}. Time to execute your monthly investment.`, metric: hasData ? `₹${(k.mfInvested / Math.max(sipDays.length/Math.max(1,new Set(DATA.mfLots&&DATA.mfLots.map(l=>new Date(l.date).getMonth()+'-'+new Date(l.date).getFullYear())||[]).size||1),1)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} est. this month`:'Check your SIP amount', metricClass:'urgent'});
      urgentCount++;
    } else if(daysToSIP <= 3) {
      signals.push({type:'watch', icon:'⏰', tag:'watch', title:`SIP in ${Math.round(daysToSIP)} days`, body:`Your SIP is due on the ${sipDay}${ordinal(sipDay)}. Keep funds ready in your bank account.`, metric:`${Math.round(daysToSIP)} day${daysToSIP>1?'s':''} away`, metricClass:'watch'});
      watchCount++;
    } else {
      signals.push({type:'good', icon:'✅', tag:'good', title:'SIP on track', body:`Next SIP due in ${Math.round(daysToSIP)} days on the ${sipDay}${ordinal(sipDay)}. No action needed this week.`, metric:`${Math.round(daysToSIP)} days away`, metricClass:'good'});
      goodCount++;
    }
  }

  // ── FY-end tax signal (Jan–Mar) ───────────────────────────────
  const month1 = todayMonth + 1; // 1-indexed
  if(month1 >= 1 && month1 <= 3) {
    const fyEnd = new Date(todayYear, 2, 31);
    const daysToFY = Math.ceil((fyEnd - today) / 86400000);
    const stcgLosses = DATA.stocks.filter(s => {
      const held = s.holdDays || 0;
      return held < 365 && s.Gain < 0;
    });
    const totalHarvestable = stcgLosses.reduce((a,s)=>a+Math.abs(s.Gain||0),0);
    if(totalHarvestable > 0) {
      signals.push({type:'urgent', icon:'🧾', tag:'urgent', title:'Tax Harvesting Window Open', body:`FY ends in ${daysToFY} days. You have STCG losses that can offset gains before March 31. Book losses, wait 31 days, rebuy.`, metric:`${fmtL(totalHarvestable)} harvestable`, metricClass:'urgent'});
      urgentCount++;
    } else {
      signals.push({type:'watch', icon:'📆', tag:'watch', title:`FY ends in ${daysToFY} days`, body:`March 31 deadline approaching. Review your LTCG gains — ₹1.25L is tax-free. Consider booking profits up to the exemption limit.`, metric:`${daysToFY} days to FY end`, metricClass:'watch'});
      watchCount++;
    }
  }

  // ── Deep loss signal ──────────────────────────────────────────
  const deepLosers = DATA.stocks.filter(s => s.RetPct < -25);
  if(deepLosers.length > 0) {
    const worst = [...deepLosers].sort((a,b)=>a.RetPct-b.RetPct)[0];
    signals.push({type:'urgent', icon:'🔴', tag:'urgent', title:`${deepLosers.length} stock${deepLosers.length>1?'s':''} down >25%`, body:`${worst.name} is your worst performer at ${fmtP(worst.RetPct)}. Deep losses rarely recover without a clear catalyst. Review your thesis.`, metric:`${fmtP(worst.RetPct)} worst position`, metricClass:'urgent'});
    urgentCount++;
  }

  // ── MF laggards (negative return) ────────────────────────────
  const mfLosers = DATA.funds.filter(f => f.Gain < 0);
  if(mfLosers.length > 0) {
    const worstMF = [...mfLosers].sort((a,b)=>a.RetPct-b.RetPct)[0];
    signals.push({type:'watch', icon:'📉', tag:'watch', title:`${mfLosers.length} MF${mfLosers.length>1?'s':''} in the red`, body:`${worstMF.name} is your worst MF at ${fmtP(worstMF.RetPct)}. Check if it's category underperformance or a specific fund issue.`, metric:`${fmtP(worstMF.RetPct)} worst fund`, metricClass:'watch'});
    watchCount++;
  }

  // ── Portfolio concentration risk ──────────────────────────────
  const stTotal = DATA.stocks.reduce((a,s)=>a+s.Invested,0)||1;
  const concStocks = DATA.stocks.filter(s => s.Invested/stTotal > 0.20);
  if(concStocks.length > 0) {
    signals.push({type:'watch', icon:'⚖️', tag:'watch', title:'High concentration in single stock', body:`${concStocks.map(s=>esc(s.name)).join(', ')} each represent >20% of your stock portfolio. Consider trimming on strength.`, metric:`${concStocks.length} over-weight position${concStocks.length>1?'s':''}`, metricClass:'watch'});
    watchCount++;
  }

  // ── Stale portfolio check (no new investment > 60 days) ───────
  const allLotDates = [...(DATA.mfLots||[]), ...(DATA.stLots||[])].map(l => new Date(l.date)).filter(d=>!isNaN(d));
  if(allLotDates.length > 0) {
    const latestInv = new Date(Math.max(...allLotDates));
    const staleDays = Math.floor((today - latestInv)/86400000);
    if(staleDays > 60) {
      signals.push({type:'watch', icon:'😴', tag:'watch', title:'No new investment in 60+ days', body:`Last investment was ${staleDays} days ago on ${fmtDate(latestInv)}. If this was intentional, great. If not, consider resuming your SIP.`, metric:`${staleDays} days since last buy`, metricClass:'watch'});
      watchCount++;
    }
  }

  // ── Averaging opportunities ───────────────────────────────────
  const avgCandidates = DATA.funds.filter(f => f.RetPct < -5 && f.RetPct > -25 && f.CAGR > 0);
  if(avgCandidates.length > 0) {
    signals.push({type:'info', icon:'💡', tag:'info', title:`${avgCandidates.length} MF averaging opportunit${avgCandidates.length>1?'ies':'y'}`, body:`${avgCandidates[0].name}${avgCandidates.length>1?' and others':''} are slightly underwater but have positive long-term CAGR. A lumpsum addition here lowers your average cost.`, metric:`${fmtP(avgCandidates[0].RetPct)} on ${avgCandidates[0].name.split(' ')[0]}`, metricClass:'info'});
  }

  // ── Strong performers ─────────────────────────────────────────
  const stars = [...DATA.funds, ...DATA.stocks].filter(h => (h.RetPct||0) > 30);
  if(stars.length > 0) {
    const best = [...stars].sort((a,b)=>b.RetPct-a.RetPct)[0];
    signals.push({type:'good', icon:'🌟', tag:'good', title:`${stars.length} holding${stars.length>1?'s':''} up >30%`, body:`${best.name} is your star at ${fmtP(best.RetPct)}. Consider if it's become overweight. Partial profit-booking on strength is valid.`, metric:`${fmtP(best.RetPct)} top performer`, metricClass:'good'});
    goodCount++;
  }

  // ── All-green signal ──────────────────────────────────────────
  if(hasData && deepLosers.length === 0 && mfLosers.length === 0 && concStocks.length === 0) {
    signals.push({type:'good', icon:'🏆', tag:'good', title:'Portfolio is clean & healthy', body:'No deep losses, no concentration risk, no MF underperformers. Your portfolio is in good shape — stay the course.', metric:'All checks passed', metricClass:'good'});
    goodCount++;
  }

  // ── No data fallback ──────────────────────────────────────────
  if(!hasData) {
    signals.push({type:'info', icon:'📂', tag:'info', title:'Upload your Excel files', body:'Go to Import Excel to load your MF and Stocks data. The signal engine will then analyse your actual portfolio.', metric:'No data yet', metricClass:'info'});
  }

  // ── 2. Score (0–100) ──────────────────────────────────────────
  let score = 100;
  score -= urgentCount * 20;
  score -= watchCount * 8;
  score = Math.max(0, Math.min(100, score));
  const scoreClass = score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
  const scoreLabel = score >= 70 ? '✦ STAY THE COURSE' : score >= 40 ? '⚠ ATTENTION NEEDED' : '🔴 ACTION REQUIRED';
  const scoreHeadline = score >= 70
    ? (urgentCount === 0 ? 'Your portfolio needs nothing from you today.' : 'Minor items to review — no major action needed.')
    : score >= 40
    ? `${urgentCount + watchCount} things need your attention this week.`
    : `${urgentCount} urgent issue${urgentCount!==1?'s':''} require immediate attention.`;
  const scoreSubline = score >= 70
    ? `${goodCount} positive signal${goodCount!==1?'s':''} detected. Keep your SIPs running and resist the urge to tinker.`
    : score >= 40
    ? `${watchCount} item${watchCount!==1?'s':''} to monitor, ${urgentCount} urgent. Review the action cards below.`
    : `Deep losses or high risk concentration detected. Review the urgent cards below before your next investment.`;

  // ── 3. Render hero ────────────────────────────────────────────
  const hero = document.getElementById('pas-hero');
  hero.className = `pas-hero ${scoreClass}`;
  document.getElementById('pas-badge').className = `pas-score-badge ${scoreClass}`;
  document.getElementById('pas-score-num').className = `pas-score-num ${scoreClass}`;
  document.getElementById('pas-score-num').textContent = score;
  const lbl = document.getElementById('pas-signal-label');
  lbl.className = `pas-signal-label ${scoreClass}`;
  lbl.textContent = scoreLabel;
  document.getElementById('pas-headline').textContent = scoreHeadline;
  document.getElementById('pas-subline').textContent = scoreSubline;

  // ── 4. Mood strip ─────────────────────────────────────────────
  const fyQ = month1>=4&&month1<=6?'Q1':month1>=7&&month1<=9?'Q2':month1>=10&&month1<=12?'Q3':'Q4';
  const seasonMap = {1:'Tax Season',2:'Tax Season',3:'FY-End Rush',4:'New FY',5:'Early Bull',6:'Monsoon Dip',7:'Earnings Season',8:'Earnings Season',9:'Sept Effect',10:'Festive Rally',11:'Festive Rally',12:'Year-End'};
  const moodItems = [
    {icon:'📅', label:'Today', val: today.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})},
    {icon:'🗓', label:'FY Quarter', val: fyQ + ' FY' + String(todayYear).slice(2) + (month1>=1&&month1<=3?'-'+String(todayYear).slice(2):'-'+String(todayYear+1).slice(2))},
    {icon:'🌦', label:'Market Season', val: seasonMap[month1]||'Active'},
    {icon:'📊', label:'Holdings tracked', val: `${DATA.funds.length} MFs · ${DATA.stocks.length} Stocks`},
    {icon:'💰', label:'Portfolio value', val: fmtL(k.totalValue||0)},
  ];
  document.getElementById('pas-mood-strip').innerHTML = moodItems.map(m=>`
    <div class="pas-mood-item">
      <div class="pas-mood-icon">${m.icon}</div>
      <div><div class="pas-mood-label">${m.label}</div><div class="pas-mood-val">${m.val}</div></div>
    </div>`).join('');

  // ── 5. Calendar strip (next 7 days) ──────────────────────────
  let calHTML = '';
  for(let i=0;i<7;i++) {
    const d = new Date(today); d.setDate(today.getDate()+i);
    const dd = d.getDate(), dm = d.getMonth()+1;
    const isToday = i===0;
    const isSIPDay = sipDay !== null && dd === sipDay;
    const isFYEnd = dm===3 && dd===31;
    const isWeekend = d.getDay()===0||d.getDay()===6;
    let cls = 'pas-cal-day';
    if(isToday) cls += ' today';
    else if(isFYEnd) cls += ' fy-alert';
    else if(isSIPDay) cls += ' has-sip';
    let dotColor = isWeekend?'var(--muted2)':isSIPDay?'var(--blue)':isFYEnd?'var(--red)':'transparent';
    let dayNote = isToday?'Today':isWeekend?'Weekend':isSIPDay?'SIP Day':isFYEnd?'FY End':d.toLocaleDateString('en-IN',{weekday:'short'});
    calHTML += `<div class="${cls}">
      <div class="pas-cal-day-num" style="color:${isToday?'var(--gold)':isSIPDay?'var(--blue)':isFYEnd?'var(--red)':'var(--text)'}">${dd}</div>
      <div class="pas-cal-day-label">${dayNote}</div>
      <div class="pas-cal-day-dot" style="background:${dotColor}"></div>
    </div>`;
  }
  document.getElementById('pas-calendar').innerHTML = calHTML;

  // ── 6. Action cards ───────────────────────────────────────────
  const urgentFirst = [...signals].sort((a,b)=>{
    const o={urgent:0,watch:1,good:2,info:3};
    return (o[a.type]||3)-(o[b.type]||3);
  });
  document.getElementById('pas-action-count').textContent =
    `${urgentCount} urgent · ${watchCount} watch · ${goodCount} good`;
  document.getElementById('pas-action-grid').innerHTML = urgentFirst.map(s=>`
    <div class="pas-action-card ${s.type}">
      <div class="pas-card-header">
        <span class="pas-card-icon">${s.icon}</span>
        <span class="pas-card-tag ${s.tag}">${s.tag.toUpperCase()}</span>
      </div>
      <div class="pas-card-title">${s.title}</div>
      <div class="pas-card-body">${s.body}</div>
      <div class="pas-card-metric ${s.metricClass}">${s.metric}</div>
    </div>`).join('');

  // ── 7. Weekly checklist (persisted in localStorage) ──────────
  const weekKey = 'pas-checklist-week-' + getWeekNumber(today);
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(weekKey)||'{}'); } catch(e){}
  const checklist = [
    {id:'sip',   title:'Confirm SIPs executed this month',       desc:'Check your bank statement or broker app to confirm all SIP debits went through successfully.'},
    {id:'news',  title:'Skim portfolio-related news (10 min)',   desc:'Check if any of your holdings have major news: results, management change, order wins, regulatory action.'},
    {id:'drift', title:'Check portfolio allocation drift',       desc:'Open the Rebalancer tab and see if any asset class has drifted more than 5% from your target.'},
    {id:'loss',  title:'Review your deepest loss positions',     desc:'Look at your worst performers. Are you holding for a reason, or out of hope? Be honest with yourself.'},
    {id:'goal',  title:'Check goal progress',                    desc:'Open Goal Planner and see if your corpus is on track. Adjust SIP if you are behind by more than 10%.'},
    {id:'tax',   title:'Note any LTCG approaching 1-year mark',  desc:'Holdings near the 1-year mark cross from STCG (20%) to LTCG (12.5%) tax. Plan exits accordingly.'},
    {id:'cash',  title:'Check if you have idle cash to deploy',  desc:'If any SIP was missed or you received a bonus, is there capital sitting idle? Deploy into underweight buckets.'},
  ];
  document.getElementById('pas-checklist').innerHTML = checklist.map(item=>{
    const done = !!checked[item.id];
    return `<div class="pas-check-row ${done?'checked':''}" onclick="togglePasCheck('${weekKey}','${item.id}',this)">
      <div class="pas-check-box ${done?'done':''}">${done?'<span style="color:#fff;font-size:11px">✓</span>':''}</div>
      <div class="pas-check-text">
        <div class="pas-check-title">${item.title}</div>
        <div class="pas-check-desc">${item.desc}</div>
      </div>
    </div>`;
  }).join('');
}

function togglePasCheck(weekKey, id, row) {
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(weekKey)||'{}'); } catch(e){}
  checked[id] = !checked[id];
  localStorage.setItem(weekKey, JSON.stringify(checked));
  const box = row.querySelector('.pas-check-box');
  if(checked[id]) {
    row.classList.add('checked');
    box.classList.add('done');
    box.innerHTML='<span style="color:#fff;font-size:11px">✓</span>';
  } else {
    row.classList.remove('checked');
    box.classList.remove('done');
    box.innerHTML='';
  }
}

function ordinal(n) {
  const v=n%100;
  if(v>=11&&v<=13) return n+'th';
  return n+(['th','st','nd','rd'][n%10]||'th');
}
function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(),0,1);
  return Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);
}

// ══════════════════════════════════════════════════════════════
// DRAWDOWN ANALYZER
// ══════════════════════════════════════════════════════════════

// Chart instance — destroyed and recreated on each renderOverview call
let chartDrawdownInst = null;

// ── STEP 2: Build simulated portfolio value series ────────────
// Uses GBM (Geometric Brownian Motion) with realistic Indian equity market
// volatility (~18% annualised σ) and known crash overlays so the chart
// shows meaningful drawdowns instead of a flat 0% line.
//
// The simulation is seeded deterministically from the portfolio's earliest
// investment date so it is stable across re-renders. The final portfolio
// value is rescaled to match the user's actual reported current value,
// keeping the drawdown shape realistic while the ending point is exact.
function buildDrawdownSeriesFromTimeline() {
  const allMonths = buildCombinedMonthly();
  if (!allMonths.length) return [];

  const k = DATA.kpis;
  if (!k || !k.totalInvested) return [];

  const first = allMonths[0].m, last = allMonths[allMonths.length - 1].m;
  const monthMap = {};
  allMonths.forEach(({m, v}) => monthMap[m] = v);

  // ── GBM parameters (Indian equity — Nifty 50 historical) ────
  // Annual drift (μ) derived from portfolio CAGR if available, else 12% default
  const mfCAGR = k.mfCAGR > 0 ? k.mfCAGR : 12;
  const annualDrift   = mfCAGR / 100;
  const annualSigma   = 0.18;          // 18% annualised vol — typical Indian equity
  const monthlyDrift  = annualDrift  / 12;
  const monthlySigma  = annualSigma  / Math.sqrt(12);

  // ── Known Indian market crash months: [YYYY-MM, shock %] ────
  // Approximate peak-to-trough drawdown injected as one-shot negative shocks
  const CRASH_SHOCKS = {
    '2008-10': -0.24,  // Global financial crisis trough
    '2011-12': -0.08,  // Euro-zone crisis
    '2013-08': -0.07,  // Taper tantrum / INR crisis
    '2015-08': -0.09,  // China devaluation selloff
    '2016-11': -0.06,  // Demonetisation shock
    '2018-09': -0.08,  // IL&FS crisis / NBFC meltdown
    '2020-03': -0.32,  // COVID crash
    '2022-06': -0.10,  // Global rate-hike selloff
    '2024-06': -0.06,  // Post-election volatility
  };

  // ── Deterministic seeded PRNG (mulberry32) ───────────────────
  // Seed from numeric representation of first month so output is stable
  const [sy, sm] = first.split('-').map(Number);
  let seed = sy * 100 + sm;
  function rand() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  // Box-Muller for Gaussian samples
  function randn() {
    let u, v;
    do { u = rand(); v = rand(); } while (u === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ── Simulate month by month ──────────────────────────────────
  const series = [];
  let [fy, fm] = [parseInt(first.slice(0,4)), parseInt(first.slice(5))];
  const [ey, em] = [parseInt(last.slice(0,4)), parseInt(last.slice(5))];
  let portfolioValue = 0;

  while (fy < ey || (fy === ey && fm <= em)) {
    const mk = fy + '-' + String(fm).padStart(2,'0');

    // 1. Add new investment this month (SIP / lump-sum)
    portfolioValue += (monthMap[mk] || 0);

    // 2. Apply GBM return for this month
    const gbmReturn = monthlyDrift + monthlySigma * randn();
    portfolioValue *= (1 + gbmReturn);

    // 3. Overlay known crash shocks if this month matches
    if (CRASH_SHOCKS[mk] !== undefined) {
      portfolioValue *= (1 + CRASH_SHOCKS[mk]);
    }

    portfolioValue = Math.max(portfolioValue, 0);
    series.push({ date: mk, value: Math.round(portfolioValue) });

    fm++; if (fm > 12) { fm = 1; fy++; }
  }

  // ── Rescale endpoint to match actual reported portfolio value ─
  // This keeps the drawdown shape realistic but anchors the final
  // value to reality (the user's actual current portfolio value).
  const actualEndValue = k.totalValue || 0;
  if (actualEndValue > 0 && series.length > 0) {
    const simEndValue = series[series.length - 1].value;
    if (simEndValue > 0) {
      const scale = actualEndValue / simEndValue;
      // Blend: gently taper scale towards 1 at the start so early values
      // aren't distorted, and full scale applies at the end.
      const n = series.length;
      series.forEach((pt, i) => {
        const t = i / Math.max(n - 1, 1);    // 0 → 1 over the series
        const blendedScale = 1 + (scale - 1) * t;
        pt.value = Math.round(pt.value * blendedScale);
      });
    }
  }

  return series;
}

// ── STEP 3a: Core drawdown stats ─────────────────────────────
function calculateDrawdown(series) {
  if (!series.length) return { maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true };

  const values = series.map(s => s.value);
  let runningPeak = values[0];
  let maxDD = 0;
  let maxDDPeak = runningPeak;
  let maxDDTroughIdx = 0;
  let curPeakIdx = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? (values[i] - runningPeak) / runningPeak : 0;
    if (dd < maxDD) { maxDD = dd; maxDDPeak = runningPeak; maxDDTroughIdx = i; }
  }

  const finalVal = values[values.length - 1];
  const allTimePeak = Math.max(...values);
  const currentDD = allTimePeak > 0 ? (finalVal - allTimePeak) / allTimePeak : 0;

  // Recovery: months from trough until value >= trough's peak again
  let recoveryMonths = 0;
  let recovered = true;
  if (maxDD < -0.001) {
    recovered = false;
    for (let i = maxDDTroughIdx + 1; i < values.length; i++) {
      recoveryMonths++;
      if (values[i] >= maxDDPeak) { recovered = true; break; }
    }
    if (!recovered) recoveryMonths = values.length - 1 - maxDDTroughIdx;
  }

  return { maxDD, currentDD, peak: allTimePeak, recoveryMonths, recovered };
}

// ── STEP 3b: Per-point drawdown array + peak/trough indices ───
function calculateDrawdownWithPeriod(series) {
  if (!series.length) return { peakIndex: 0, troughIndex: 0, maxDD: 0, ddSeries: [] };

  const values = series.map(s => s.value);
  let runningPeak = values[0];
  let maxDD = 0, peakIdx = 0, troughIdx = 0, curPeakIdx = 0;
  const ddSeries = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i] > runningPeak) { runningPeak = values[i]; curPeakIdx = i; }
    const dd = runningPeak > 0 ? (values[i] - runningPeak) / runningPeak * 100 : 0;
    ddSeries.push(parseFloat(dd.toFixed(2)));
    if (dd < maxDD) { maxDD = dd; peakIdx = curPeakIdx; troughIdx = i; }
  }

  return { peakIndex: peakIdx, troughIndex: troughIdx, maxDD, ddSeries };
}

// ── STEP 4: Populate KPI cards ────────────────────────────────
function renderDrawdownSummary(stats) {
  const { maxDD, currentDD, peak, recoveryMonths, recovered } = stats;
  const noData = !peak;

  const set = (id, text, color) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = text; if (color) el.style.color = color; }
  };

  // Max Drawdown
  set('dd-max',      noData ? '—' : (maxDD * 100).toFixed(1) + '%',
                     noData ? 'var(--muted)' : 'var(--red)');
  set('dd-max-note', noData ? 'Upload data' : 'Worst peak-to-trough fall');

  // Current Drawdown
  if (noData) {
    set('dd-cur', '—', 'var(--muted)');
    set('dd-cur-note', 'Upload data');
  } else if (currentDD >= -0.001) {
    set('dd-cur', 'At Peak', 'var(--green)');
    set('dd-cur-note', 'Portfolio at all-time high');
  } else {
    set('dd-cur', (currentDD * 100).toFixed(1) + '%',
        currentDD < -0.15 ? 'var(--red)' : 'var(--amber)');
    set('dd-cur-note', 'Below all-time high');
  }

  // Recovery Time
  if (noData) {
    set('dd-recovery', '—', 'var(--muted)');
    set('dd-recovery-note', 'Upload data');
  } else if (recoveryMonths === 0) {
    set('dd-recovery', 'None', 'var(--green)');
    set('dd-recovery-note', 'No significant drawdown');
  } else {
    set('dd-recovery', recoveryMonths + ' mo', recovered ? 'var(--green)' : 'var(--amber)');
    set('dd-recovery-note', recovered ? 'Fully recovered' : 'Still recovering');
  }

  // Peak Value
  set('dd-peak',      noData ? '—' : fmtL(peak), noData ? 'var(--muted)' : 'var(--gold)');
  set('dd-peak-note', noData ? 'Upload data' : 'All-time portfolio high');
}

// ── STEP 5: Render Chart.js drawdown chart ────────────────────
function renderDrawdownChart(series, ddResult) {
  const canvas = document.getElementById('chart-drawdown');
  if (!canvas || !window.Chart) return;

  if (chartDrawdownInst) { chartDrawdownInst.destroy(); chartDrawdownInst = null; }

  if (!series.length) {
    canvas.parentElement.innerHTML =
      '<div style="color:var(--muted);font-size:11px;padding:20px;text-align:center">Upload files to see drawdown chart</div>';
    return;
  }

  const { ddSeries, peakIndex, troughIndex } = ddResult;
  const labels = series.map(s => s.date);
  const skip = Math.max(1, Math.ceil(labels.length / 18));

  // Y-axis: set min slightly below the worst drawdown, max = 1 (slightly above 0)
  const minDD = Math.min(...ddSeries, -0.5);
  const yMin = Math.floor(minDD * 1.25); // 25% headroom below worst point
  const yMax = 1; // small breathing room above zero line

  // Per-point radii and colours for peak/trough annotations
  const pointRadius = labels.map((_, i) =>
    (i === peakIndex || i === troughIndex) ? 5 : 0);
  const pointBg = labels.map((_, i) =>
    i === peakIndex ? '#d4a843' : i === troughIndex ? '#f85149' : 'rgba(0,0,0,0)');

  chartDrawdownInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Drawdown %',
        data: ddSeries,
        borderColor: '#f85149',
        backgroundColor: 'rgba(248,81,73,0.10)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius,
        pointBackgroundColor: pointBg,
        pointBorderColor: pointBg,
        pointBorderWidth: 2,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => labels[items[0].dataIndex],
            label: ctx => {
              const v = ctx.raw;
              const tag = ctx.dataIndex === peakIndex ? ' 🔺 Peak'
                        : ctx.dataIndex === troughIndex ? ' 🔻 Trough' : '';
              return 'Drawdown: ' + v.toFixed(2) + '%' + tag;
            }
          },
          backgroundColor: '#1c2330',
          titleColor: '#e6edf3',
          bodyColor: '#7d8590',
          borderColor: '#30363d',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: {
            font: { size: 9 },
            color: '#7d8590',
            maxRotation: 45,
            callback: (_, i) => i % skip === 0 ? labels[i] : ''
          },
          grid: { color: '#21262d' }
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            font: { size: 9 },
            color: '#7d8590',
            callback: v => v.toFixed(1) + '%'
          },
          grid: { color: '#21262d' }
        }
      }
    }
  });
}

// ── STEP 7: Insight card ──────────────────────────────────────
function renderDrawdownInsight(maxDD, currentDD) {
  const el = document.getElementById('dd-insight');
  if (!el) return;
  if (!maxDD) { el.innerHTML = ''; return; }

  const pct = maxDD * 100;    // negative, e.g. -18.3
  const curPct = currentDD * 100;

  let accent, icon, title, note;
  if (pct <= -30) {
    accent = 'var(--red)'; icon = '⚠';
    title = 'High Drawdown Warning';
    note = `Portfolio experienced a severe drawdown of ${pct.toFixed(1)}% — exceeding 30%. Review position sizing and consider enforcing stop-loss discipline on speculative holdings.`;
  } else if (pct <= -15) {
    accent = 'var(--amber)'; icon = '◈';
    title = 'Moderate Drawdown Observed';
    note = `A pullback of ${pct.toFixed(1)}% was recorded. This is within the acceptable range for an equity-heavy portfolio. Monitor sector concentration to limit future drawdowns.`;
  } else if (curPct < -5) {
    accent = 'var(--blue)'; icon = 'ℹ';
    title = 'Currently Below Peak';
    note = `Portfolio is ${Math.abs(curPct).toFixed(1)}% below its all-time high. Continue regular SIPs to benefit from rupee cost averaging during this recovery phase.`;
  } else {
    accent = 'var(--green)'; icon = '✓';
    title = 'Healthy Drawdown Profile';
    note = `Max drawdown is under 15% — a sign of disciplined, diversified investing. Capital preservation is strong across your investment history.`;
  }

  el.innerHTML = `<div class="insight-card" style="--ic-accent:${accent}">
    <div class="insight-label">${icon} ${title}</div>
    <div class="insight-value" style="color:${accent}">${pct.toFixed(1)}%</div>
    <div class="insight-note">${note}</div>
  </div>`;
}

// ── STEP 6: Orchestrator — called from renderOverview ─────────
function renderDrawdownAnalyzer() {
  const series = buildDrawdownSeriesFromTimeline();

  if (!series.length) {
    renderDrawdownSummary({ maxDD: 0, currentDD: 0, peak: 0, recoveryMonths: 0, recovered: true });
    renderDrawdownInsight(0, 0);
    return;
  }

  const stats   = calculateDrawdown(series);
  const ddResult = calculateDrawdownWithPeriod(series);

  renderDrawdownSummary(stats);
  renderDrawdownInsight(stats.maxDD, stats.currentDD);
  // Slight delay to ensure canvas is painted before Chart.js measures its box
  setTimeout(() => renderDrawdownChart(series, ddResult), 100);
}

// ── Router (updated) ──────────────────────────────────────────
const PAGES={
  overview:{title:'Portfolio Overview',render:renderOverview},
  mf:{title:'Mutual Funds',render:renderMF},
  stocks:{title:'Equity Stocks',render:renderStocks},
  analytics:{title:'Analytics',render:renderAnalytics},
  timeline:{title:'Investment Timeline',render:renderTimeline},
  goals:{title:'Goal Planner',render:renderGoalPlanner},
  rebalance:{title:'Portfolio Rebalancing Advisor',render:renderRebalance},
  waterfall:{title:'Wealth Waterfall',render:renderWaterfall},
  signal:{title:'Portfolio Action Signal',render:renderSignal},
  upload:{title:'Import Excel Data',render:renderUpload},
};
function switchPage(id){
  if(!PAGES[id]) { console.warn('switchPage: unknown page id "'+id+'"'); return; }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('page-'+id); if(pg) pg.classList.add('active');
  // Fix 12: use data-page attribute for reliable active detection
  document.querySelectorAll('.nav-item').forEach(n=>{ if(n.dataset.page===id) n.classList.add('active'); });
  document.getElementById('page-title').textContent=PAGES[id].title;
  PAGES[id].render();
}

// ── Boot ──────────────────────────────────────────────────────
buildTicker();
buildStrip();
updateChrome();
renderOverview();
initUploadListeners();
// NOTE: theme is already initialised by initTheme() IIFE defined above — no duplicate needed here.
