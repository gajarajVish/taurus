import React, { useState, useEffect, useCallback } from 'react';
import { InsightCard } from './InsightCard';
import { AutoExitEditor } from './AutoExitEditor';
import { api } from '../../lib/api';
import { getInstallId, getAISettings } from '../../lib/storage';
import type { Insight } from '@taurus/types';

interface InsightsTabProps {
  marketId?: string;
}

export function InsightsTab({ marketId }: InsightsTabProps) {
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
        setInsights(res.insights);
      }
    } catch (err) {
      console.error('[InsightsTab] Failed to fetch insights:', err);
      setError('Unable to reach the backend');
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchInsights();
    const id = setInterval(fetchInsights, 30000);
    return () => clearInterval(id);
  }, [fetchInsights]);

  const handleDismiss = (mid: string) => {
    setInsights((prev) => prev.filter((i) => i.marketId !== mid));
  };

  // ── Disabled ──
  if (!enabled) {
    return (
      <div>
        <AutoExitEditor />
        <div className="it-state">
          <div className="it-state-glyph">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <span className="it-state-title">AI Insights Disabled</span>
          <span className="it-state-text">Enable AI insights in settings to get real-time sentiment analysis on the markets you browse.</span>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading && insights.length === 0) {
    return (
      <div>
        <AutoExitEditor />
        <div className="it-state">
          <div className="it-spinner" />
          <span className="it-state-text">Scanning for insights…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div>
        <AutoExitEditor />
        <div className="it-state">
          <div className="it-state-glyph">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff4d6a" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <span className="it-state-title">{error}</span>
          <span className="it-state-text">Make sure the backend is running on localhost:3000</span>
          <button className="it-retry" onClick={fetchInsights}>Try again</button>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (insights.length === 0) {
    return (
      <div>
        <AutoExitEditor />
        <div className="it-state">
          <div className="it-state-glyph">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.2" strokeLinecap="round">
              <path d="M12 2a7 7 0 017 7c0 5-7 11-7 11S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
          </div>
          <span className="it-state-title">No insights yet</span>
          <span className="it-state-text">Browse tweets with Polymarket widgets — insights appear once you view 3+ tweets about the same market.</span>
          <div className="it-steps">
            <div className="it-step"><span className="it-step-num">1</span>Scroll your X feed</div>
            <div className="it-step"><span className="it-step-num">2</span>View tweets with market widgets</div>
            <div className="it-step"><span className="it-step-num">3</span>AI generates sentiment insights</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Insights list ──
  return (
    <div>
      <AutoExitEditor />
      <div className="it-list">
        <div className="it-header">
          <div className="it-header-left">
            <span className="it-title">Insights</span>
            <span className="it-count">{insights.length}</span>
          </div>
          <button className="it-refresh" onClick={fetchInsights} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        {insights.map((insight) => (
          <InsightCard key={insight.marketId} insight={insight} onDismiss={() => handleDismiss(insight.marketId)} />
        ))}
      </div>
    </div>
  );
}
