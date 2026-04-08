# PortFin — Personal Investment Dashboard

A powerful, **no-backend personal finance dashboard** to track, analyze, and optimize your investments across **Mutual Funds and Stocks** — built using pure HTML, CSS, and JavaScript.

> 📊 Upload your Excel files → Instantly visualize your portfolio → Make smarter investment decisions.

---

## ✨ Features

### 📊 Portfolio Overview

* Total investment, current value, P&L
* MF vs Stocks allocation split with value breakdown
* MF category mix (interactive donut chart)
* Top MF performers & top stock gainers
* Risk concentration alerts (per stock and per sector)
* SIP action plan — personalized monthly guidance with fund-level recommendations
* Portfolio health score with SVG gauge visualization and score breakdown

---

### 📉 Drawdown Analyzer *(on Overview page)*

* **Max drawdown** — worst peak-to-trough fall across your investment history
* **Current drawdown** — how far below all-time high you currently are
* **Recovery time** — months taken to recover from the worst drawdown
* **Peak portfolio value** — all-time high watermark
* Interactive **drawdown chart** with peak 🔺 and trough 🔻 markers
* Simulated using **GBM (Geometric Brownian Motion)** with realistic 18% Indian equity volatility and real crash overlays (COVID, GFC, IL&FS, Demonetisation, etc.)
* Contextual **insight card** with actionable guidance based on drawdown severity

---

### 🧠 Smart Insights

* Portfolio **Health Score** (0–100) with 5-dimensional scoring:
  * Diversification (single-stock concentration & speculative exposure)
  * MF Dominance (MF share of total portfolio)
  * Profitability (% of funds & stocks in profit)
  * CAGR Quality (average MF CAGR vs Nifty 50 benchmark of 12%)
  * Consistency (regular investing across months)
* Actionable **risk alerts** per stock and per sector
* Intelligent **analyst-style recommendations** (Add / Hold / Reduce / Exit / Switch)
* **SIP Action Plan** — fund-specific monthly deployment guidance

---

### 📈 Mutual Funds Analysis

* Category-wise filtering (Value, Large Cap, Mid Cap, Small Cap, Flexi Cap, ELSS, Index)
* Multi-column sorting (CAGR, return %, value, gain, invested, lots, holding period)
* **Lot-level drill-down** — click any fund to expand individual purchase lots with date, NAV, amount, gain and holding period
* Category mix breakdown cards
* Export data to CSV

---

### 📉 Stocks Analysis

* Sector-wise filtering and breakdown
* Risk classification per stock (HIGH RISK / WATCH / SAFE)
* P&L and CAGR tracking per holding
* Analyst-style action recommendations (Add / Hold / Reduce / Exit / Switch)
* **Lot-level drill-down** — expand individual purchase lots with buy price, CMP, unrealised gain
* **Tax Harvesting Assistant** — built in (see below)
* Export data to CSV

---

### 🧾 Tax Harvesting Assistant *(inside Stocks page)*

* LTCG / STCG classification per lot (Indian FY rules: LTCG 12.5% > 1yr, STCG 20% < 1yr)
* ₹1.25L LTCG exemption awareness built in
* Tax estimation: total LTCG gains, STCG gains, estimated tax liability
* **Harvest saving estimate** — how much tax you can save by booking losses
* Loss-making lot table with harvest recommendations
* Wash-sale guidance (31-day rebuy rule)

---

### 📊 Analytics

* Monthly MF investment flow (bar chart)
* Sector-wise stock P&L breakdown
* Portfolio ratios (MF/Stock split, win rate, concentration, category count)
* **XIRR** — money-weighted return computed via Newton-Raphson using actual lot dates and amounts

#### Benchmark Comparison *(inside Analytics)*

* Portfolio CAGR vs Nifty 50, Nifty Midcap 150, Nifty Smallcap 250, Nifty Next 50, Gilt Index
* **Holding-period filter** — compare at 1yr / 3yr / 5yr / 7yr / 10yr horizons
* Time-aligned benchmark CAGR (each fund's benchmark matched to its actual holding period)
* Per-fund vs category benchmark table with alpha calculation
* **Alpha generation analysis** with decision feed (Add / Hold / Reduce per fund)
* Beat / Trail / Close verdict badges

---

### 📅 Investment Timeline

* Monthly investment heatmap (GitHub-style calendar grid, 5-tone colour scale)
* Year filter chips
* Yearly investment totals (horizontal bar chart)
* Monthly breakdown table with % of year
* Cumulative investment line chart (MF + Stocks split)
* **6 investment insight cards:**
  * Longest SIP streak (consecutive investing months)
  * Highest-invest year
  * Average annual investment
  * Inactive months (months with zero investment)
  * MF vs Stocks capital split
  * Biggest single investment month

---

### 🎯 Goal Planner

* Set target corpus (₹5L–₹10Cr slider)
* Set target year (2025–2055 slider)
* Set expected annual return (6%–24% slider)
* SIP requirement calculation (accounts for current portfolio FV)
* On-track vs behind-track indicator with gap analysis
* **Wealth projection chart** with current-trajectory vs SIP-needed lines
* **5 return-rate scenario comparison** (8% / 10% / 12% / 15% / 18% p.a.)
* **Milestone tracker** — 25% / 50% / 75% / 100% of goal with estimated reach year

---

### 💧 Wealth Waterfall

* SVG waterfall chart showing exactly where your wealth came from:
  Starting capital → SIPs added → MF gains → Stock gains → Current portfolio value
* Interactive bar tooltips (amount, % of final, sub-detail)
* KPI strip (total invested, total gains, gain %, MF contribution, stock contribution)
* Waterfall breakdown table with colour-coded segments
* **Wealth composition insight** — narrative interpretation of gain vs principal split

---

### ⚡ Portfolio Action Signal

* **Daily signal score** (0–100) with urgency rating (Urgent / Watch / Good)
* **8 intelligent signal types:**
  * SIP due today / coming soon / on track
  * FY-end tax harvesting window (March 31 deadline)
  * Deep loss stocks (>25% down)
  * MF underperformers in the red
  * Portfolio concentration risk (single stock >20%)
  * Stale portfolio (no new investment in 60+ days)
  * MF averaging opportunities
  * Star performers (>30% gain)
* **Context mood strip** — 4 live portfolio indicators (invested, gain, return, value)
* **7-day calendar strip** — highlights SIP days, FY-end alert, weekends
* **Action cards grid** sorted by urgency with metric callouts
* **Weekly investor checklist** — 7 tasks, persisted per week in localStorage

---

### ⚖️ Portfolio Rebalancing Advisor

* Set target allocation across 3 asset classes via sliders:
  * Mutual Funds
  * Large-cap Stocks
  * ETF / Index
* Auto-normalises to 100% (adjusts other sliders when one changes)
* Current vs target allocation comparison with drift bars
* **Exact buy/sell action plan** with ₹ amounts — BUY / SELL / HOLD per asset class
* Drift detection (alerts when any class drifts ≥5%)
* Rebalancing education with Indian tax-aware guidance (STCG/LTCG impact, SIP-first rebalancing strategy)

---

### 📤 Import Excel Data

* Drag-and-drop or click-to-browse upload
* Supports `.xlsx` / `.xls`
* Two-file workflow: MF file + Stocks file
* Instant full-dashboard refresh on both files loaded
* Per-file status feedback (load confirmation, unclassified sector warnings)
* Graceful partial-load messaging (upload one at a time)

---

### 📤 Export to CSV

* Export Mutual Funds data (fund name, category, lots, invested, value, gain, return, CAGR, holding days)
* Export Stocks data (stock, sector, qty, CMP, invested, market value, P&L, return, CAGR, holding days)

---

### 🎨 UI/UX

* Dark / Light theme toggle 🌙☀️ (persisted in localStorage)
* Live scrolling **market ticker** strip (all stocks + top MFs, auto-scrolling)
* Fully responsive sidebar with hamburger menu (mobile-friendly)
* Sticky topbar with live MF / Stocks / Combined return badges
* Sidebar summary strip (total value, overall P&L, MF CAGR, as-of date, category colour bar)
* Clean, modern monospace + sans-serif design system (DM Mono + Syne)
* Smooth page transitions and hover animations

---

## 📂 How It Works

1. Go to **Import Excel**
2. Upload:
   * Mutual Funds Excel file
   * Stocks Excel file
3. Dashboard updates instantly ⚡

> ❗ No backend, no API, no setup required

---

## 📁 Supported File Format

* `.xlsx` / `.xls`
* Broker-exported portfolio files
* Structured columns (as per sample format)

---

## 🗂️ Project Structure

```
portfin/
├── index.html              # Markup only — loads all assets
├── css/
│   └── style.css           # Full design system & component styles
└── js/
    ├── common.js           # DATA store, formatters, helpers, theme, sidebar
    ├── page-overview.js    # Overview, health score, SIP reminder, drawdown analyzer
    ├── page-mf.js          # Mutual Funds page
    ├── page-stocks.js      # Stocks page + tax harvesting
    ├── page-analytics.js   # Analytics + benchmark comparison engine
    ├── page-timeline.js    # Investment timeline + heatmap
    ├── page-goals.js       # Goal planner
    ├── page-tools.js       # Rebalancer, wealth waterfall, action signal, upload/parsing
    └── boot.js             # PAGES router + boot sequence (loads last)
```

> **Load order matters:** `common.js` must load before page modules; `boot.js` must load last.

---

## 🛠️ Tech Stack

* HTML5
* CSS3 (Custom Design System with CSS variables, light/dark theming)
* Vanilla JavaScript (ES6+)
* [Chart.js 4.4](https://www.chartjs.org/) — line, bar, and drawdown charts
* [SheetJS (xlsx 0.18)](https://sheetjs.com/) — Excel file parsing

---

## 💡 Key Highlights

* ⚡ **Zero backend required**
* 📊 Works entirely in browser
* 🔒 Your data stays private (no upload to any server)
* 🧠 Built with real Indian investor use-cases in mind
* 📱 Mobile responsive
* 🇮🇳 Indian number formatting (₹ Lakhs / Crores), LTCG/STCG tax rules, NSE/BSE sectors

---

## 🚀 Live Demo

👉 https://riyazpanarwala.github.io/portfin/

---

## 🔮 Future Improvements

* Live market data integration (NSE API)
* Portfolio persistence (local storage / cloud sync)
* PDF report generation
* Multi-user support
* Advanced AI-based insights

---

## 🤝 Contributing

Contributions, ideas, and suggestions are welcome!

1. Fork the repo
2. Create a feature branch
3. Commit your changes
4. Open a pull request

---

## 👨‍💻 Author

**Riyaz Panarwala**

---

## ⭐ If You Like This Project

Give it a ⭐ on GitHub — it motivates further improvements!
