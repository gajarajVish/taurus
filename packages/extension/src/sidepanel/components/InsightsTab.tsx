import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { InsightCard } from './InsightCard';
import { AutoExitEditor } from './AutoExitEditor';
import { api } from '../../lib/api';
import { getInstallId, getAISettings } from '../../lib/storage';
import type { Insight, Market } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';
import type { BuySelection } from './TrendingMarketsTab';

interface InsightsTabProps {
  marketId?: string;
  positions?: DisplayPosition[];
  onExitSignalCount?: (count: number) => void;
  onBuy?: (selection: BuySelection) => void;
  onExitPosition?: (pos: DisplayPosition) => void;
}

export function InsightsTab({ marketId, positions = [], onExitSignalCount, onBuy, onExitPosition }: InsightsTabProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const settings = await getAISettings();
      setEnabled(settings.enabled);
      if (!settings.enabled) { setInsights([]); return; }

      const installId = await getInstallId();

      if (marketId) {
        const res = await api.insights.get(marketId, installId);
        setInsights(res.insight ? [res.insight] : []);
      } else {
        const res = await api.insights.getAll(installId);
        const positionMarketIds = new Set(positions.map((p) => p.marketId));
        const filtered = positionMarketIds.size > 0
          ? res.insights.filter((i) => positionMarketIds.has(i.marketId))
          : res.insights;
        setInsights(filtered);
      }
    } catch (err) {
      console.error('[InsightsTab] Failed to fetch insights:', err);
      setError('Unable to reach the backend');
    } finally {
      setLoading(false);
    }
  }, [marketId, positions]);

  useEffect(() => {
    fetchInsights();
    const id = setInterval(fetchInsights, 30000);
    return () => clearInterval(id);
  }, [fetchInsights]);

  const handleDismiss = (mid: string) => {
    setInsights((prev) => prev.filter((i) => i.marketId !== mid));
  };

  const exitSignalCount = useMemo(() => {
    return insights.filter((insight) => {
      const pos = positions.find((p) => p.marketId === insight.marketId);
      if (!pos) return false;
      if (insight.sentiment === 'bearish' && pos.side === 'yes') return true;
      if (insight.sentiment === 'bullish' && pos.side === 'no') return true;
      if (insight.riskFlags.length > 0) return true;
      return false;
    }).length;
  }, [insights, positions]);

  useEffect(() => {
    onExitSignalCount?.(exitSignalCount);
  }, [exitSignalCount, onExitSignalCount]);

  const handleBuyFromInsight = useCallback(async (marketId: string, side: 'YES' | 'NO') => {
    if (!onBuy) return;
    try {
      const market: Market = await api.markets.get(marketId);
      onBuy({ market, side });
    } catch {
      // Silently fail — no market fetch means no action
    }
  }, [onBuy]);

  const sortedInsights = useMemo(
    () => [...insights].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [insights]
  );

  // ── Content ────────────────────────────────────────────────────────────────

  let listContent: React.ReactNode;

  if (!enabled) {
    listContent = (
      <div className="it-empty-card">
        <div className="it-empty-icon it-empty-icon--muted">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>
        <span className="it-empty-title">AI Insights Disabled</span>
        <span className="it-empty-text">Enable AI insights in the settings card above.</span>
      </div>
    );
  } else if (loading && insights.length === 0) {
    listContent = (
      <div className="it-empty-card">
        <div className="it-loading-spinner" />
        <span className="it-empty-text">Scanning for insights...</span>
      </div>
    );
  } else if (error) {
    listContent = (
      <div className="it-empty-card">
        <div className="it-empty-icon it-empty-icon--error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <span className="it-empty-title">{error}</span>
        <span className="it-empty-text">Make sure the backend is running on localhost:3000</span>
        <button className="it-action-btn" onClick={fetchInsights}>Try Again</button>
      </div>
    );
  } else if (sortedInsights.length === 0) {
    listContent = (
      <div className="it-empty-card">
        <div className="it-empty-icon it-empty-icon--brand">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <path d="M12 2a7 7 0 017 7c0 5-7 11-7 11S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/>
          </svg>
        </div>
        <span className="it-empty-title">No insights yet</span>
        <span className="it-empty-text">Browse tweets with Polymarket widgets to generate AI sentiment insights.</span>
      </div>
    );
  } else {
    listContent = sortedInsights.map((insight) => {
      const pos = positions.find((p) => p.marketId === insight.marketId);
      return (
        <InsightCard
          key={insight.marketId}
          insight={insight}
          position={pos}
          onDismiss={() => handleDismiss(insight.marketId)}
          onIncreasePosition={onBuy ? (mid, side) => handleBuyFromInsight(mid, side) : undefined}
          onExitPosition={onExitPosition && pos ? () => onExitPosition(pos) : undefined}
        />
      );
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="it-tab">
      <div className="it-bar">
        <div className="it-bar-left" />
        <button className="it-refresh-btn" onClick={fetchInsights} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      <div className="it-list">
        <AutoExitEditor />
        {listContent}
      </div>
    </div>
  );
}
