# CLAUDE.md - Shared Types Package

TypeScript type definitions shared between extension and backend.

## Scope

Defines all data structures for:
- Market data from Polymarket
- Trade requests/responses
- User positions
- API contracts
- AI insight types (sentiment, portfolio analysis, auto-exit)
- Swap types (Uniswap Trading API)

## Commands

```bash
npm run build        # Compile to dist/
npm run type-check   # Type check
```

## Usage

```typescript
import { Market, TradeRequest, Position, Insight } from '@taurus/types';
```

## File Structure

```
src/
├── index.ts         # Re-exports all types
├── api.ts           # API request/response wrappers, MatchResponse
├── markets.ts       # Market, MarketStatus, MarketListRequest
├── positions.ts     # Position, PositionSummary
├── trades.ts        # TradeRequest, TradeResponse, TradeStatus
├── insights.ts      # Insight, PortfolioAnalysis, AutoExitRule, PendingExit
└── swap.ts          # SwapToken, SwapQuoteRequest/Response, SentimentSwapRecommendation
```

## Guidelines

- Use `string` for all monetary values (avoid floating point)
- Use string literals for IDs (addresses, condition IDs)
- Keep types minimal — only fields actually used
