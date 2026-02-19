# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Product Overview

PolyOverlay is a Chrome extension that brings Polymarket prediction markets directly into X.com (Twitter). Users can view market odds and place trades without leaving their feed.

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
    ├── types/      # Shared TypeScript types (@polyoverlay/types)
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
