# 🏔️ Trip Expense Tracker & Group Money Splitter

A modern, mobile-first web application designed for group trips, vacations, and shared expenses. Log direct personal spendings, split group bills with flexible distribution models, track pairwise debts, and settle up via instant UPI deep-links and WhatsApp group summaries.

### ✨ Key Features
- **📊 Real-time Dashboard**: Track your exact individual spend, today's outlays, expected receivables, and debts with live net standing calculations.
- **⚡ Smart Group Splitter**: Support for equal, exact, percentage, and custom share splits, with upfront partial contribution handling.
- **🤝 Pairwise Settlements**: Isolated debtor-to-creditor tracking (`from` & `to`) preventing cross-creditor settlement bleed.
- **💳 One-Tap UPI Payments**: Automatically generates pre-filled UPI payment links (`upi://pay`) with receiver UPI ID and exact due amount.
- **💬 WhatsApp Summaries**: Generate formatted group debt breakdowns ready to share in your trip group chat with one click.
- **🏷️ Dynamic Trip Branding**: Automatically syncs destination name and icons directly from Google Sheets or environment config.
- **📱 Mobile-First UX**: Accordion-based cards to minimize scrolling, responsive gesture gates, and high-contrast Material-inspired aesthetic.

### 🛠️ Tech Stack
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Material Symbols
- **State & Caching**: TanStack React Query v5
- **Backend Sync**: Express + Google Sheets API v4

---

### 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:5173`.

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Lint Code**:
   ```bash
   npm run lint
   ```

