---
name: Vittya Clean FinTech
projectId: projects/17796466189695019339
deviceType: MOBILE
colorMode: LIGHT
roundness: ROUND_EIGHT
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#3f4944'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#6f7973'
  outline-variant: '#bec9c2'
  surface-tint: '#1b6b51'
  primary: '#004532'
  on-primary: '#ffffff'
  primary-container: '#065f46'
  on-primary-container: '#8bd6b7'
  inverse-primary: '#8bd6b6'
  secondary: '#006a63'
  on-secondary: '#ffffff'
  secondary-container: '#99efe5'
  on-secondary-container: '#006f67'
  tertiary: '#5e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#804300'
  on-tertiary-container: '#ffb87e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f2d1'
  primary-fixed-dim: '#8bd6b6'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513b'
  secondary-fixed: '#9cf2e8'
  secondary-fixed-dim: '#80d5cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
  # Custom Brand Tokens
  brand-emerald-deep: '#065f46'
  brand-slate-teal: '#0f766e'
  brand-warm-amber: '#d97706'
  brand-crimson-rose: '#be123c'
  brand-dark-slate: '#1e293b'
typography:
  display-currency:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  display-currency-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-currency:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-pill:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# Design System: Vittya Clean FinTech

**Project:** Group Expense Tracker & UPI Splitter  
**Project ID:** `17796466189695019339`  
**Platform / Form Factor:** Mobile First (with responsive max-width slate for tablet/desktop)  
**Primary Color Theme:** `#065f46` (Emerald Deep)

---

## 1. Brand Philosophy & Aesthetic

The design system is tailored for young urban professionals and roommates in India navigating shared apartment expenses, group travel, weekend dining, and recurring household bills.

- **Design Philosophy:** **Modern Financial Utilitarianism** fused with an executive **Warm Slate High-Contrast** baseline.
- **Core Values:** High financial trust, mathematical transparency, non-frivolous clarity, and friction-free social settlements.
- **Distinctive Affordances:**
  - High-visibility Indian Rupee (`₹`) typography formatted in fixed-width tabular numbers.
  - Tactile micro-interactions for 1-tap UPI app launching and payment confirmations.
  - Horizontal member switcher at the top to toggle active expense contexts effortlessly.

---

## 2. Color System & Palette

### 2.1 Core Brand Colors

| Token | Hex | Usage & Sentiment |
| :--- | :--- | :--- |
| **Primary** | `#065F46` / `#004532` | Signifies asset security, positive balances ("You are owed"), primary action buttons |
| **Secondary** | `#0F766E` / `#006A63` | UPI payment triggers, user switcher chips, category tags |
| **Tertiary** | `#D97706` / `#5E3000` | Pending reconciliation, unconfirmed receipts, partial settlements |
| **Neutral / Dark Slate** | `#1E293B` / `#111C2D` | High-contrast body text, headings, structural contrast |
| **Negative / Crimson** | `#BE123C` / `#BA1A1A` | Debt balances ("You owe"), payment warnings, delete/cancel actions |

### 2.2 Surface & Neutral Scale

| Token | Hex | Role |
| :--- | :--- | :--- |
| `surface-canvas` | `#F8FAFC` / `#F9F9FF` | Primary app canvas background |
| `surface-card` | `#FFFFFF` | Default elevated card container |
| `surface-card-subtle` | `#F1F5F9` | Inactive pills, muted contextual panels |
| `surface-container-high`| `#DEE8FF` | Elevated modal or active highlight backdrop |
| `border-subtle` | `#E2E8F0` | Resting card divider and container outline |
| `border-strong` | `#CBD5E1` | Input field borders, interactive component outlines |

### 2.3 Status Indicator Palette

| State | Background | Text Color | Dot Marker | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| **Pending** | `#FEF3C7` | `#92400E` | Amber (`#D97706`) | Awaiting bill payment or participant contribution |
| **Awaiting Confirmation** | `#E0F2FE` | `#0369A1` | Pulsing Sky Blue (`#0284C7`) | UPI transaction initiated, pending recipient confirmation |
| **Partially Paid** | `#F3E8FF` | `#6B21A8` | Purple (`#9333EA`) | Some members settled, remainder outstanding |
| **Settled** | `#DCFCE7` | `#15803D` | Emerald (`#16A34A`) | 100% reconciled and cleared |

---

## 3. Typography Hierarchy

The system strictly enforces a **Tri-Script Typographic Discipline**:
1. **Space Grotesk**: Architecture & Headings — clean, modern, structural geometry.
2. **Hanken Grotesk**: Reading & UI Text — legibility at small sizes, optimal word pacing.
3. **JetBrains Mono**: Financial Ledger & Codes — strict tabular alignment for currency (`₹`), decimal alignment, split proportions, and state badges.

| Level | Font Family | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **display-currency** | Space Grotesk | `36px` | 700 (Bold) | `44px` | Normal | Large dashboard total owed/owing balance |
| **display-currency-mobile** | Space Grotesk | `28px` | 700 (Bold) | `36px` | Normal | Mobile hero card balances |
| **headline-lg** | Space Grotesk | `24px` | 600 (SemiBold) | `32px` | Normal | Page titles, major section headers |
| **headline-md** | Space Grotesk | `20px` | 600 (SemiBold) | `28px` | Normal | Modal headers, group card titles |
| **body-lg** | Hanken Grotesk | `16px` | 400 (Regular) | `24px` | Normal | Primary descriptions, user names |
| **body-md** | Hanken Grotesk | `14px` | 400 (Regular) | `20px` | Normal | List items, metadata, timestamps |
| **body-sm** | Hanken Grotesk | `12px` | 500 (Medium) | `16px` | Normal | Secondary helper labels, footnotes |
| **label-currency** | JetBrains Mono | `14px` | 600 (SemiBold) | `20px` | Tabular | Expense line items, ledger numbers (`₹1,240.50`) |
| **label-pill** | JetBrains Mono | `11px` | 600 (SemiBold) | `14px` | `0.05em` | Status chips, UPI transaction badges |

---

## 4. Layout, Spacing & Grid System

- **Layout Grid**: 4px base rhythm.
- **Mobile Viewport (<768px)**:
  - 1-column fluid vertical flow.
  - Page margin: `16px` (`margin: 1rem`).
  - Edge-to-edge ribbons for balance summaries.
  - Sticky bottom floating bar for rapid UPI actions.
- **Tablet / Desktop Viewport (≥768px)**:
  - Centered container with max width: `680px` – `720px`.
  - Margin: `24px`.
  - 2-column distribution for summary vs. ledger stream where appropriate.

### Spacing Tokens

| Token | Rem | Pixels | Application |
| :--- | :--- | :--- | :--- |
| `space-xs` | `0.25rem` | `4px` | Icon-to-text gap, badge internal padding |
| `space-sm` | `0.5rem` | `8px` | Component internal gaps, pill padding, list item compact margins |
| `space-md` | `1.0rem` | `16px` | Default card padding, container gap, horizontal page padding |
| `space-lg` | `1.5rem` | `24px` | Section separators, modal inner margins |
| `space-xl` | `2.0rem` | `32px` | Major page section blocks, bottom sheet top offsets |

---

## 5. Shapes, Borders & Elevation

### 5.1 Corner Radius Scale

| Token | Value | Applied To |
| :--- | :--- | :--- |
| `rounded-sm` | `0.25rem` (4px) | Badges, small tags, tooltips |
| `rounded-DEFAULT` | `0.5rem` (8px) | Buttons, text input boxes, dropdown selectors |
| `rounded-md` | `0.75rem` (12px) | Sub-cards, nested ledger items |
| `rounded-lg` | `1.0rem` (16px) | Top-level summary cards, transaction blocks, modals |
| `rounded-xl` | `1.5rem` (24px) | Hero balance panels, bottom sheets |
| `rounded-full` | `9999px` | User avatar nodes, status pills, floating action buttons |

### 5.2 Elevation & Shadow Hierarchy

- **Level 0 (Canvas Base):** Flat `#F8FAFC`, no shadow.
- **Level 1 (Card Containers):**
  - Background: `#FFFFFF`
  - Border: `1px solid #E2E8F0`
  - Box Shadow: `0 1px 3px rgba(15, 23, 42, 0.05)`
- **Level 2 (Active Context / Member Switcher):**
  - Background: `#F1F5F9`
  - Border: `1px solid #CBD5E1`
  - Box Shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08)`
- **Level 3 (Bottom Drawers & Modals):**
  - Background: `#FFFFFF`
  - Backdrop Blur: `8px`
  - Box Shadow: `0 -4px 16px rgba(15, 23, 42, 0.12)`
  - Border: `1px solid #E2E8F0`

---

## 6. Core Component Guidelines

### 6.1 User Context Switcher
- **Structure:** Horizontal scroll-snap row pinned below the header navigation.
- **Participants:** Avatars with initials / pictures (e.g., Niraj, Rahul, Priya, Ananya, Vikram).
- **Active State:** `#065F46` solid background with pure white text and an outer ring indicator (`2px solid #065F46` offset 2px).
- **Inactive State:** Soft slate badge (`#F1F5F9`) with `#3F4944` text and subtle `1px solid #E2E8F0` border.

### 6.2 UPI Settlement & Action Buttons
- **Primary UPI Trigger:** Full-width `#0F766E` slate teal button with bold label and UPI logo/glyph.
- **Micro-Interaction:** 0.98 scale compress on active click, shifting to background `#115E59`.
- **Payment Link Generation:** Dynamic payload formatted for `upi://pay?pa=...&pn=...&am=...&cu=INR`.

### 6.3 Expense Cards & Ledger Rows
- **Left Column:** Category icon in rounded pill with category name and timestamp (`Hanken Grotesk`, `12px`).
- **Center:** Member split attribution (e.g., `Niraj paid ₹1,200 · Priya owes ₹300`).
- **Right Column:** High-contrast net balance formatted strictly in `JetBrains Mono`. Green `#065F46` for "+ ₹X" (owed to you), Crimson `#BE123C` for "- ₹X" (you owe).

### 6.4 Numeric & Amount Inputs
- **Prefix:** Non-editable, prominent `₹` sign anchored inside the input container.
- **Font:** `JetBrains Mono` at `24px` or `28px` for instant readability.
- **Focus Ring:** 2px solid `#065F46` with 2px emerald halo blur.

---

## 7. Project Screen Inventory

Mapped from Stitch project `projects/17796466189695019339`:

| Screen Title | Screen ID | Canvas Dimensions | Purpose |
| :--- | :--- | :--- | :--- |
| **Select User - Onboarding** | `db155d664faf47e8808c0a5b040ce4e4` | 780 × 1896 (Mobile) | Initial identity selection and profile configuration |
| **Dashboard** | `2dfd6a44267f4c57b43dec8ed9ad1380` | 780 × 2984 (Mobile) | Total balance breakdown, quick action bar, recent activities |
| **Dashboard v2.0** | `a72b6a1c59244c8daf9fa8486a02e549` | 780 × 2316 (Mobile) | Streamlined mobile summary with consolidated settlement drawer |
| **Add Expense** | `8b80430f0d4e4473ae7f0e8451a79c04` | 780 × 3818 (Mobile) | Category picker, multi-member split configuration (equal, unequal, percentage) |
| **Add Expense v2.0** | `faae1938579844e18fce51b3cc763a2d` | 780 × 3170 (Mobile) | Rapid expense flow with auto UPI payee detection |
| **All Expenses** | `5ed4bce65646412ba4957a485500c722` | 780 × 3426 (Mobile) | Chronological expense ledger with month & category filters |
| **All Expenses v2.0** | `ce935aa7ccc543f2a86b3327197d70de` | 780 × 1768 (Mobile) | Compact transaction ledger with inline settlement badges |
| **Money Splitter and Settlements** | `fcc59d4bad32479aa2d63a905e392aeb` | 780 × 3012 (Mobile) | Debt simplification graph and person-to-person settlement matrix |
| **Settle & UPI v2.0** | `88996b7beffc428d882becf28e3ea825` / `32fb0a7a87d9436b959134d3ea966d09` | 390 × 884 / 780 × 3024 | UPI deep-linking intent screen with QR generator and status confirmation |

---

## 8. CSS Design Tokens (Implementation Snippet)

```css
:root {
  /* Fonts */
  --font-headline: 'Space Grotesk', -apple-system, sans-serif;
  --font-body: 'Hanken Grotesk', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Brand Colors */
  --color-primary: #065f46;
  --color-primary-dark: #004532;
  --color-primary-light: #8bd6b7;
  --color-secondary: #0f766e;
  --color-secondary-dark: #006a63;
  --color-secondary-light: #99efe5;
  --color-tertiary: #d97706;
  --color-negative: #be123c;
  --color-dark-slate: #1e293b;

  /* Surfaces */
  --surface-canvas: #f8fafc;
  --surface-card: #ffffff;
  --surface-card-subtle: #f1f5f9;
  --border-subtle: #e2e8f0;
  --border-strong: #cbd5e1;

  /* Status Colors */
  --status-pending-bg: #fef3c7;
  --status-pending-text: #92400e;
  --status-awaiting-bg: #e0f2fe;
  --status-awaiting-text: #0369a1;
  --status-partial-bg: #f3e8ff;
  --status-partial-text: #6b21a8;
  --status-settled-bg: #dcfce7;
  --status-settled-text: #15803d;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --radius-full: 9999px;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
}
```
