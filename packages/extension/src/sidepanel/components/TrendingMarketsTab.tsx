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
  positionMarketIds?: Set<string>;
}

export function TrendingMarketsTab({ onBuy, positionMarketIds }: TrendingMarketsTabProps) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });
  const [search, setSearch] = useState('');

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch extra to account for non-binary markets being filtered out
      const data = await api.markets.list({ limit: 50, active: true });
      const raw = data.filter(isTradeable);
      const sorted = positionMarketIds?.size
        ? [...raw.filter(m => positionMarketIds.has(m.id)), ...raw.filter(m => !positionMarketIds.has(m.id))].slice(0, 10)
        : raw.slice(0, 10);
      setMarkets(sorted);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, [positionMarketIds]);

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

  const filteredMarkets = search
    ? markets.filter((m) => m.question.toLowerCase().includes(search.toLowerCase()))
    : markets;

  if (loading) {
    return (
      <div className="tm-container">
        <div className="loading-state">
          <div className="it-loading-spinner" style={{ margin: '0 auto 8px' }} />
          Loading trending markets...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tm-container">
        <div className="error-state">
          <div style={{ marginBottom: 8 }}>{error}</div>
          <button className="it-action-btn" onClick={fetchMarkets}>Retry</button>
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="tm-container">
        <div className="loading-state">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 8px', display: 'block' }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          No trending markets right now. Check back later.
        </div>
      </div>
    );
  }

  return (
    <div className="tm-container">
      {/* Search bar */}
      <div className="sm-input-row" style={{ margin: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="sm-input"
          placeholder="Search markets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500 }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      <div className="tm-title-row">
        <div className="tm-title-left">
          <span className="tm-title">Trending</span>
          <span className="tm-count">{filteredMarkets.length}</span>
        </div>
        <button className="tm-reload press-effect" onClick={fetchMarkets} title="Refresh">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {!walletState.connected && (
        <div className="tm-wallet-hint">Connect your wallet to trade these markets.</div>
      )}

      <div className="tm-list">
        {filteredMarkets.map((m, i) => {
          const yesPercent = Math.round(parseFloat(m.yesPrice) * 100);
          const noPercent = 100 - yesPercent;
          const hasPosition = positionMarketIds?.has(m.id);
          return (
            <div key={m.id} className="tm-card">
              <div className="tm-rank-row">
                <div className="tm-rank">#{i + 1}</div>
                {hasPosition && <span className="tm-position-badge">Your position</span>}
              </div>
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
