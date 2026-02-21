# CLAUDE.md - Extension Package

Chrome Manifest V3 extension that injects Polymarket widgets into X.com tweets and provides a trading sidepanel.

## Scope

This package handles all client-side functionality:
- Tweet detection and market matching
- Widget UI injection (Shadow DOM)
- Trading flow UI (buy/sell modals)
- Wallet state management (Guest vs Authenticated)
- Sidepanel dashboard (portfolio, insights, swaps, trending markets)
- Auto-exit monitoring via background service worker
- Communication with backend API

## Commands

```bash
npm run dev          # Build with watch mode (hot reload)
npm run build        # Production build
npm run type-check   # TypeScript type checking
```

## Architecture

```
src/
├── background/
│   └── index.ts              # Service worker: auto-exit polling, wallet signing, trade execution
├── content/
│   ├── index.tsx             # Content script entry point
│   ├── observer.ts           # MutationObserver for detecting new tweets
│   ├── shared/
│   │   ├── createShadowRoot.ts  # Shadow DOM creation helper
│   │   └── messaging.ts        # Content script messaging utilities
│   └── tweet/
│       ├── detector.ts       # Tweet ID extraction strategies
│       ├── injector.ts       # Widget injection logic
│       ├── styles.ts         # Injected widget CSS
│       ├── TweetButtons.tsx  # YES/NO buttons widget
│       └── TradeModal.tsx    # Inline trade modal
├── sidepanel/
│   ├── index.html            # Sidepanel HTML entry
│   ├── index.tsx             # Sidepanel React entry
│   ├── styles.css            # Design system CSS
│   ├── Sidecar.tsx           # Main sidepanel component
│   └── components/
│       ├── Header.tsx            # Header with wallet connection
│       ├── Tabs.tsx              # Tab navigation
│       ├── PortfolioTab.tsx      # Portfolio analysis tab
│       ├── TrendingMarketsTab.tsx # Markets browser
│       ├── InsightsTab.tsx       # AI insights display
│       ├── SwapTab.tsx           # Token swap interface
│       ├── MetricsCard.tsx       # Portfolio metrics
│       ├── PositionsCard.tsx     # Positions list
│       ├── PositionItem.tsx      # Individual position row
│       ├── PositionDetailModal.tsx # Position details
│       ├── BuyModal.tsx          # Buy order modal
│       ├── SellModal.tsx         # Sell order modal
│       ├── SwapModal.tsx         # Swap execution modal
│       ├── PortfolioStatsRow.tsx  # Portfolio stats
│       ├── PortfolioRiskModal.tsx # Risk analysis modal
│       ├── InsightCard.tsx       # AI insight card
│       ├── AutoExitEditor.tsx    # Auto-exit rules editor
│       ├── PendingExitBanner.tsx  # Pending exit notifications
│       ├── TokenSelector.tsx     # Token dropdown
│       ├── SlideMenu.tsx         # Settings slide menu
│       ├── Sparkline.tsx         # Mini chart component
│       ├── Badge.tsx             # Badge component
│       └── Accordion.tsx         # Accordion component
└── lib/
    ├── api.ts                # Backend API client
    ├── storage.ts            # Chrome storage helpers
    └── wallet.ts             # Wallet state management
```

## Component Interactions

```
X.com Page → Content Script (observer.ts)
                ↓
         Match tweet to market (detector.ts → backend /api/match)
                ↓
         Inject Widget via Shadow DOM (injector.ts → TweetButtons.tsx)
                ↓
         User clicks YES/NO
                ↓
         TradeModal opens (inline)
                ↓
         Background script → Backend API → Polymarket CLOB
```

## Key Implementation Details

### Tweet Detection
- MutationObserver watches for new tweet elements on X.com
- Tweet text extracted and sent to backend `/api/match` endpoint
- Matched markets get a widget injected below the tweet

### Shadow DOM
All injected UI uses Shadow DOM to isolate styles from X.com CSS.

### Sidepanel
Full dashboard accessible via the extension icon:
- **Portfolio** — positions, P&L, risk analysis
- **Insights** — AI-generated sentiment from tweet aggregation
- **Trending** — browse top Polymarket markets
- **Swap** — sentiment-based token swaps (Uniswap on Sepolia)

### Auto-Exit
Background service worker polls the backend every 15s for pending exits triggered by user-configured rules (P&L thresholds, risk scores).

## UI Guidelines

- Use X's Chirp font via CSS variable inheritance
- Background: match X's current theme (light/dark)
- Accent: Polymarket Blue (#0072ff) for actionable elements
- Widget is collapsible
