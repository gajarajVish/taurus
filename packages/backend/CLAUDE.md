# CLAUDE.md - Backend Package

Node.js API server (Fastify + TypeScript) that interfaces with Polymarket CLOB and Polygon chain.

## Scope

This package handles:
- Market data aggregation from Polymarket API
- Guest mode shadow account tracking (PolyPoints)
- Authenticated trade execution via CLOB
- Wallet signature verification

## Commands

```bash
npm run dev          # Dev server with hot reload
npm run build        # Compile TypeScript
npm run start        # Run compiled code
npm run type-check   # Type check
```

## Architecture

```
src/
├── index.ts         # Entry point
├── server.ts        # Fastify setup, middleware, routes
├── routes/
│   ├── markets.ts   # Market data endpoints
│   ├── positions.ts # Position queries
│   ├── trades.ts    # Trade execution
│   └── auth.ts      # Wallet authentication
├── services/
│   ├── polymarket/  # Polymarket CLOB client
│   │   ├── client.ts
│   │   ├── markets.ts
│   │   └── trading.ts
│   ├── polygon/     # Polygon chain interactions
│   │   └── provider.ts
│   └── shadow/      # Guest mode shadow accounts
│       └── accounts.ts
├── middleware/
│   ├── auth.ts      # JWT verification
│   └── validation.ts
└── config/
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/markets` | No | List top markets (cached) |
| GET | `/api/markets/:id` | No | Market details + current prices |
| POST | `/api/auth/login` | No | Verify wallet signature, return JWT |
| GET | `/api/positions` | Yes | User positions (real or shadow) |
| POST | `/api/trades` | Yes | Execute trade |
| GET | `/api/shadow/balance` | Guest | Get PolyPoints balance |

## Dual-State Trading

### Guest Mode (PolyPoints)
- Shadow account stored in DB (keyed by extension install ID)
- Simulated trades recorded with current market prices
- PolyPoints are testnet/gamified funds
- No blockchain interaction

### Authenticated Mode (Real USDC)
- User connects Privy or MetaMask
- JWT issued after signature verification
- Trades submitted to Polymarket CLOB
- Requires Polygon Mainnet USDC

## Environment Variables

```
PORT=3000
NODE_ENV=development
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/KEY
POLYMARKET_API_URL=https://clob.polymarket.com
JWT_SECRET=your-secret
DATABASE_URL=postgres://... (for shadow accounts)
```

## Polymarket CLOB Integration

Docs: https://docs.polymarket.com/

Key operations:
- Fetch market data (prices, volume, outcomes)
- Submit orders to order book
- Query order status

## Security

- Private keys never touch the server
- All trade signing happens client-side (extension)
- Server verifies signatures, submits pre-signed transactions
- Rate limiting on all endpoints
- CORS: extension origin only in production
- Input validation via Zod
