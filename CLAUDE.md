# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Product Overview

Taurus is a Chrome extension that brings Polymarket prediction markets directly into X.com (Twitter). Users can view market odds and place trades without leaving their feed.

**Target Users:**
- **Guests**: X users who want to "test their takes" with simulated PolyPoints
- **Power Users**: Existing Polymarket traders who want low-friction trading on breaking news

## Core Features

1. **Injected Market Widget**: Appears below tweets matching active Polymarket conditions. Shows market question, YES price, volume, and YES/NO buttons.
2. **One-Tap Trading**: Inline modal with amount input, estimated payout, and instant execution.
3. **Dual-State Wallet**: Guest mode (PolyPoints via Shadow Account) or Authenticated mode (real USDC via Privy/MetaMask).

## Architecture

```
packages/
├── extension/      # Chrome extension (React + Vite + Manifest V3)
├── backend/        # API server (Fastify + TypeScript)
├── website/        # Standalone website (future)
└── shared/
    ├── types/      # Shared TypeScript types (@taurus/types)
    └── utils/      # Shared utilities (future)
```

## Commands

```bash
npm install          # Install all dependencies
npm run dev:ext      # Extension with hot reload
npm run dev:api      # Backend dev server
npm run build        # Build all packages
npm run type-check   # Type check all packages
```

## Key Technical Constraints

- **Performance**: Extension must not increase X page load by >200ms
- **Security**: Wallet interactions via secure popup or Privy embedded signer (never expose keys to X DOM)
- **Matching**: MVP uses "Keyword + LLM" bridge for top 100 high-volume markets

## Tech Stack

- **Extension**: React, TypeScript, Vite, @crxjs/vite-plugin, Shadow DOM
- **Backend**: Node.js, Fastify, Zod, ethers.js/viem
- **Blockchain**: Polygon Mainnet, Polymarket CLOB API
- **Auth**: Privy or MetaMask for wallet connection

## UI Guidelines

- **Native-First**: Use X's Chirp font and CSS variables
- **Accent Color**: Polymarket Blue (#0072ff) for actionable elements
- **Minimalist**: Widget should be collapsible

## 0G AI Enhancement

Taurus integrates with the 0G Compute Network for decentralized AI-powered sentiment analysis. The system analyzes tweets users view to provide trading insights.

### Architecture Flow

1. **Tweet Recording**: When a user views a tweet with a Polymarket widget, the extension records the view via `POST /api/tweets/view`
2. **Session Aggregation**: Backend stores views per user+market until threshold is met (default: 3 tweets)
3. **0G Inference**: When threshold is met, backend sends aggregated tweets to 0G Compute for sentiment analysis
4. **Insight Delivery**: Analysis results are cached and available via `GET /api/insights/:marketId`
5. **UI Display**: Sidecar shows "AI Insights" tab; TradeModal shows simulation preview

### Key Files

- `packages/backend/src/services/og/inference.ts` - 0G broker initialization and inference calls
- `packages/backend/src/services/session/views.ts` - In-memory session store for tweet views
- `packages/backend/src/services/insights/aggregator.ts` - Orchestrates analysis pipeline
- `packages/backend/src/routes/tweets.ts` - Tweet view recording API
- `packages/backend/src/routes/insights.ts` - Insights retrieval API
- `packages/extension/src/sidepanel/components/InsightsTab.tsx` - Sidecar insights UI
- `packages/extension/src/sidepanel/components/InsightCard.tsx` - Individual insight display
- `packages/shared/types/src/insights.ts` - Type definitions

### Environment Variables

```
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_COMPUTE_PRIVATE_KEY=your-0g-compute-private-key
```

### Context7 MCP Requirement

When implementing or modifying 0G-related code, **always use Context7 MCP** to fetch current documentation:

```
Use Context7 MCP (library ID: /0glabs/0g-doc) to fetch current 0G Compute SDK,
Storage SDK, and inference API documentation before implementing.
Do not rely on training data for 0G-specific code.
```

### Insight Data Structure

```typescript
interface Insight {
  marketId: string;
  summary: string;           // AI-generated explanation
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;             // 0-1 confidence
  consensusShift: number;    // -1 to 1 expected price move
  tweetCount: number;
  riskFlags: string[];
  opportunityScore: number;  // 0-1
  timestamp: string;
}
```
