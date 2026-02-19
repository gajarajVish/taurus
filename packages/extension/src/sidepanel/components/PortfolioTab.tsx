import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../../lib/api';
import { getInstallId } from '../../lib/storage';
import type { PortfolioAnalysis, PortfolioPosition, ActionableItem } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';

interface PortfolioTabProps {
  positions: PortfolioPosition[];
  displayPositions: DisplayPosition[];
  onExitPosition: (pos: DisplayPosition) => void;
}

const RISK_COLORS = {
  low: { color: '#00c896', bg: 'rgba(0,200,150,0.08)', label: 'Low Risk' },
  medium: { color: '#ffb347', bg: 'rgba(255,179,71,0.08)', label: 'Medium Risk' },
  high: { color: '#ff4d6a', bg: 'rgba(255,77,106,0.08)', label: 'High Risk' },
};

export function PortfolioTab({ positions, displayPositions, onExitPosition }: PortfolioTabProps) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (positions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const installId = await getInstallId();
      const { insights } = await api.insights.getAll(installId);
      const res = await api.insights.analyzePortfolio({ positions, insights });
      setAnalysis(res.analysis);
    } catch (err) {
      setError('Failed to analyze portfolio');
      console.error('[PortfolioTab]', err);
    } finally {
      setLoading(false);
    }
  }, [positions]);

  // Auto-run analysis when there are positions and no result yet
  useEffect(() => {
    if (positions.length > 0 && !analysis && !loading && !error) {
      runAnalysis();
    }
  }, [positions, analysis, loading, error, runAnalysis]);

  if (positions.length === 0) {
    return (
      <div className="it-state">
        <span className="it-state-title">No positions to analyze</span>
        <span className="it-state-text">Open some positions on Polymarket to get AI-powered risk analysis and hedging suggestions.</span>
      </div>
    );
  }

  if (loading || (!analysis && !error)) {
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

      {/* Risk explanation */}
      {analysis.riskExplanation ? (
        <p className="ic-summary" style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '4px' }}>{analysis.riskExplanation}</p>
      ) : null}

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

      {/* Diversification explanation */}
      {analysis.diversificationExplanation ? (
        <p className="ic-summary" style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>{analysis.diversificationExplanation}</p>
      ) : null}

      {/* Trends */}
      {analysis.trends.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-title">Trends</div>
          {analysis.trends.map((t: string, i: number) => (
            <div key={i} className="pa-item">
              <span className="pa-bullet" style={{ background: 'var(--color-brand)' }} />
              <span className="pa-item-text">{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Correlation Warnings */}
      {analysis.correlationWarnings.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-title" style={{ color: 'var(--color-warning)' }}>Correlation Risks</div>
          {analysis.correlationWarnings.map((w: ActionableItem, i: number) => (
            <div key={i} className="pa-item pa-item--actionable">
              <span className="pa-bullet" style={{ background: 'var(--color-warning)' }} />
              <div className="pa-item-content">
                <span>{w.text}</span>
                {w.positionIndices.length > 0 && (
                  <div className="pa-exit-links">
                    {w.positionIndices.map((idx: number) => {
                      const pos = displayPositions[idx];
                      if (!pos) return null;
                      return (
                        <button
                          key={idx}
                          className="pa-exit-link pa-exit-link--warning"
                          onClick={() => onExitPosition(pos)}
                          title={pos.marketQuestion}
                        >
                          <span className="pa-exit-link-arrow">Exit →</span>
                          <span className="pa-exit-link-label">{pos.marketQuestion}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hedging Suggestions */}
      {analysis.hedgingSuggestions.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-title" style={{ color: 'var(--color-success)' }}>Hedging Suggestions</div>
          {analysis.hedgingSuggestions.map((h: ActionableItem, i: number) => (
            <div key={i} className="pa-item pa-item--actionable">
              <span className="pa-bullet" style={{ background: 'var(--color-success)' }} />
              <div className="pa-item-content">
                <span>{h.text}</span>
                {h.positionIndices.length > 0 && (
                  <div className="pa-exit-links">
                    {h.positionIndices.map((idx: number) => {
                      const pos = displayPositions[idx];
                      if (!pos) return null;
                      return (
                        <button
                          key={idx}
                          className="pa-exit-link pa-exit-link--success"
                          onClick={() => onExitPosition(pos)}
                          title={pos.marketQuestion}
                        >
                          <span className="pa-exit-link-arrow">Exit →</span>
                          <span className="pa-exit-link-label">{pos.marketQuestion}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
