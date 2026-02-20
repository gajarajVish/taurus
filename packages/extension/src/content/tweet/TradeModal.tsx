import React, { useState, useEffect, useCallback } from 'react';
import type { Market } from '@taurus/types';
import { getWalletState, shortAddress, type WalletState } from '../../lib/wallet';

interface TradeModalProps {
  market: Market;
  side: 'YES' | 'NO';
  onClose: () => void;
}

const AMOUNT_PRESETS = [10, 25, 50, 100];

type TradeState = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

/** Fetch wallet state from background (works when content script context is invalidated). */
function getWalletStateFromBackground(): Promise<WalletState> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_WALLET_STATE' }, (response: { success?: boolean; data?: WalletState } | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({ connected: false, address: null, chainId: null });
          return;
        }
        if (response?.success && response.data) {
          resolve(response.data);
        } else {
          resolve({ connected: false, address: null, chainId: null });
        }
      });
    } catch {
      resolve({ connected: false, address: null, chainId: null });
    }
  });
}

export function TradeModal({ market, side, onClose }: TradeModalProps) {
  const [amount, setAmount] = useState<string>('25');
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });
  const [tradeState, setTradeState] = useState<TradeState>('idle');
  const [tradeError, setTradeError] = useState<string | null>(null);

  const refreshWalletState = useCallback(() => {
    getWalletStateFromBackground().then(setWalletState);
  }, []);

  useEffect(() => {
    const defaultState: WalletState = { connected: false, address: null, chainId: null };
    const applyState = (state: WalletState) => setWalletState(state);

    getWalletState()
      .then(applyState)
      .catch(() => {
        getWalletStateFromBackground().then(applyState);
      });

    try {
      const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'local' && changes.walletState) {
          setWalletState(changes.walletState.newValue ?? defaultState);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    refreshWalletState();
  }, [refreshWalletState]);

  const price = side === 'YES'
    ? parseFloat(market.yesPrice)
    : parseFloat(market.noPrice);

  const numericAmount = parseFloat(amount) || 0;
  const payout = price > 0 ? numericAmount / price : 0;
  const sidePct = Math.round(price * 100);
  const isBusy = tradeState === 'signing' || tradeState === 'submitting';

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
    console.log('[Taurus:TradeModal] handleConfirm called');
    console.log('[Taurus:TradeModal] walletState:', walletState);
    console.log('[Taurus:TradeModal] isBusy:', isBusy);

    if (!walletState.address || isBusy) {
      console.log('[Taurus:TradeModal] Early return - no address or busy');
      return;
    }

    const tokenId = side === 'YES' ? market.yesTokenId : market.noTokenId;
    console.log('[Taurus:TradeModal] tokenId:', tokenId);
    console.log('[Taurus:TradeModal] price:', price);
    console.log('[Taurus:TradeModal] numericAmount:', numericAmount);

    setTradeState('signing');
    setTradeError(null);

    const payload = {
      tokenId,
      price,
      amount: numericAmount,
      address: walletState.address,
    };
    console.log('[Taurus:TradeModal] Sending SIGN_AND_TRADE message with payload:', payload);

    // Network check happens in the background (reads live eth_chainId from MetaMask)
    chrome.runtime.sendMessage(
      {
        type: 'SIGN_AND_TRADE',
        payload,
      },
      (response: { success: boolean; data?: unknown; error?: string } | undefined) => {
        console.log('[Taurus:TradeModal] Received response:', response);
        console.log('[Taurus:TradeModal] chrome.runtime.lastError:', chrome.runtime.lastError);

        if (chrome.runtime.lastError) {
          console.error('[Taurus:TradeModal] lastError:', chrome.runtime.lastError);
          setTradeState('error');
          setTradeError(chrome.runtime.lastError.message ?? 'Extension error');
          return;
        }
        if (response?.success) {
          console.log('[Taurus:TradeModal] Trade successful!');
          setTradeState('success');
          // Save position locally so sidecar reflects the trade immediately
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
        } else {
          console.error('[Taurus:TradeModal] Trade failed:', response?.error);
          setTradeState('error');
          setTradeError(response?.error ?? 'Trade failed');
        }
      }
    );
  };

  const confirmLabel = () => {
    if (tradeState === 'signing') return 'Waiting for signature...';
    if (tradeState === 'submitting') return 'Submitting...';
    return `Confirm ${side}`;
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

        {!walletState.connected && !walletState.address ? (
          <div className="wallet-gate">
            <p className="wallet-gate-message">
              Connect your wallet to place real trades.
            </p>
            <p className="wallet-gate-hint">
              Open the Taurus popup to connect MetaMask.
            </p>
          </div>
        ) : tradeState === 'success' ? (
          <div className="wallet-gate">
            <p className="wallet-gate-message" style={{ color: '#00ba7c' }}>
              Order submitted successfully!
            </p>
            <p className="wallet-gate-hint">
              Check your positions in the side panel.
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

            {tradeState === 'error' && tradeError && (
              <div className="wallet-gate" style={{ marginBottom: '8px' }}>
                <p className="wallet-gate-message" style={{ color: '#f4212e', fontSize: '12px' }}>
                  {tradeError}
                </p>
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
                    disabled={isBusy}
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
                  disabled={isBusy}
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
