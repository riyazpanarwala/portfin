# PortFin — Intelligent Portfolio Analytics & Decision Engine

* 🔗 **Live Demo:** https://riyazpanarwala.github.io/portfin/
* 📦 **GitHub Repo:** https://github.com/riyazpanarwala/portfin

---

## 🚀 Overview

**PortFin** is a powerful, Excel-driven portfolio analytics dashboard built using **pure HTML, CSS, and JavaScript**.

It is designed for investors who want:

* 📈 Benchmark-aware performance tracking
* 🧠 Actionable investment decisions
* ⚠️ Risk and allocation insights

> Not just “What is happening” — but **“What should I do next?”**

---

## 🔥 What’s New (Latest Updates)

* 📊 **Portfolio Rebalancing Advisor (NEW PAGE)**
* ⏰ **SIP Reminder & Next Action Panel**
* 📱 **Mobile-Responsive Sidebar Navigation**
* 📤 **Export Portfolio Data to CSV**
* 🌗 **Dark / Light Theme Toggle**

---

## 📊 Core Features

### 📈 Portfolio Analytics

* Total Investment, Current Value, P&L
* CAGR & XIRR calculations
* Portfolio health score
* Sector allocation
* Top gainers & losers

---

### 📊 Advanced Benchmark System

* Category-based benchmark mapping
* Time-aligned comparison using holding period
* Portfolio-level benchmark comparison
* Alpha calculation

📌 **Formula:**

```id="r4j3c6"
Alpha = Fund/Portfolio CAGR − Benchmark CAGR
```

---

### 🧠 Decision Engine

| Condition               | Action    |
| ----------------------- | --------- |
| Alpha < -3% (long hold) | ❌ EXIT    |
| Alpha -3% to 1%         | ⚠️ REDUCE |
| Alpha 1% to 3%          | ➖ HOLD    |
| Alpha > 3%              | ✅ ADD     |

👉 Converts analysis into **clear actions**

---

### 🔄 Portfolio Rebalancing Advisor

* Detects allocation imbalance
* Highlights overweight / underweight sectors
* Suggests rebalancing strategy

👉 Helps maintain **optimal portfolio structure**

---

### ⏰ SIP Reminder & Next Action Panel

* Tracks upcoming SIP actions
* Suggests next investment steps
* Keeps monthly investing disciplined

---

### 📱 Mobile-Friendly UI

* Responsive sidebar navigation
* Optimized layout for smaller screens
* Smooth usability across devices

---

### 📤 Export System

* Export portfolio data to CSV
* Useful for:

  * Offline analysis
  * Record keeping
  * Sharing

---

### 🌗 Theme Support

* Dark mode (default)
* Light mode toggle
* Improved readability and accessibility

---

## 📂 Excel-Based Workflow

* No backend required
* Replace Excel → auto update
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

```id="cx6p2r"
git clone https://github.com/riyazpanarwala/portfin.git
cd portfin
```

---

### 2. Add Your Data

Replace Excel files (Mutual Funds / Stocks)

> ⚠️ Keep structure unchanged

---

### 3. Run Locally

```id="qj5gso"
open index.html
```

---

### 4. Monthly Workflow

* Update Excel
* Refresh browser
* Done ✅

---

## 🎯 Why PortFin?

Most tools show:

> “Your portfolio is up 12%”

**PortFin shows:**

* Are you beating the market?
* What is underperforming?
* What action you should take
* How to rebalance your portfolio
* What to do next (SIP + allocation)

---

## 🚀 Upcoming Enhancements

* Smart ₹25K allocation engine
* API-based live data integration

---

## 🤝 Contributing

Suggestions welcome:

* Analytics improvements
* UI/UX enhancements
* Performance optimization

---

## 👨‍💻 Author

**Riyaz Panarwala**
---

⭐ If you find this useful, consider starring the repo!
