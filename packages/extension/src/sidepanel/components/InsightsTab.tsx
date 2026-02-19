import React, { useState, useEffect, useCallback } from 'react';
import { InsightCard } from './InsightCard';
import { api } from '../../lib/api';
import { getInstallId, getAISettings } from '../../lib/storage';
import type { Insight } from '@taurus/types';

interface InsightsTabProps {
  // If provided, only show insights for this market
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

      // Check if AI insights are enabled
      const settings = await getAISettings();
      setEnabled(settings.enabled);

      if (!settings.enabled) {
        setInsights([]);
        return;
      }

      const installId = await getInstallId();

      if (marketId) {
        // Fetch single market insight
        const response = await api.insights.get(marketId, installId);
        setInsights(response.insight ? [response.insight] : []);
      } else {
        // Fetch all insights
        const response = await api.insights.getAll(installId);
        setInsights(response.insights);
      }
    } catch (err) {
      console.error('[InsightsTab] Failed to fetch insights:', err);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchInsights();

    // Poll for new insights every 30 seconds when tab is active
    const intervalId = setInterval(fetchInsights, 30000);

    return () => clearInterval(intervalId);
  }, [fetchInsights]);

  const handleDismiss = (insightId: string) => {
    setInsights((prev) => prev.filter((i) => i.marketId !== insightId));
  };

  if (!enabled) {
    return (
      <div className="insights-disabled">
        <div className="insights-disabled-icon">🤖</div>
        <div className="insights-disabled-title">AI Insights Disabled</div>
        <div className="insights-disabled-text">
          Enable AI insights in settings to get sentiment analysis on the markets you view.
        </div>
      </div>
    );
  }

  if (loading && insights.length === 0) {
    return (
      <div className="insights-loading">
        <div className="insights-spinner" />
        <div>Loading insights...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-error">
        <div className="insights-error-icon">⚠️</div>
        <div>{error}</div>
        <button className="insights-retry-btn" onClick={fetchInsights}>
          Retry
        </button>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="insights-empty">
        <div className="insights-empty-icon">💡</div>
        <div className="insights-empty-title">No Insights Yet</div>
        <div className="insights-empty-text">
          Browse tweets with Polymarket widgets to generate AI-powered sentiment analysis.
        </div>
        <div className="insights-empty-hint">
          Insights appear after viewing 3+ tweets about the same market.
        </div>
      </div>
    );
  }

  return (
    <div className="insights-list">
      <div className="insights-header">
        <span className="insights-title">AI Insights</span>
        <span className="insights-count">{insights.length} active</span>
      </div>
      {insights.map((insight) => (
        <InsightCard
          key={insight.marketId}
          insight={insight}
          onDismiss={() => handleDismiss(insight.marketId)}
        />
      ))}
    </div>
  );
}
