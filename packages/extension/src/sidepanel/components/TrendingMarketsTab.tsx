import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { getWalletState, type WalletState } from '../../lib/wallet';
import type { Market } from '@taurus/types';

function formatVolume(vol: string): string {
  const n = parseFloat(vol);
  if (isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function formatEndDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `${days}d left`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Only show markets that have valid Yes/No token IDs (binary) and haven't ended */
function isTradeable(m: Market): boolean {
  return m.yesTokenId !== '' && m.noTokenId !== '' && new Date(m.endDate).getTime() > Date.now();
}

export interface BuySelection {
  market: Market;
  side: 'YES' | 'NO';
}

interface TrendingMarketsTabProps {
  onBuy?: (selection: BuySelection) => void;
}

export function TrendingMarketsTab({ onBuy }: TrendingMarketsTabProps) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch extra to account for non-binary markets being filtered out
      const data = await api.markets.list({ limit: 50, active: true });
      setMarkets(data.filter(isTradeable).slice(0, 20));
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    getWalletState().then(setWalletState);

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.walletState) {
        setWalletState(changes.walletState.newValue ?? { connected: false, address: null, chainId: null });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [fetchMarkets]);

  if (loading) {
    return (
      <div className="it-state">
        <div className="it-spinner" />
        <span className="it-state-text">Loading trending markets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="it-state">
        <span className="it-state-title">Something went wrong</span>
        <span className="it-state-text">{error}</span>
        <button className="it-retry" onClick={fetchMarkets}>Retry</button>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="it-state">
        <span className="it-state-title">No markets found</span>
        <span className="it-state-text">Check back later for trending prediction markets.</span>
      </div>
    );
  }

  return (
    <div className="tm-container">
      <div className="tm-header">
        <div className="it-header-left">
          <span className="it-title">Trending</span>
          <span className="it-count">{markets.length}</span>
        </div>
        <button className="it-refresh" onClick={fetchMarkets} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {!walletState.connected && (
        <div className="tm-wallet-hint">Connect your wallet to trade these markets.</div>
      )}

      <div className="tm-list">
        {markets.map((m, i) => {
          const yesPercent = Math.round(parseFloat(m.yesPrice) * 100);
          const noPercent = 100 - yesPercent;
          return (
            <div key={m.id} className="tm-card">
              <div className="tm-rank">#{i + 1}</div>
              <div className="tm-question">{m.question}</div>
              <div className="tm-bar-container">
                <div className="tm-bar-track">
                  <div className="tm-bar-yes" style={{ width: `${yesPercent}%` }} />
                </div>
                <div className="tm-bar-labels">
                  <span className="tm-bar-label yes">Yes {yesPercent}%</span>
                  <span className="tm-bar-label no">No {noPercent}%</span>
                </div>
              </div>
              <div className="tm-meta">
                <span className="tm-meta-item">{formatVolume(m.volume)} vol</span>
                <span className="tm-meta-dot" />
                <span className="tm-meta-item">{formatVolume(m.liquidity)} liq</span>
                <span className="tm-meta-dot" />
                <span className="tm-meta-item">{formatEndDate(m.endDate)}</span>
              </div>
              <div className="tm-actions">
                <button
                  className="tm-buy-btn yes"
                  onClick={() => onBuy?.({ market: m, side: 'YES' })}
                  disabled={!walletState.connected}
                >
                  Yes {yesPercent}c
                </button>
                <button
                  className="tm-buy-btn no"
                  onClick={() => onBuy?.({ market: m, side: 'NO' })}
                  disabled={!walletState.connected}
                >
                  No {noPercent}c
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
