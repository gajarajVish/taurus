import React, { useState, useCallback } from 'react';
import { api } from '../../lib/api';
import type { PortfolioAnalysis, PortfolioPosition } from '@taurus/types';

interface PortfolioTabProps {
  positions: PortfolioPosition[];
}

const RISK_COLORS = {
  low: { color: '#00c896', bg: 'rgba(0,200,150,0.08)', label: 'Low Risk' },
  medium: { color: '#ffb347', bg: 'rgba(255,179,71,0.08)', label: 'Medium Risk' },
  high: { color: '#ff4d6a', bg: 'rgba(255,77,106,0.08)', label: 'High Risk' },
};

export function PortfolioTab({ positions }: PortfolioTabProps) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (positions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.insights.analyzePortfolio({ positions });
      setAnalysis(res.analysis);
    } catch (err) {
      setError('Failed to analyze portfolio');
      console.error('[PortfolioTab]', err);
    } finally {
      setLoading(false);
    }
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div className="it-state">
        <span className="it-state-title">No positions to analyze</span>
        <span className="it-state-text">Open some positions on Polymarket to get AI-powered risk analysis and hedging suggestions.</span>
      </div>
    );
  }

  if (!analysis && !loading && !error) {
    return (
      <div className="it-state">
        <div className="it-state-glyph">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <span className="it-state-title">Portfolio Risk Analysis</span>
        <span className="it-state-text">Run AI analysis on your {positions.length} position{positions.length > 1 ? 's' : ''} to find correlations, risks, and hedging opportunities.</span>
        <button className="pa-run-btn" onClick={runAnalysis}>Analyze Portfolio</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="it-state">
        <div className="it-spinner" />
        <span className="it-state-text">Analyzing {positions.length} positions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="it-state">
        <span className="it-state-title">{error}</span>
        <button className="it-retry" onClick={runAnalysis}>Try again</button>
      </div>
    );
  }

  if (!analysis) return null;

  const risk = RISK_COLORS[analysis.overallRisk as keyof typeof RISK_COLORS];
  const divPct = Math.round(analysis.diversificationScore * 100);

  return (
    <div className="pa-container">
      {/* Risk badge + refresh */}
      <div className="pa-header">
        <div className="ic-pill" style={{ background: risk.bg, color: risk.color }}>
          {risk.label}
        </div>
        <button className="it-refresh" onClick={runAnalysis} title="Re-analyze">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      {/* Summary */}
      <p className="ic-summary">{analysis.summary}</p>

      {/* Diversification bar */}
      <div className="ic-stat" style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
        <span className="ic-stat-label">Diversification</span>
        <span className="ic-stat-value" style={{ color: 'var(--color-brand)' }}>{divPct}%</span>
        <div className="ic-bar-track">
          <div className="ic-bar-fill" style={{ width: `${divPct}%`, background: 'var(--color-brand)' }} />
        </div>
      </div>

      {/* Trends */}
      {analysis.trends.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-title">Trends</div>
          {analysis.trends.map((t: string, i: number) => (
            <div key={i} className="pa-item">
              <span className="pa-bullet" style={{ background: 'var(--color-brand)' }} />
              {t}
            </div>
          ))}
        </div>
      )}

      {/* Correlation Warnings */}
      {analysis.correlationWarnings.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-title" style={{ color: 'var(--color-warning)' }}>Correlation Risks</div>
          {analysis.correlationWarnings.map((w: string, i: number) => (
            <div key={i} className="pa-item">
              <span className="pa-bullet" style={{ background: 'var(--color-warning)' }} />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Hedging Suggestions */}
      {analysis.hedgingSuggestions.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-title" style={{ color: 'var(--color-success)' }}>Hedging Suggestions</div>
          {analysis.hedgingSuggestions.map((h: string, i: number) => (
            <div key={i} className="pa-item">
              <span className="pa-bullet" style={{ background: 'var(--color-success)' }} />
              {h}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
