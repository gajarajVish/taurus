import React, { useState } from 'react';
import { Badge } from './Badge';
import { api } from '../../lib/api';
import type { SentimentSwapRecommendation, SwapStep } from '@taurus/types';

interface SwapModalProps {
  recommendation: SentimentSwapRecommendation;
  walletAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SEPOLIA_CHAIN_ID = 11155111;

export function SwapModal({ recommendation, walletAddress, onClose, onSuccess }: SwapModalProps) {
  const [amount, setAmount] = useState(recommendation.suggestedAmount || '25');
  const [swapStep, setSwapStep] = useState<SwapStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount) || 0;
  const isBusy = swapStep !== 'idle' && swapStep !== 'success' && swapStep !== 'error';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleConfirm = async () => {
    if (numericAmount <= 0 || isBusy) return;

    setSwapStep('quoting');
    setError(null);

    try {
      const tokenIn = recommendation.tokenIn;
      const amountSmallest = BigInt(Math.floor(numericAmount * (10 ** tokenIn.decimals))).toString();

      // Get quote first
      const quoteResult = await api.swap.quote({
        type: 'EXACT_INPUT',
        tokenIn: tokenIn.address,
        tokenInChainId: SEPOLIA_CHAIN_ID,
        tokenOut: recommendation.tokenOut.address,
        tokenOutChainId: SEPOLIA_CHAIN_ID,
        amount: amountSmallest,
        swapper: walletAddress,
      });

      // Execute swap via background
      setSwapStep('signing');

      chrome.runtime.sendMessage(
        {
          type: 'SWAP_EXECUTE',
          payload: {
            quote: quoteResult.quote,
            walletAddress,
            chainId: SEPOLIA_CHAIN_ID,
            tokenIn: tokenIn.address,
            tokenOut: recommendation.tokenOut.address,
            amount: amountSmallest,
            routing: (quoteResult as unknown as Record<string, unknown>).routing || 'CLASSIC',
          },
        },
        (response: { success: boolean; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            setSwapStep('error');
            setError(chrome.runtime.lastError.message ?? 'Extension error');
            return;
          }
          if (response?.success) {
            setSwapStep('success');
            setTimeout(onSuccess, 1500);
          } else {
            setSwapStep('error');
            setError(response?.error ?? 'Swap failed');
          }
        }
      );
    } catch (err) {
      setSwapStep('error');
      setError((err as Error).message || 'Failed to execute swap');
    }
  };

  const confirmLabel = () => {
    if (swapStep === 'quoting') return 'Getting quote...';
    if (swapStep === 'signing') return 'Waiting for signature...';
    if (swapStep === 'submitting') return 'Submitting...';
    return `Swap ${recommendation.tokenIn.symbol} → ${recommendation.tokenOut.symbol}`;
  };

  return (
    <div className="sm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sm-container">
        <div className="sm-handle" />
        <div className="sm-header">
          <span className="sm-title">Sentiment Swap</span>
          <button className="sm-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="sm-question">{recommendation.rationale}</div>

        <div className="sm-side-row">
          <span className="sm-side-label">Recommendation</span>
          <Badge
            label={`${recommendation.sentiment} · ${Math.round(recommendation.confidence * 100)}%`}
            variant={recommendation.sentiment === 'bullish' ? 'positive' : 'negative'}
            size="sm"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0' }}>
          <span className="sw-token-symbol" style={{ fontSize: 18 }}>{recommendation.tokenIn.symbol}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
          </svg>
          <span className="sw-token-symbol" style={{ fontSize: 18 }}>{recommendation.tokenOut.symbol}</span>
        </div>

        {swapStep === 'success' ? (
          <div className="sm-success">
            <span className="sm-success-icon">&#10003;</span>
            <span className="sm-success-text">Swap submitted!</span>
          </div>
        ) : (
          <>
            <div className="sm-input-section">
              <span className="sm-input-label">Amount ({recommendation.tokenIn.symbol})</span>
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
                <span className="bm-currency">{recommendation.tokenIn.symbol}</span>
              </div>
            </div>

            {swapStep === 'error' && error && (
              <div className="sm-error">{error}</div>
            )}

            <button
              className="bm-confirm yes"
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
