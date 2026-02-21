# CLAUDE.md - Backend Package

Node.js API server (Fastify + TypeScript) that interfaces with Polymarket, 0G AI, and Uniswap.

## Scope

This package handles:
- Market data aggregation from Polymarket Gamma API
- Tweet-to-market keyword matching
- AI-powered sentiment analysis and portfolio insights (via 0G Network)
- Position queries via Polymarket Data API
- Trade submission to Polymarket CLOB
- Token swap proxying via Uniswap Trading API
- Auto-exit monitoring with AI confirmation

## Commands

```bash
npm run dev          # Dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript
npm run start        # Run compiled code
npm run type-check   # Type check
```

## Architecture

```
src/
├── index.ts                    # Entry point (dotenv, server startup)
├── server.ts                   # Fastify setup, CORS, route registration
├── config/
│   └── index.ts                # Typed config from env vars
├── routes/
│   ├── markets.ts              # GET /api/markets, /api/markets/:id
│   ├── match.ts                # POST /api/match (tweet → market matching)
│   ├── positions.ts            # GET /api/positions/:address
│   ├── trades.ts               # POST /api/trades
│   ├── insights.ts             # GET/PUT /api/insights, POST /api/insights/portfolio
│   ├── tweets.ts               # POST /api/tweets/view (record tweet views)
│   ├── automation.ts           # POST /api/automation/sync, /test-exit, GET /pending
│   ├── swap.ts                 # POST /api/swap/* (Uniswap proxy)
│   └── sentiment-swap.ts       # POST /api/sentiment-swap/analyze
├── services/
│   ├── polymarket/
│   │   ├── client.ts           # Gamma API HTTP client with retry
│   │   ├── markets.ts          # Market normalization and caching
│   │   ├── positions.ts        # Position fetching (+ mock data for dev)
│   │   └── trade.ts            # CLOB order submission
│   ├── og/
│   │   ├── inference.ts        # 0G broker, LLM inference, local fallbacks
│   │   └── signals.ts          # Pre-computed quantitative signals for prompts
│   ├── insights/
│   │   └── aggregator.ts       # Tweet aggregation, insight caching, periodic scanner
│   ├── matching/
│   │   └── keywords.ts         # Keyword tokenization for tweet matching
│   ├── automation/
│   │   └── monitor.ts          # Auto-exit rule evaluation and AI confirmation
│   └── session/
│       └── views.ts            # In-memory session store for tweet views
├── middleware/                  # (placeholder)
└── test-0g.ts                  # Standalone 0G integration test script
scripts/
└── test-auto-exit.ts           # CLI tool for testing the auto-exit pipeline
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/markets` | List top markets (cached) |
| GET | `/api/markets/:conditionId` | Single market details |
| POST | `/api/match` | Match tweet text to a market |
| GET | `/api/positions/:address` | User positions from Polymarket |
| POST | `/api/trades` | Submit a signed trade to CLOB |
| POST | `/api/tweets/view` | Record a tweet view for insight aggregation |
| GET | `/api/insights` | All cached insights for a user |
| GET | `/api/insights/:marketId` | Single market insight |
| GET/PUT | `/api/insights/settings` | AI insight settings per user |
| POST | `/api/insights/portfolio` | Portfolio risk analysis |
| POST | `/api/automation/sync` | Sync positions + evaluate auto-exit rules |
| GET | `/api/automation/pending` | Pending exit signals |
| POST | `/api/swap/*` | Uniswap Trading API proxy |
| POST | `/api/sentiment-swap/analyze` | AI swap recommendation from tweet |

## 0G AI Integration

The backend uses 0G's decentralized compute network for LLM inference. When 0G is not configured or the ledger is unfunded, all analysis falls back to local keyword-based heuristics.

Used for:
- Tweet sentiment analysis (bullish/bearish/neutral scoring)
- Portfolio risk assessment (concentration, correlation, hedging suggestions)
- Swap recommendations (token swap signals from tweet sentiment)
- Auto-exit confirmation (AI validates threshold-triggered exits)

## Environment Variables

```
PORT=3000
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_COMPUTE_PRIVATE_KEY=<your-0g-wallet-key>
UNISWAP_API_KEY=<your-uniswap-api-key>
MOCK_POSITIONS=false
```
