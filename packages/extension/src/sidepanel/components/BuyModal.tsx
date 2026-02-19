import React, { useState } from 'react';
import type { Market } from '@taurus/types';
import { Badge } from './Badge';

interface BuyModalProps {
  market: Market;
  side: 'YES' | 'NO';
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AMOUNT_PRESETS = [5, 10, 25, 50];

type BuyState = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

export function BuyModal({ market, side, walletAddress, onClose, onSuccess }: BuyModalProps) {
  const [amount, setAmount] = useState<string>('10');
  const [buyState, setBuyState] = useState<BuyState>('idle');
  const [buyError, setBuyError] = useState<string | null>(null);

  const price = side === 'YES'
    ? parseFloat(market.yesPrice)
    : parseFloat(market.noPrice);

  const numericAmount = parseFloat(amount) || 0;
  const payout = price > 0 ? numericAmount / price : 0;
  const isBusy = buyState === 'signing' || buyState === 'submitting';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleConfirm = () => {
    if (numericAmount <= 0 || isBusy) return;

    const tokenId = side === 'YES' ? market.yesTokenId : market.noTokenId;

    setBuyState('signing');
    setBuyError(null);

    chrome.runtime.sendMessage(
      {
        type: 'SIGN_AND_TRADE',
        payload: {
          tokenId,
          price,
          amount: numericAmount,
          address: walletAddress,
        },
      },
      (response: { success: boolean; data?: unknown; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          setBuyState('error');
          setBuyError(chrome.runtime.lastError.message ?? 'Extension error');
          return;
        }
        if (response?.success) {
          setBuyState('success');

          // Save position locally
          const newPosition = {
            id: `local-${tokenId}-${Date.now()}`,
            marketId: market.id,
            marketQuestion: market.question,
            outcomeId: tokenId,
            outcomeName: side,
            shares: String(numericAmount / price),
            avgPrice: price,
            currentPrice: price,
            pnl: 0,
            pnlPercent: 0,
          };
          chrome.storage.local.get(['localPositions'], (res) => {
            const existing: unknown[] = res.localPositions ?? [];
            chrome.storage.local.set({ localPositions: [...existing, newPosition] });
          });

          setTimeout(onSuccess, 1500);
        } else {
          setBuyState('error');
          setBuyError(response?.error ?? 'Trade failed');
        }
      }
    );
  };

  const confirmLabel = () => {
    if (buyState === 'signing') return 'Waiting for signature...';
    if (buyState === 'submitting') return 'Submitting...';
    return `Buy ${side}`;
  };

  return (
    <div className="sm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sm-container">
        <div className="sm-handle" />
        <div className="sm-header">
          <span className="sm-title">Place a Bet</span>
          <button className="sm-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="sm-question">{market.question}</div>

        <div className="sm-side-row">
          <span className="sm-side-label">Your pick</span>
          <Badge
            label={`${side} · ${Math.round(price * 100)}%`}
            variant={side === 'YES' ? 'positive' : 'negative'}
            size="sm"
          />
        </div>

        {buyState === 'success' ? (
          <div className="sm-success">
            <span className="sm-success-icon">&#10003;</span>
            <span className="sm-success-text">Order submitted!</span>
            <span className="sm-success-hint">Check your positions in the Dashboard tab.</span>
          </div>
        ) : (
          <>
            <div className="bm-presets">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`bm-preset ${numericAmount === preset ? 'active' : ''}`}
                  onClick={() => setAmount(String(preset))}
                  disabled={isBusy}
                >
                  ${preset}
                </button>
              ))}
            </div>

            <div className="sm-input-section">
              <span className="sm-input-label">Amount (USDC)</span>
              <div className="sm-input-row">
                <input
                  type="text"
                  inputMode="decimal"
                  className="sm-input"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  disabled={isBusy}
                />
                <span className="bm-currency">USDC</span>
              </div>
            </div>

            <div className="sm-return-row">
              <span className="sm-return-label">Payout if correct</span>
              <span className="sm-return-value">${payout.toFixed(2)}</span>
            </div>

            {buyState === 'error' && buyError && (
              <div className="sm-error">{buyError}</div>
            )}

            <button
              className={`bm-confirm ${side === 'YES' ? 'yes' : 'no'}`}
              onClick={handleConfirm}
              disabled={numericAmount <= 0 || isBusy}
            >
              {confirmLabel()}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
