import React, { useState } from 'react';
import type { DisplayPosition } from '../Sidecar';
import { Badge } from './Badge';

interface SellModalProps {
  position: DisplayPosition;
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

type SellState = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

export function SellModal({ position, walletAddress, onClose, onSuccess }: SellModalProps) {
  const totalShares = parseFloat(position.shares);
  const [sharesToSell, setSharesToSell] = useState<string>(position.shares);
  const [sellState, setSellState] = useState<SellState>('idle');
  const [sellError, setSellError] = useState<string | null>(null);

  const numericShares = parseFloat(sharesToSell) || 0;
  const estimatedReturn = numericShares * position.currentPrice;
  const costBasis = numericShares * position.avgPrice;
  const profitLoss = estimatedReturn - costBasis;
  const isFullExit = numericShares >= totalShares;
  const isBusy = sellState === 'signing' || sellState === 'submitting';

  const handleSharesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setSharesToSell(val);
    }
  };

  const handleConfirm = () => {
    if (numericShares <= 0 || numericShares > totalShares || isBusy) return;

    setSellState('signing');
    setSellError(null);

    const amount = numericShares * position.currentPrice;

    chrome.runtime.sendMessage(
      {
        type: 'SIGN_AND_SELL',
        payload: {
          tokenId: position.outcomeId,
          price: position.currentPrice,
          amount,
          address: walletAddress,
        },
      },
      (response: { success: boolean; data?: unknown; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          setSellState('error');
          setSellError(chrome.runtime.lastError.message ?? 'Extension error');
          return;
        }
        if (response?.success) {
          setSellState('success');

          // Update local positions storage
          chrome.storage.local.get(['localPositions'], (res) => {
            const current: Array<{ id: string; shares: string; [k: string]: unknown }> = res.localPositions ?? [];
            let updated;
            if (isFullExit) {
              updated = current.filter((p) => p.id !== position.id);
            } else {
              updated = current.map((p) => {
                if (p.id !== position.id) return p;
                const remaining = parseFloat(p.shares) - numericShares;
                return { ...p, shares: String(Math.max(0, remaining)) };
              });
            }
            chrome.storage.local.set({ localPositions: updated });
          });

          // Notify parent to refresh
          setTimeout(onSuccess, 1500);
        } else {
          setSellState('error');
          setSellError(response?.error ?? 'Sell order failed');
        }
      }
    );
  };

  const confirmLabel = () => {
    if (sellState === 'signing') return 'Waiting for signature...';
    if (sellState === 'submitting') return 'Submitting...';
    return isFullExit ? 'Exit Position' : 'Sell Shares';
  };

  return (
    <div className="sm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sm-container">
        <div className="sm-handle" />
        <div className="sm-header">
          <span className="sm-title">Exit Position</span>
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

        {sellState === 'success' ? (
          <div className="sm-success">
            <span className="sm-success-icon">&#10003;</span>
            <span className="sm-success-text">Sell order submitted</span>
            <span className="sm-success-hint">Position will update shortly.</span>
          </div>
        ) : (
          <>
            <div className="sm-stats">
              <div className="sm-stat">
                <span className="sm-stat-label">Shares</span>
                <span className="sm-stat-value">{totalShares.toFixed(2)}</span>
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
                <span className={`sm-stat-value ${position.pnlPercent >= 0 ? 'positive' : 'negative'}`}>
                  {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="sm-input-section">
              <span className="sm-input-label">Shares to sell</span>
              <div className="sm-input-row">
                <input
                  type="text"
                  inputMode="decimal"
                  className="sm-input"
                  value={sharesToSell}
                  onChange={handleSharesChange}
                  disabled={isBusy}
                />
                <button
                  className="sm-max-btn"
                  onClick={() => setSharesToSell(position.shares)}
                  disabled={isBusy}
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="sm-return-row">
              <span className="sm-return-label">Estimated return</span>
              <span className="sm-return-value">${estimatedReturn.toFixed(2)}</span>
            </div>
            <div className="sm-return-row">
              <span className="sm-return-label">P&L</span>
              <span className={`sm-return-value ${profitLoss >= 0 ? 'positive' : 'negative'}`}>
                {profitLoss >= 0 ? '+' : ''}${Math.abs(profitLoss).toFixed(2)}
              </span>
            </div>

            {sellState === 'error' && sellError && (
              <div className="sm-error">{sellError}</div>
            )}

            <button
              className="sm-confirm"
              onClick={handleConfirm}
              disabled={numericShares <= 0 || numericShares > totalShares || isBusy}
            >
              {confirmLabel()}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
