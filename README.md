# PortFin — Intelligent Portfolio Analytics Dashboard

* 🔗 **Live Demo:** https://riyazpanarwala.github.io/portfin/
* 📦 **GitHub Repo:** https://github.com/riyazpanarwala/portfin

---

## 🚀 Overview

**PortFin** is a powerful, Excel-driven portfolio analytics dashboard built using **pure HTML, CSS, and JavaScript**.

It goes beyond basic tracking and delivers:

* 📈 Benchmark-aware performance analysis
* 🧠 Actionable investment decisions
* ⚠️ Risk and allocation insights

Designed for serious investors who want **clarity, not just data**.

---

## 🔥 What Makes PortFin Different

Most tools show returns.

**PortFin tells you:**

* Are you beating the market?
* Which investments are underperforming?
* What you should do next (ADD / HOLD / REDUCE / EXIT)

---

## 📊 Core Features

### 📈 Portfolio Analytics

* Total Investment, Current Value, P&L
* CAGR & XIRR calculations
* Portfolio health score
* Sector allocation
* Top performers & laggards

---

### 📊 Advanced Benchmark Analysis (Upgraded 🔥)

* Portfolio vs Benchmark comparison
* Fund-level benchmark mapping (category-based)
* Time-aligned CAGR comparison (based on holding period)
* Alpha calculation (true outperformance)
* Beat / Trail / Close classification
* Interactive Chart.js visualization (normalized growth)

📌 **Alpha Formula:**

```
Alpha = Fund/Portfolio CAGR − Benchmark CAGR
```

---

### 🧠 Alpha Intelligence Layer

* Total funds analyzed
* Funds beating benchmark
* Average alpha
* Best & worst performers

👉 Converts raw data into **performance insights**

---

### ⚡ Decision Engine (NEW 🔥)

Each fund is automatically classified:

| Condition               | Action    |
| ----------------------- | --------- |
| Alpha < -3% (long hold) | ❌ EXIT    |
| Alpha -3% to 1%         | ⚠️ REDUCE |
| Alpha 1% to 3%          | ➖ HOLD    |
| Alpha > 3%              | ✅ ADD     |

✔ Integrated into:

* Fund tables
* Analyst insights section

👉 Turns dashboard into a **decision-making system**

---

### ⚠️ Risk & Behavior Insights

* Overexposure alerts
* Concentration warnings
* Underperformer detection
* Portfolio health scoring

---

### 📅 Visual Intelligence

* Benchmark vs portfolio growth chart
* Performance trends
* Clean dark UI for long usage

---

### 📂 Excel-Driven Workflow

* No backend required
* Replace Excel → auto-update dashboard
* Ideal for monthly tracking

---

## 🛠️ Tech Stack

* HTML5
* CSS3 (Custom UI, no frameworks)
* Vanilla JavaScript
* Chart.js

---

## ⚙️ How It Works

1. Upload / replace Excel files
2. Data is parsed into internal `DATA` structure
3. Benchmark + alpha + decision logic is applied
4. UI updates automatically

---

## 📥 Getting Started

### 1. Clone Repository

```
git clone https://github.com/riyazpanarwala/portfin.git
cd portfin
```

---

### 2. Add Your Portfolio Data

Replace Excel files (Mutual Funds / Stocks)

> ⚠️ Keep structure unchanged

---

### 3. Run Locally

Open:

```
index.html
```

---

### 4. Monthly Workflow

* Update Excel
* Refresh browser
* Done ✅

---

## 🧠 Benchmark System (Core Logic)

* Category-based benchmark mapping
* Time-aligned comparison using holding period
* Portfolio-level alpha calculation

### Output:

* Beat / Trail / Close
* Actionable insights
* Performance validation vs market

---

## 🎯 Use Case

Perfect for:

* Long-term investors
* Stock + Mutual Fund portfolios
* DIY portfolio managers
* Data-driven decision makers

---

## 🚀 Upcoming Enhancements

* Smart monthly allocation engine (₹25K strategy)
* API-based live data integration

---

## 🤝 Contributing

Open to improvements:

* Analytics enhancements
* UI/UX upgrades
* Performance optimizations

---

## 📜 License

MIT License

---

## 👨‍💻 Author

**Riyaz Panarwala**

---

⭐ If you find this useful, consider starring the repo!
