import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../../lib/api';
import { getInstallId } from '../../lib/storage';
import type { PortfolioAnalysis, PortfolioPosition } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';

interface PortfolioTabProps {
  positions: PortfolioPosition[];
  displayPositions: DisplayPosition[];
  onExitPosition: (pos: DisplayPosition) => void;
}

const RISK_COLOR: Record<string, string> = {
  low: '#00F5A0',
  medium: '#FFD93D',
  high: '#FF4757',
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

  useEffect(() => {
    if (positions.length > 0 && !analysis && !loading && !error) {
      runAnalysis();
    }
  }, [positions, analysis, loading, error, runAnalysis]);

  /* ── Empty ── */
  if (positions.length === 0) {
    return (
      <div className="pa-empty">
        <span className="pa-empty-title">No positions to analyze</span>
        <span className="pa-empty-sub">Open some positions to get AI-powered risk insights.</span>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading || (!analysis && !error)) {
    return (
      <div className="pa-empty">
        <div className="pa-spinner" />
        <span className="pa-empty-sub">Analyzing {positions.length} position{positions.length > 1 ? 's' : ''}&hellip;</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="pa-empty">
        <span className="pa-empty-title">{error}</span>
        <button className="pa-retry" onClick={runAnalysis}>Try Again</button>
      </div>
    );
  }

  if (!analysis) return null;

  const riskColor = RISK_COLOR[analysis.overallRisk] ?? RISK_COLOR.medium;
  const divPct = Math.round(analysis.diversificationScore * 100);

  return (
    <div className="pa-tab">
      {/* ── Header with refresh ── */}
      <div className="pa-header">
        <span className="pa-header-title">Portfolio Analysis</span>
        <button className="pa-header-refresh" onClick={runAnalysis} title="Re-analyze">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      {/* ── Stats row — plain numbers ── */}
      <div className="pa-stats">
        <div className="pa-stat">
          <span className="pa-stat-val" style={{ color: riskColor }}>{analysis.overallRisk.charAt(0).toUpperCase() + analysis.overallRisk.slice(1)}</span>
          <span className="pa-stat-lbl">Risk</span>
        </div>
        <div className="pa-stat">
          <span className="pa-stat-val">{divPct}%</span>
          <span className="pa-stat-lbl">Diversification</span>
        </div>
        <div className="pa-stat">
          <span className="pa-stat-val">{positions.length}</span>
          <span className="pa-stat-lbl">{positions.length === 1 ? 'Position' : 'Positions'}</span>
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="pa-summary">
        <p className="pa-summary-text">{analysis.summary}</p>
        {analysis.riskExplanation && (
          <p className="pa-summary-hint">{analysis.riskExplanation}</p>
        )}
        {analysis.diversificationExplanation && (
          <p className="pa-summary-hint">{analysis.diversificationExplanation}</p>
        )}
      </div>

      {/* ── Trends ── */}
      {analysis.trends.length > 0 && (
        <div className="pa-section">
          <span className="pa-section-title">Trends</span>
          <ul className="pa-list">
            {analysis.trends.map((t, i) => (
              <li key={i} className="pa-list-item">{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Correlation Risks ── */}
      {analysis.correlationWarnings.length > 0 && (
        <div className="pa-section pa-section--warn">
          <span className="pa-section-title">Correlation Risks</span>
          <div className="pa-items">
            {analysis.correlationWarnings.map((item, i) => (
              <div key={i} className="pa-item">
                <span className="pa-item-text">{item.text}</span>
                {item.positionIndices?.length > 0 && (
                  <div className="pa-item-actions">
                    {item.positionIndices.map((idx) => {
                      const pos = displayPositions[idx];
                      if (!pos) return null;
                      return (
                        <button key={idx} className="pa-exit" onClick={() => onExitPosition(pos)} title={pos.marketQuestion}>
                          {pos.marketQuestion}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hedging Ideas ── */}
      {analysis.hedgingSuggestions.length > 0 && (
        <div className="pa-section pa-section--hedge">
          <span className="pa-section-title">Hedging Ideas</span>
          <div className="pa-items">
            {analysis.hedgingSuggestions.map((item, i) => (
              <div key={i} className="pa-item">
                <span className="pa-item-text">{item.text}</span>
                {item.positionIndices?.length > 0 && (
                  <div className="pa-item-actions">
                    {item.positionIndices.map((idx) => {
                      const pos = displayPositions[idx];
                      if (!pos) return null;
                      return (
                        <button key={idx} className="pa-exit" onClick={() => onExitPosition(pos)} title={pos.marketQuestion}>
                          {pos.marketQuestion}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
