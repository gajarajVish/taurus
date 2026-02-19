# CLAUDE.md - Shared Types Package

TypeScript type definitions shared between extension and backend.

## Scope

Defines all data structures for:
- Market data from Polymarket
- Trade requests/responses
- User positions (real and shadow)
- Wallet/authentication state
- API contracts

## Commands

```bash
npm run build        # Compile to dist/
npm run type-check   # Type check
```

## Usage

```typescript
import { Market, TradeRequest, WalletState } from '@polyoverlay/types';
```

## File Structure

```
src/
├── index.ts         # Re-exports all types
├── api.ts           # API request/response wrappers
├── markets.ts       # Market, Outcome, MarketStatus
├── positions.ts     # Position, ShadowPosition
├── trades.ts        # TradeRequest, TradeResponse
└── wallet.ts        # WalletState, AuthState
```

## Type Categories

### Markets (`markets.ts`)
```typescript
interface Market {
  id: string;              // condition_id
  question: string;
  outcomes: Outcome[];
  yesPrice: string;        // Current YES price (0-1)
  volume: string;          // Total volume USD
  status: MarketStatus;
}
```

### Trades (`trades.ts`)
```typescript
interface TradeRequest {
  marketId: string;
  outcome: 'yes' | 'no';
  amount: string;          // USD amount
  mode: 'guest' | 'authenticated';
}
```

### Positions (`positions.ts`)
```typescript
interface Position {
  marketId: string;
  outcome: 'yes' | 'no';
  shares: string;
  avgPrice: string;
  currentValue: string;
  pnl: string;
  isSimulated: boolean;    // true for guest mode
}
```

### Wallet (`wallet.ts`)
```typescript
type WalletState =
  | { mode: 'guest'; installId: string; points: number }
  | { mode: 'authenticated'; address: string; provider: 'privy' | 'metamask' };
```

## Guidelines

- Use `string` for all monetary values (avoid floating point)
- Use string literals for IDs (addresses, UUIDs)
- Prefix shadow/simulated types with `isSimulated` flag
- Keep types minimal—only fields actually used
