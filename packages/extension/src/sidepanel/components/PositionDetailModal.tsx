import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { SwapModal } from './SwapModal';
import { api } from '../../lib/api';
import type { PortfolioAnalysis, Market, SentimentSwapRecommendation, SwapToken } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';

interface PositionDetailModalProps {
  position: DisplayPosition;
  portfolioAnalysis: PortfolioAnalysis | null;
  portfolioAnalysisLoading: boolean;
  walletAddress: string | null;
  chainId: number | null;
  positionIndex: number;
  onClose: () => void;
  onExitPosition: (pos: DisplayPosition) => void;
  onIncreasePosition: (market: Market, side: 'YES' | 'NO') => void;
}

// Sepolia tokens available for swapping
const T_ETH: SwapToken  = { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH',  name: 'Ethereum',    decimals: 18, chainId: 11155111 };
const T_WETH: SwapToken = { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 11155111 };
const T_USDC: SwapToken = { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', name: 'USD Coin',      decimals: 6,  chainId: 11155111 };

// displaySymbol is what the user sees (BTC, SOL, XRP…).
// swapToken is the actual Sepolia token used for execution (WETH as proxy where no testnet equivalent exists).
const CRYPTO_PATTERNS: { pattern: RegExp; name: string; displaySymbol: string; useNative: boolean }[] = [
  { pattern: /bitcoin|btc/i,                            name: 'Bitcoin',  displaySymbol: 'BTC', useNative: false },
  { pattern: /ethereum|ether(?!eum)|(?<!\w)eth(?!\w)/i, name: 'Ethereum', displaySymbol: 'ETH', useNative: true  },
  { pattern: /solana|(?<!\w)sol(?!\w)/i,                name: 'Solana',   displaySymbol: 'SOL', useNative: false },
  { pattern: /ripple|(?<!\w)xrp(?!\w)/i,                name: 'XRP',      displaySymbol: 'XRP', useNative: false },
  { pattern: /crypto(?:currency)?|defi|blockchain/i,    name: 'crypto',   displaySymbol: 'ETH', useNative: false },
];

type PositionSwapRec = SentimentSwapRecommendation & {
  recType: 'hedge' | 'leverage';
  cryptoName: string;
  fromLabel: string;
  toLabel: string;
};

function buildPositionSwapRec(position: DisplayPosition): PositionSwapRec | null {
  const crypto = CRYPTO_PATTERNS.find(({ pattern }) => pattern.test(position.marketQuestion));
  if (!crypto) return null;

  // YES = bullish on crypto adoption/price; NO = bearish
  const isBullish = position.side === 'yes';
  // Treat < -10% PnL as "risky" → recommend hedge; otherwise recommend leverage
  const isRisky = position.pnlPercent < -10;

  // Logic:
  //   Hedge   + bullish losing  → sell crypto to USDC (reduce exposure as bet loses)
  //   Hedge   + bearish losing  → buy crypto (market is going bullish against you)
  //   Leverage + bullish winning → buy more crypto (ride the wave)
  //   Leverage + bearish winning → sell crypto to USDC (double down on bearish stance)
  const moveToCrypto = isRisky ? !isBullish : isBullish;

  const cryptoToken = crypto.useNative ? T_ETH : T_WETH;
  const tokenIn  = moveToCrypto ? T_USDC : cryptoToken;
  const tokenOut = moveToCrypto ? cryptoToken : T_USDC;

  // Display labels use the detected asset symbol, not the proxy token symbol
  const fromLabel = moveToCrypto ? 'USDC' : crypto.displaySymbol;
  const toLabel   = moveToCrypto ? crypto.displaySymbol : 'USDC';

  const absPnl = Math.abs(position.pnlPercent).toFixed(1);
  const recType = isRisky ? 'hedge' : 'leverage';
  const rationale = isRisky
    ? isBullish
      ? `Your bullish ${crypto.name} position is down ${absPnl}%. Move to USDC to reduce exposure while odds move against you.`
      : `Your bearish ${crypto.name} position is down ${absPnl}%. Buy ${crypto.displaySymbol} to offset losses as the market turns bullish.`
    : isBullish
      ? `Your bullish ${crypto.name} position is performing well. Add ${crypto.displaySymbol} exposure to leverage the upward trend.`
      : `Your bearish ${crypto.name} stance is playing out. Move to USDC to reinforce your position.`;

  return {
    tokenIn,
    tokenOut,
    rationale,
    sentiment: moveToCrypto ? 'bullish' : 'bearish',
    confidence: Math.min(0.95, 0.55 + Math.abs(position.pnlPercent) / 100),
    source: 'local',
    timestamp: new Date().toISOString(),
    recType,
    cryptoName: crypto.name,
    fromLabel,
    toLabel,
  };
}

export function PositionDetailModal({
  position,
  portfolioAnalysis,
  portfolioAnalysisLoading,
  walletAddress,
  positionIndex,
  onClose,
  onExitPosition,
  onIncreasePosition,
}: PositionDetailModalProps) {
  const [market, setMarket] = useState<Market | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);

  const swapRec = useMemo(() => buildPositionSwapRec(position), [position]);

  const relevantWarnings = portfolioAnalysis?.correlationWarnings.filter(
    (w) => w.positionIndices?.includes(positionIndex)
  ) ?? [];

  const relevantHedges = portfolioAnalysis?.hedgingSuggestions.filter(
    (h) => h.positionIndices?.includes(positionIndex)
  ) ?? [];

  const hasRiskData = relevantWarnings.length > 0 || relevantHedges.length > 0;

  // Fetch market details on mount for Increase Position button
  useEffect(() => {
    api.markets.get(position.marketId).then(setMarket).catch(() => null);
  }, [position.marketId]);

  const pnlSign = position.pnlPercent >= 0 ? '+' : '';
  const pnlClass = position.pnlPercent >= 0 ? 'positive' : 'negative';

  return (
    <>
      <div className="sm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="sm-container pdm-container">
          <div className="sm-handle" />
          <div className="sm-header">
            <span className="sm-title">Position Details</span>
            <button className="sm-close" onClick={onClose}>✕</button>
          </div>

          <div className="sm-question">{position.marketQuestion}</div>

          <div className="sm-side-row">
            <span className="sm-side-label">Your position</span>
            <Badge
              label={position.side}
              variant={position.side === 'yes' ? 'positive' : 'negative'}
              size="sm"
            />
          </div>

          {/* Position Stats */}
          <div className="sm-stats">
            <div className="sm-stat">
              <span className="sm-stat-label">Shares</span>
              <span className="sm-stat-value">{parseFloat(position.shares).toFixed(2)}</span>
            </div>
            <div className="sm-stat">
              <span className="sm-stat-label">Avg Price</span>
              <span className="sm-stat-value">${position.avgPrice.toFixed(3)}</span>
            </div>
            <div className="sm-stat">
              <span className="sm-stat-label">Current</span>
              <span className="sm-stat-value">${position.currentPrice.toFixed(3)}</span>
            </div>
            <div className="sm-stat">
              <span className="sm-stat-label">PnL</span>
              <span className={`sm-stat-value ${pnlClass}`}>
                {pnlSign}{position.pnlPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Risk Analysis */}
          {portfolioAnalysisLoading ? (
            <div className="pa-section">
              <span className="pa-section-title">Risk Analysis</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                <div className="pa-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Analyzing portfolio…
              </div>
            </div>
          ) : hasRiskData ? (
            <div className="pdm-risk-section">
              {relevantWarnings.length > 0 && (
                <div className="pa-section pa-section--warn">
                  <span className="pa-section-title">Correlation Risks</span>
                  <div className="pa-items">
                    {relevantWarnings.map((w, i) => (
                      <div key={i} className="pa-item">
                        <span className="pa-item-text">{w.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {relevantHedges.length > 0 && (
                <div className="pa-section pa-section--hedge">
                  <span className="pa-section-title">Hedging Ideas</span>
                  <div className="pa-items">
                    {relevantHedges.map((h, i) => (
                      <div key={i} className="pa-item">
                        <span className="pa-item-text">{h.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : portfolioAnalysis ? (
            <div className="pa-section">
              <span className="pa-section-title">Risk Analysis</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No specific risks flagged for this position.</span>
            </div>
          ) : null}

          {/* Position-aware swap recommendation */}
          {walletAddress && swapRec && (
            <div className="pdm-hedge-row">
              <button className="pdm-hedge-btn pdm-hedge-btn--swap" onClick={() => setSwapModalOpen(true)}>
                {swapRec.recType === 'hedge' ? 'Hedge' : 'Leverage'}: {swapRec.fromLabel} → {swapRec.toLabel}
              </button>
            </div>
          )}

          {/* Action Row */}
          <div className="pdm-action-row">
            <button
              className="pdm-action-btn pdm-action-btn--increase"
              disabled={!market || !walletAddress}
              onClick={() => {
                if (!market) return;
                onIncreasePosition(market, position.side === 'yes' ? 'YES' : 'NO');
              }}
            >
              Increase Position
            </button>
            <button
              className="pdm-action-btn pdm-action-btn--exit"
              onClick={() => {
                onExitPosition(position);
                onClose();
              }}
            >
              Exit Position
            </button>
          </div>
        </div>
      </div>

      {/* Nested SwapModal for position hedge/leverage */}
      {swapModalOpen && swapRec && walletAddress && (
        <SwapModal
          title={swapRec.recType === 'hedge' ? `Hedge ${swapRec.cryptoName} Exposure` : `Leverage ${swapRec.cryptoName} Exposure`}
          recommendation={swapRec}
          fromLabel={swapRec.fromLabel}
          toLabel={swapRec.toLabel}
          walletAddress={walletAddress}
          onClose={() => setSwapModalOpen(false)}
          onSuccess={() => setSwapModalOpen(false)}
        />
      )}
    </>
  );
}
