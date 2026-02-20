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

const RISK_CONFIG: Record<string, { color: string; bg: string; glow: string; label: string; icon: JSX.Element }> = {
  low: {
    color: '#34d399', bg: 'rgba(52,211,153,0.06)', glow: 'rgba(52,211,153,0.15)',
    label: 'Low',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  medium: {
    color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', glow: 'rgba(251,191,36,0.15)',
    label: 'Medium',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  high: {
    color: '#f87171', bg: 'rgba(248,113,113,0.06)', glow: 'rgba(248,113,113,0.15)',
    label: 'High',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  },
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

  /* ── Empty state ── */
  if (positions.length === 0) {
    return (
      <div className="pa-state">
        <div className="pa-state-icon pa-state-icon--brand">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span className="pa-state-title">No positions to analyze</span>
        <span className="pa-state-sub">Open some positions to get AI-powered risk insights.</span>
      </div>
    );
  }

  /* ── Loading state ── */
  if (loading || (!analysis && !error)) {
    return (
      <div className="pa-state">
        <div className="pa-state-spinner" />
        <span className="pa-state-sub">Analyzing {positions.length} position{positions.length > 1 ? 's' : ''}…</span>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="pa-state">
        <div className="pa-state-icon pa-state-icon--error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <span className="pa-state-title">{error}</span>
        <button className="pa-state-btn press-effect" onClick={runAnalysis}>Try Again</button>
      </div>
    );
  }

  if (!analysis) return null;

  const risk = RISK_CONFIG[analysis.overallRisk] ?? RISK_CONFIG.medium;
  const divPct = Math.round(analysis.diversificationScore * 100);

  return (
    <div className="pa-wrap">
      {/* ── Risk Hero ── */}
      <div className="pa-hero" style={{ background: risk.bg }}>
        <div className="pa-hero-top">
          <div className="pa-hero-badge" style={{ color: risk.color, background: risk.glow }}>
            {risk.icon}
          </div>
          <button className="pa-hero-refresh press-effect" onClick={runAnalysis} title="Re-analyze">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div className="pa-hero-body">
          <div className="pa-hero-label">Risk Level</div>
          <div className="pa-hero-level" style={{ color: risk.color }}>{risk.label}</div>
          {analysis.riskExplanation && (
            <p className="pa-hero-explain">{analysis.riskExplanation}</p>
          )}
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="pa-stats">
        <div className="pa-stat-cell">
          <span className="pa-stat-num" style={{ color: 'var(--color-brand)' }}>{divPct}%</span>
          <span className="pa-stat-lbl">Diversification</span>
          <div className="pa-stat-bar">
            <div className="pa-stat-bar-fill" style={{ width: `${divPct}%` }} />
          </div>
        </div>
        <div className="pa-stat-divider" />
        <div className="pa-stat-cell">
          <span className="pa-stat-num">{positions.length}</span>
          <span className="pa-stat-lbl">Positions</span>
        </div>
      </div>

      {/* ── AI Summary ── */}
      <div className="pa-summary-card">
        <div className="pa-summary-hdr">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span className="pa-summary-lbl">AI Analysis</span>
        </div>
        <p className="pa-summary-text">{analysis.summary}</p>
        {analysis.diversificationExplanation && (
          <p className="pa-summary-hint">{analysis.diversificationExplanation}</p>
        )}
      </div>

      {/* ── Trends ── */}
      {analysis.trends.length > 0 && (
        <Section
          title="Trends"
          color="var(--color-brand)"
          items={analysis.trends.map(t => ({ text: t }))}
        />
      )}

      {/* ── Correlation Risks ── */}
      {analysis.correlationWarnings.length > 0 && (
        <Section
          title="Correlation Risks"
          color="var(--color-warning)"
          items={analysis.correlationWarnings}
          displayPositions={displayPositions}
          onExitPosition={onExitPosition}
        />
      )}

      {/* ── Hedging Ideas ── */}
      {analysis.hedgingSuggestions.length > 0 && (
        <Section
          title="Hedging Ideas"
          color="var(--color-success)"
          items={analysis.hedgingSuggestions}
          displayPositions={displayPositions}
          onExitPosition={onExitPosition}
        />
      )}
    </div>
  );
}

/* ── Reusable section component ── */
interface SectionProps {
  title: string;
  color: string;
  items: Array<{ text: string; positionIndices?: number[] }>;
  displayPositions?: DisplayPosition[];
  onExitPosition?: (pos: DisplayPosition) => void;
}

function Section({ title, color, items, displayPositions, onExitPosition }: SectionProps) {
  return (
    <div className="pa-sec">
      <div className="pa-sec-hdr">
        <span className="pa-sec-dot" style={{ background: color }} />
        <span className="pa-sec-title">{title}</span>
        <span className="pa-sec-count">{items.length}</span>
      </div>
      <div className="pa-sec-list">
        {items.map((item, i) => (
          <div key={i} className="pa-sec-row" style={{ borderLeftColor: color }}>
            <span className="pa-sec-text">{item.text}</span>
            {item.positionIndices && item.positionIndices.length > 0 && displayPositions && onExitPosition && (
              <div className="pa-sec-actions">
                {item.positionIndices.map((idx: number) => {
                  const pos = displayPositions[idx];
                  if (!pos) return null;
                  return (
                    <button
                      key={idx}
                      className="pa-sec-exit press-effect"
                      onClick={() => onExitPosition(pos)}
                      title={pos.marketQuestion}
                    >
                      <span className="pa-sec-exit-lbl">{pos.marketQuestion}</span>
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
  );
}
