# Taurus

A Chrome extension that brings Polymarket data to X.com (Twitter).

This PRD focuses on the core value proposition: contextual prediction markets integrated into social scrolling.

---

## Product Requirements Document (PRD): Taurus v1.0

### 1. Problem & Vision

**Problem:** Prediction markets (Polymarket) are currently "destination sites." Users have to leave their news source (X) to check odds or trade.

**Vision:** Turn X into a live prediction layer where every claim is instantly "bet-able," increasing market liquidity and user accountability.

### 2. Target Audience

**The Casual (Guest):** X users interested in news/politics who want to "test their takes" without financial risk.

**The Power User (Trader):** Existing Polymarket users who want a high-velocity, low-friction interface to trade on breaking news.

### 3. Core Feature Specifications

#### A. The Injected Market Widget

- **Trigger:** Extension scans tweet text and matches it to an active Polymarket condition_id.
- **UI Placement:** Injected between the tweet body and the native action icons (Like/RT).
- **Data Points:** Market Question, Current "Yes" Price, Total Volume.
- **Actions:** Immediate [ YES ] and [ NO ] buttons.

#### B. The "One-Tap" Trading Flow

- **Inline Modal:** Triggered upon clicking Yes/No.
- **Inputs:** Amount field (USD or PolyPoints) and "Estimated Payout" calculator.
- **Execution:**
  - *Guest Mode:* Simulated trade recorded to local storage/central DB.
  - *Power Mode:* Direct interaction with Polymarket CLOB (Central Limit Order Book) via Polygon Mainnet.

#### C. Dual-State Wallet System

- **Unauthenticated State:** Uses a "Shadow Account" to track "PolyPoints" (testnet/simulated funds) to gamify the experience for new users.
- **Authenticated State:** Connect via Privy or MetaMask. Enables real USDC trades.
- **Feature:** Default trade sizes (e.g., $10, $50, $100) to minimize keystrokes.

### 4. Technical Constraints (MVP)

- **Matching Logic:** Initial MVP will use a "Keyword + LLM" bridge. If a tweet contains specific keywords matching top 100 high-volume markets, the widget appears.
- **Performance:** The extension must not increase X page load time by >200ms.
- **Security:** Wallet interactions must happen via a secure popup or a trusted embedded signer (like Privy) to ensure user keys are never exposed to the X DOM.

### 5. Success Metrics

- **Conversion Rate:** % of Guest users who eventually connect a real wallet.
- **Trade Velocity:** Average time from "Tweet Impression" to "Trade Execution" (Goal: < 5 seconds).
- **Retention:** Number of markets interacted with per user per week.

### 6. UI/UX "Vibe" Guide

- **Native-First:** Use X's Chirp font and CSS variables for background colors.
- **High Contrast:** Use Polymarket Blue (#0072ff) for buttons to distinguish "Actionable" data from "Social" data.
- **Minimalist:** The widget should be collapsible if the user finds it intrusive.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/taurus.git
cd taurus

# Install dependencies
npm install
```

### Development

```bash
# Start extension development (with hot reload)
npm run dev:ext

# Start backend server
npm run dev:api
```

### Loading the Extension

1. Build the extension: `npm run dev:ext`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `packages/extension/dist` folder

## Project Structure

```
packages/
├── extension/      # Chrome extension
├── backend/        # API server
├── website/        # Standalone website (future)
└── shared/
    ├── types/      # Shared TypeScript types
    └── utils/      # Shared utilities
```

## Tech Stack

- **Extension**: React, TypeScript, Vite, Chrome Manifest V3
- **Backend**: Node.js, Fastify, TypeScript
- **Blockchain**: Polygon, Polymarket API

## License

MIT
