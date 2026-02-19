# CLAUDE.md - Extension Package

Chrome Manifest V3 extension that injects Polymarket widgets into X.com tweets.

## Scope

This package handles all client-side functionality:
- Tweet detection and market matching
- Widget UI injection
- Trading flow UI (modals, inputs)
- Wallet state management (Guest vs Authenticated)
- Communication with backend API

## Commands

```bash
npm run dev          # Build with watch mode
npm run build        # Production build
npm run type-check   # TypeScript type checking
```

## Architecture

```
src/
├── background/      # Service worker
│   └── index.ts     # Message handling, API proxying
├── content/         # Content scripts (injected into X.com)
│   ├── detector.ts  # Scans tweets for market keywords
│   ├── widget/      # Injected market widget component
│   │   ├── Widget.tsx
│   │   ├── TradeModal.tsx
│   │   └── styles.css
│   └── inject.ts    # Shadow DOM injection logic
├── popup/           # Extension popup UI
│   ├── Popup.tsx    # Markets list, positions, settings
│   └── styles.css
├── lib/
│   ├── api.ts       # Backend API client
│   ├── storage.ts   # Chrome storage helpers
│   └── wallet.ts    # Wallet state (Guest/Authenticated)
└── hooks/
```

## Component Interactions

```
X.com Page → Content Script (detector.ts)
                ↓
         Match tweet to market
                ↓
         Inject Widget (Shadow DOM)
                ↓
         User clicks YES/NO
                ↓
         TradeModal opens
                ↓
         Background script → Backend API
```

## Key Implementation Details

### Tweet Detection
- Scan tweet text against cached top 100 market keywords
- Match to active Polymarket `condition_id`
- Widget placement: between tweet body and action icons (Like/RT)

### Widget Data
- Market Question
- Current "Yes" Price
- Total Volume
- YES/NO action buttons

### Trading Flow
1. Click YES/NO → open inline modal
2. Input amount (USD or PolyPoints)
3. Show estimated payout
4. Execute trade:
   - **Guest**: Record to local storage / backend shadow account
   - **Authenticated**: Submit to Polymarket CLOB via backend

### Shadow DOM
All injected UI uses Shadow DOM to isolate styles from X.com CSS.

### Wallet States
```typescript
type WalletState =
  | { mode: 'guest'; points: number }
  | { mode: 'authenticated'; address: string; provider: 'privy' | 'metamask' };
```

## UI Guidelines

- Use X's Chirp font via CSS variable inheritance
- Background: match X's current theme (light/dark)
- Accent: Polymarket Blue (#0072ff) for buttons
- Widget must be collapsible (minimize/expand)
- Default trade sizes: $10, $50, $100 for quick selection

## Performance

- Widget injection must complete in <200ms
- Lazy load trade modal
- Cache market data in background script
