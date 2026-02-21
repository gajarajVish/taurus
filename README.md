# Taurus

Polymarket prediction markets, embedded directly into X.com. View odds and trade without leaving your feed.

## How It Works

1. **Detect** — A content script scans tweets and matches them to active Polymarket markets via keyword + LLM matching.
2. **Display** — A widget appears below matched tweets showing the market question, YES price, volume, and action buttons.
3. **Trade** — One tap opens an inline modal. Guests trade with simulated PolyPoints; authenticated users trade real USDC on Polygon via the Polymarket CLOB.
4. **Analyze** — AI-powered insights (via [0G Network](https://0g.ai)) surface tweet sentiment, portfolio risk, and swap recommendations in the sidepanel.

## Architecture

```
packages/
├── extension/          Chrome extension (React · Vite · Manifest V3)
├── backend/            API server (Fastify · TypeScript)
├── shared/types/       Shared TypeScript type definitions
├── shared/utils/       Shared utilities (planned)
└── website/            Standalone site (planned)
```

## Quick Start

```bash
git clone https://github.com/gajarajVish/taurus.git
cd taurus
cp .env.example .env          # add your keys
npm install
```

### Development

```bash
npm run dev:ext               # extension with hot reload
npm run dev:api               # backend dev server
```

### Load the Extension

1. Run `npm run dev:ext`
2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select `packages/extension/dist`

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run dev:ext` | Extension dev build with hot reload |
| `npm run dev:api` | Backend dev server with hot reload |
| `npm run build` | Production build (all packages) |
| `npm run type-check` | Type-check all packages |

## Tech Stack

| Layer | Tools |
|-------|-------|
| Extension | React, TypeScript, Vite, Shadow DOM, Chrome Manifest V3 |
| Backend | Node.js, Fastify, Zod, ethers.js |
| AI | 0G Compute Network (decentralized inference) |
| Blockchain | Polygon Mainnet, Polymarket CLOB API |
| Swaps | Uniswap Trading API (Sepolia testnet) |

## Environment Variables

See [`.env.example`](.env.example) for required configuration:

- `OG_COMPUTE_PRIVATE_KEY` — 0G wallet key for AI inference
- `UNISWAP_API_KEY` — Uniswap Trading API key for swap routes
- `PORT` — Backend server port (default: 3000)

## License

MIT
