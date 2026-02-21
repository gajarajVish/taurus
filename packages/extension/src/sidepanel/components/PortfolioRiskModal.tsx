import React from 'react';
import type { PortfolioAnalysis } from '@taurus/types';

interface PortfolioRiskModalProps {
  analysis: PortfolioAnalysis;
  onClose: () => void;
}

const RISK_COLOR: Record<string, string> = {
  low: '#00F5A0',
  medium: '#FFD93D',
  high: '#FF4757',
};

export function PortfolioRiskModal({ analysis, onClose }: PortfolioRiskModalProps) {
  const riskColor = RISK_COLOR[analysis.overallRisk] ?? RISK_COLOR.medium;
  const divPct = Math.round(analysis.diversificationScore * 100);

  return (
    <div className="sm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sm-container prm-container">
        <div className="sm-handle" />
        <div className="sm-header">
          <span className="sm-title">Risk Analysis</span>
          <button className="sm-close" onClick={onClose}>✕</button>
        </div>

        <div className="prm-stats">
          <div className="prm-stat">
            <span className="prm-stat-val" style={{ color: riskColor }}>
              {analysis.overallRisk.charAt(0).toUpperCase() + analysis.overallRisk.slice(1)}
            </span>
            <span className="prm-stat-lbl">Overall Risk</span>
          </div>
          <div className="prm-stat">
            <span className="prm-stat-val">{divPct}%</span>
            <span className="prm-stat-lbl">Diversification</span>
          </div>
        </div>

        <div className="prm-scroll">
          {analysis.summary && (
            <div className="pa-section">
              <span className="pa-section-title">Summary</span>
              <p className="pa-summary-text">{analysis.summary}</p>
            </div>
          )}

          {analysis.diversificationExplanation && (
            <div className="pa-section">
              <span className="pa-section-title">Diversification</span>
              <p className="pa-summary-text">{analysis.diversificationExplanation}</p>
            </div>
          )}

          {analysis.correlationWarnings.length > 0 && (
            <div className="pa-section pa-section--warn">
              <span className="pa-section-title">Correlation Risks</span>
              <div className="pa-items">
                {analysis.correlationWarnings.map((w, i) => (
                  <div key={i} className="pa-item">
                    <span className="pa-item-text">{w.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.hedgingSuggestions.length > 0 && (
            <div className="pa-section pa-section--hedge">
              <span className="pa-section-title">Hedging Ideas</span>
              <div className="pa-items">
                {analysis.hedgingSuggestions.map((h, i) => (
                  <div key={i} className="pa-item">
                    <span className="pa-item-text">{h.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
