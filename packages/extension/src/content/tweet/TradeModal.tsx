import React, { useState, useEffect } from 'react';
import type { Market } from '@polyoverlay/types';
import { getWalletState, shortAddress, type WalletState } from '../../lib/wallet';

interface TradeModalProps {
  market: Market;
  side: 'YES' | 'NO';
  onClose: () => void;
}

const AMOUNT_PRESETS = [10, 25, 50, 100];

export function TradeModal({ market, side, onClose }: TradeModalProps) {
  const [amount, setAmount] = useState<string>('25');
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });

  useEffect(() => {
    getWalletState().then(setWalletState);

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.walletState) {
        setWalletState(changes.walletState.newValue ?? { connected: false, address: null, chainId: null });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const price = side === 'YES'
    ? parseFloat(market.yesPrice)
    : parseFloat(market.noPrice);

  const numericAmount = parseFloat(amount) || 0;
  const payout = price > 0 ? numericAmount / price : 0;

  const sidePct = Math.round(price * 100);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[PolyOverlay] Trade submitted:', {
      market: market.id,
      question: market.question,
      side,
      amount: numericAmount,
      price,
      potentialPayout: payout,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="modal-header">
          <span className="modal-title">Place a Bet</span>
          <button className="close-button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}>✕</button>
        </div>

        <div className="modal-question">{market.question}</div>

        <div className="picked-side">
          <span className="picked-label">You picked</span>
          <span className={`picked-badge ${side === 'YES' ? 'yes' : 'no'}`}>
            {side} · {sidePct}%
          </span>
        </div>

        {!walletState.connected ? (
          <div className="wallet-gate">
            <p className="wallet-gate-message">
              Connect your wallet to place real trades.
            </p>
            <p className="wallet-gate-hint">
              Open the PolyOverlay popup to connect MetaMask.
            </p>
          </div>
        ) : (
          <>
            {walletState.address && (
              <div className="wallet-address-row">
                <span className="wallet-address-label">Wallet</span>
                <span className="wallet-address-value">{shortAddress(walletState.address)}</span>
              </div>
            )}

            <div className="amount-section">
              <span className="section-label">Amount</span>
              <div className="preset-row">
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    className={`preset-button ${numericAmount === preset ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAmount(String(preset)); }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="custom-input-row">
                <input
                  type="text"
                  inputMode="decimal"
                  className="amount-input"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                />
                <span className="currency-label">USDC</span>
              </div>
            </div>

            <div className="payout-row">
              <span className="payout-label">Payout if correct</span>
              <span className="payout-value">${payout.toFixed(2)}</span>
            </div>

            <button
              className={`confirm-button ${side === 'YES' ? 'yes' : 'no'}`}
              onClick={handleConfirm}
              disabled={numericAmount <= 0}
            >
              Confirm {side}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
