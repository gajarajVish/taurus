import React, { useEffect, useState } from 'react';
import { Badge } from './Badge';
import { SwapModal } from './SwapModal';
import { api } from '../../lib/api';
import type { PortfolioAnalysis, Market, SentimentSwapRecommendation } from '@taurus/types';
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
  const [hedgeRec, setHedgeRec] = useState<SentimentSwapRecommendation | null>(null);
  const [hedgeLoading, setHedgeLoading] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);

  // Fetch market details on mount for Increase Position button
  useEffect(() => {
    api.markets.get(position.marketId).then(setMarket).catch(() => null);
  }, [position.marketId]);

  const relevantWarnings = portfolioAnalysis?.correlationWarnings.filter(
    (w) => w.positionIndices?.includes(positionIndex)
  ) ?? [];

  const relevantHedges = portfolioAnalysis?.hedgingSuggestions.filter(
    (h) => h.positionIndices?.includes(positionIndex)
  ) ?? [];

  const hasRiskData = relevantWarnings.length > 0 || relevantHedges.length > 0;

  const handleGetHedge = async () => {
    if (hedgeLoading || hedgeRec) return;
    setHedgeLoading(true);
    try {
      const storage = await chrome.storage.local.get(['recentTweetText']);
      const tweetText = (storage.recentTweetText as string) || position.marketQuestion;
      const result = await api.swap.sentimentSwap({
        tweetText,
        walletAddress: walletAddress || '',
      });
      if (result.recommendation) {
        setHedgeRec(result.recommendation);
      }
    } catch {
      // Silently fail
    } finally {
      setHedgeLoading(false);
    }
  };

  // Auto-trigger hedge fetch on mount when wallet is connected
  useEffect(() => {
    if (walletAddress && !hedgeRec && !hedgeLoading) {
      handleGetHedge();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

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

          {/* Hedge Actions */}
          {walletAddress && (
            <div className="pdm-hedge-row">
              {hedgeLoading && (
                <button className="pdm-hedge-btn" disabled>
                  Fetching hedge…
                </button>
              )}
              {!hedgeLoading && hedgeRec && (
                <button className="pdm-hedge-btn pdm-hedge-btn--swap" onClick={() => setSwapModalOpen(true)}>
                  Swap Now: {hedgeRec.tokenIn.symbol} → {hedgeRec.tokenOut.symbol}
                </button>
              )}
              {!hedgeLoading && !hedgeRec && (
                <button className="pdm-hedge-btn" onClick={handleGetHedge}>
                  Get AI Hedge
                </button>
              )}
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

      {/* Nested SwapModal for hedge */}
      {swapModalOpen && hedgeRec && walletAddress && (
        <SwapModal
          recommendation={hedgeRec}
          walletAddress={walletAddress}
          onClose={() => setSwapModalOpen(false)}
          onSuccess={() => setSwapModalOpen(false)}
        />
      )}
    </>
  );
}
