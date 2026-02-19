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

const RISK_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  low:    { color: 'var(--color-success)', bg: 'rgba(48,209,88,0.1)',  label: 'Low Risk' },
  medium: { color: 'var(--color-warning)', bg: 'rgba(255,214,10,0.1)', label: 'Medium Risk' },
  high:   { color: 'var(--color-error)',   bg: 'rgba(255,69,58,0.1)',  label: 'High Risk' },
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
      <div className="pa-empty-card">
        <div className="pa-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.3" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span className="pa-empty-title">No positions to analyze</span>
        <span className="pa-empty-text">Open some positions on Polymarket to get AI-powered risk analysis and hedging suggestions.</span>
      </div>
    );
  }

  if (loading || (!analysis && !error)) {
    return (
      <div className="pa-empty-card">
        <div className="pa-loading-spinner" />
        <span className="pa-empty-text">Analyzing {positions.length} positions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pa-empty-card">
        <div className="pa-empty-icon pa-empty-icon--error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <span className="pa-empty-title">{error}</span>
        <button className="pa-action-btn" onClick={runAnalysis}>Try Again</button>
      </div>
    );
  }

  if (!analysis) return null;

  const risk = RISK_COLORS[analysis.overallRisk] ?? RISK_COLORS.medium;
  const divPct = Math.round(analysis.diversificationScore * 100);

  return (
    <div className="pa-container">
      {/* Risk Overview Card */}
      <div className="pa-risk-card">
        <div className="pa-risk-top">
          <div className="pa-risk-pill" style={{ background: risk.bg, color: risk.color }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {risk.label}
          </div>
          <button className="pa-refresh-btn" onClick={runAnalysis} title="Re-analyze">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        {analysis.riskExplanation && (
          <p className="pa-risk-explanation">{analysis.riskExplanation}</p>
        )}
        <p className="pa-summary">{analysis.summary}</p>
      </div>

      {/* Diversification Gauge */}
      <div className="pa-gauge-card">
        <div className="pa-gauge-header">
          <span className="pa-gauge-label">Diversification</span>
          <span className="pa-gauge-value">{divPct}%</span>
        </div>
        <div className="pa-gauge-track">
          <div className="pa-gauge-fill" style={{ width: `${divPct}%` }} />
        </div>
        {analysis.diversificationExplanation && (
          <p className="pa-gauge-hint">{analysis.diversificationExplanation}</p>
        )}
      </div>

      {/* Trends */}
      {analysis.trends.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-header">
            <div className="pa-section-icon pa-section-icon--brand">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <span className="pa-section-title">Trends</span>
          </div>
          <div className="pa-section-group">
            {analysis.trends.map((t: string, i: number) => (
              <div key={i} className="pa-section-row">
                <span className="pa-row-bullet pa-row-bullet--brand" />
                <span className="pa-row-text">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correlation Warnings */}
      {analysis.correlationWarnings.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-header">
            <div className="pa-section-icon pa-section-icon--warning">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <span className="pa-section-title">Correlation Risks</span>
          </div>
          <div className="pa-section-group">
            {analysis.correlationWarnings.map((w: ActionableItem, i: number) => (
              <div key={i} className="pa-section-row pa-section-row--actionable">
                <span className="pa-row-bullet pa-row-bullet--warning" />
                <div className="pa-row-content">
                  <span className="pa-row-text">{w.text}</span>
                  {w.positionIndices.length > 0 && (
                    <div className="pa-exit-links">
                      {w.positionIndices.map((idx: number) => {
                        const pos = displayPositions[idx];
                        if (!pos) return null;
                        return (
                          <button
                            key={idx}
                            className="pa-exit-btn pa-exit-btn--warning press-effect"
                            onClick={() => onExitPosition(pos)}
                            title={pos.marketQuestion}
                          >
                            <span className="pa-exit-btn-label">{pos.marketQuestion}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hedging Suggestions */}
      {analysis.hedgingSuggestions.length > 0 && (
        <div className="pa-section">
          <div className="pa-section-header">
            <div className="pa-section-icon pa-section-icon--success">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="pa-section-title">Hedging Suggestions</span>
          </div>
          <div className="pa-section-group">
            {analysis.hedgingSuggestions.map((h: ActionableItem, i: number) => (
              <div key={i} className="pa-section-row pa-section-row--actionable">
                <span className="pa-row-bullet pa-row-bullet--success" />
                <div className="pa-row-content">
                  <span className="pa-row-text">{h.text}</span>
                  {h.positionIndices.length > 0 && (
                    <div className="pa-exit-links">
                      {h.positionIndices.map((idx: number) => {
                        const pos = displayPositions[idx];
                        if (!pos) return null;
                        return (
                          <button
                            key={idx}
                            className="pa-exit-btn pa-exit-btn--success press-effect"
                            onClick={() => onExitPosition(pos)}
                            title={pos.marketQuestion}
                          >
                            <span className="pa-exit-btn-label">{pos.marketQuestion}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
