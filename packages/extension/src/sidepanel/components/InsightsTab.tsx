import React, { useState, useEffect, useCallback } from 'react';
import { InsightCard } from './InsightCard';
import { AutoExitEditor } from './AutoExitEditor';
import { api } from '../../lib/api';
import { getInstallId, getAISettings } from '../../lib/storage';
import type { Insight } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';

interface InsightsTabProps {
  marketId?: string;
  positions?: DisplayPosition[];
}

export function InsightsTab({ marketId, positions = [] }: InsightsTabProps) {
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
        // Only show insights for markets where the user holds a position
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

  // ── Disabled ──
  if (!enabled) {
    return (
      <div className="it-tab">
        <AutoExitEditor />
        <div className="it-empty-card">
          <div className="it-empty-icon it-empty-icon--muted">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <span className="it-empty-title">AI Insights Disabled</span>
          <span className="it-empty-text">Enable AI insights in settings to get real-time sentiment analysis on the markets you browse.</span>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading && insights.length === 0) {
    return (
      <div className="it-tab">
        <AutoExitEditor />
        <div className="it-empty-card">
          <div className="it-loading-spinner" />
          <span className="it-empty-text">Scanning for insights...</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="it-tab">
        <AutoExitEditor />
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
      </div>
    );
  }

  // ── Empty ──
  if (insights.length === 0) {
    return (
      <div className="it-tab">
        <AutoExitEditor />
        <div className="it-empty-card">
          <div className="it-empty-icon it-empty-icon--brand">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <path d="M12 2a7 7 0 017 7c0 5-7 11-7 11S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
          </div>
          <span className="it-empty-title">No insights yet</span>
          <span className="it-empty-text">Browse tweets with Polymarket widgets to generate AI sentiment insights.</span>
          <div className="it-onboarding">
            <div className="it-onboarding-item">
              <div className="it-onboarding-num">1</div>
              <span>Scroll your X feed</span>
            </div>
            <div className="it-onboarding-item">
              <div className="it-onboarding-num">2</div>
              <span>View tweets with market widgets</span>
            </div>
            <div className="it-onboarding-item">
              <div className="it-onboarding-num">3</div>
              <span>AI generates sentiment insights</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Insights list ──
  return (
    <div className="it-tab">
      <AutoExitEditor />
      <div className="it-list-header">
        <div className="it-list-header-left">
          <span className="it-list-title">Insights</span>
          <span className="it-list-count">{insights.length}</span>
        </div>
        <button className="it-refresh-btn" onClick={fetchInsights} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        </button>
      </div>
      <div className="it-list">
        {insights.map((insight) => (
          <InsightCard
            key={insight.marketId}
            insight={insight}
            position={positions.find((p) => p.marketId === insight.marketId)}
            onDismiss={() => handleDismiss(insight.marketId)}
          />
        ))}
      </div>
    </div>
  );
}
