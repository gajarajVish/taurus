import React, { useState } from 'react';
import type { Insight } from '@taurus/types';

interface InsightCardProps {
  insight: Insight;
  onDismiss?: () => void;
}

export function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  const scorePercent = Math.round(insight.score * 100);
  const shiftPercent = Math.round(insight.consensusShift * 100);
  const shiftSign = shiftPercent >= 0 ? '+' : '';
  const opportunityPercent = Math.round(insight.opportunityScore * 100);
  const timeAgo = getTimeAgo(insight.timestamp);

  const sentimentConfig = {
    bullish: { label: 'Bullish', color: '#34d399', icon: '↗', bg: 'rgba(52,211,153,0.1)' },
    bearish: { label: 'Bearish', color: '#f87171', icon: '↘', bg: 'rgba(248,113,113,0.1)' },
    neutral: { label: 'Neutral', color: '#8b8fa3', icon: '→', bg: 'rgba(139,143,163,0.1)' },
  }[insight.sentiment];

  const shiftColor = shiftPercent >= 0 ? '#34d399' : '#f87171';

  return (
    <div className="ic" style={{ borderLeftColor: sentimentConfig.color }}>
      {/* Top row: sentiment pill + time + dismiss */}
      <div className="ic-top">
        <div className="ic-pill" style={{ background: sentimentConfig.bg, color: sentimentConfig.color }}>
          <span className="ic-pill-icon">{sentimentConfig.icon}</span>
          {sentimentConfig.label}
        </div>
        <div className="ic-top-right">
          <span className="ic-time">{timeAgo}</span>
          {onDismiss && (
            <button className="ic-dismiss" onClick={onDismiss} aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Summary text */}
      <p className="ic-summary">{insight.summary}</p>

      {/* Stats grid */}
      <div className="ic-grid">
        <StatCell label="Confidence" value={`${scorePercent}%`} bar={scorePercent} color="var(--color-brand)" />
        <StatCell label="Shift" value={`${shiftSign}${shiftPercent}%`} bar={Math.abs(shiftPercent) * 3} color={shiftColor} />
        <StatCell label="Opportunity" value={`${opportunityPercent}%`} bar={opportunityPercent} color="#a78bfa" />
        <StatCell label="Tweets" value={String(insight.tweetCount)} />
      </div>

      {/* Risk flags */}
      {insight.riskFlags.length > 0 && (
        <>
          <button className="ic-risks-toggle" onClick={() => setExpanded(!expanded)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>{insight.riskFlags.length} risk flag{insight.riskFlags.length > 1 ? 's' : ''}</span>
            <svg className={`ic-chevron ${expanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {expanded && (
            <div className="ic-risks">
              {insight.riskFlags.map((flag, i) => (
                <div key={i} className="ic-risk-row">
                  <span className="ic-risk-dot" />
                  {flag}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCell({ label, value, bar, color }: { label: string; value: string; bar?: number; color?: string }) {
  return (
    <div className="ic-stat">
      <span className="ic-stat-label">{label}</span>
      <span className="ic-stat-value" style={color ? { color } : undefined}>{value}</span>
      {bar !== undefined && (
        <div className="ic-bar-track">
          <div className="ic-bar-fill" style={{ width: `${Math.min(bar, 100)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
