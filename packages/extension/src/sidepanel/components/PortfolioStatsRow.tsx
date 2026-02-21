import React from 'react';
import type { PortfolioAnalysis } from '@taurus/types';

const RISK_COLOR: Record<string, string> = {
  low: '#00F5A0',
  medium: '#FFD93D',
  high: '#FF4757',
};

interface PortfolioStatsRowProps {
  analysis: PortfolioAnalysis | null;
  loading: boolean;
  positionCount: number;
  onRefresh: () => void;
  onShowDetails?: () => void;
}

export function PortfolioStatsRow({ analysis, loading, positionCount, onRefresh, onShowDetails }: PortfolioStatsRowProps) {
  if (positionCount === 0) return null;

  if (loading) {
    return (
      <div className="pa-stats pa-stats-row">
        <div className="pa-stat pa-stat--shimmer">
          <span className="pa-stat-val pa-shimmer-block" />
          <span className="pa-stat-lbl">Risk</span>
        </div>
        <div className="pa-stat pa-stat--shimmer">
          <span className="pa-stat-val pa-shimmer-block" />
          <span className="pa-stat-lbl">Diversification</span>
        </div>
        <div className="pa-stat">
          <span className="pa-stat-val">{positionCount}</span>
          <span className="pa-stat-lbl">{positionCount === 1 ? 'Position' : 'Positions'}</span>
        </div>
      </div>
    );
  }

  if (!analysis) {
  return (
    <div
      className={`pa-stats pa-stats-row${onShowDetails ? ' pa-stats-row--clickable' : ''}`}
      onClick={onShowDetails}
    >
      <div className="pa-stat">
          <button className="pa-retry" onClick={onRefresh} style={{ marginBottom: 2 }}>Analyze</button>
          <span className="pa-stat-lbl">Portfolio Risk</span>
        </div>
        <div className="pa-stat">
          <span className="pa-stat-val">—</span>
          <span className="pa-stat-lbl">Diversification</span>
        </div>
        <div className="pa-stat">
          <span className="pa-stat-val">{positionCount}</span>
          <span className="pa-stat-lbl">{positionCount === 1 ? 'Position' : 'Positions'}</span>
        </div>
      </div>
    );
  }

  const riskColor = RISK_COLOR[analysis.overallRisk] ?? RISK_COLOR.medium;
  const divPct = Math.round(analysis.diversificationScore * 100);

  return (
    <div
      className={`pa-stats pa-stats-row${onShowDetails ? ' pa-stats-row--clickable' : ''}`}
      onClick={onShowDetails}
    >
      <div className="pa-stat">
        <span className="pa-stat-val" style={{ color: riskColor }}>
          {analysis.overallRisk.charAt(0).toUpperCase() + analysis.overallRisk.slice(1)}
        </span>
        <span className="pa-stat-lbl">Overall Risk</span>
      </div>
      <div className="pa-stat">
        <span className="pa-stat-val">{divPct}%</span>
        <span className="pa-stat-lbl">Diversification</span>
      </div>
      <div className="pa-stat" style={{ alignItems: 'flex-end' }}>
        <span className="pa-stat-val">{positionCount}</span>
        <span className="pa-stat-lbl">{positionCount === 1 ? 'Position' : 'Positions'}</span>
      </div>
    </div>
  );
}
