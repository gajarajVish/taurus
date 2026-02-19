import React, { useState } from 'react';
import { Badge } from './Badge';
import type { Insight } from '@taurus/types';

interface InsightCardProps {
  insight: Insight;
  onDismiss?: () => void;
}

export function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sentimentVariant = {
    bullish: 'positive' as const,
    bearish: 'negative' as const,
    neutral: 'neutral' as const,
  }[insight.sentiment];

  const shiftSign = insight.consensusShift >= 0 ? '+' : '';
  const shiftPercent = Math.round(insight.consensusShift * 100);

  const scorePercent = Math.round(insight.score * 100);

  const timeAgo = getTimeAgo(insight.timestamp);

  return (
    <div className="insight-card">
      <div className="insight-header">
        <div className="insight-badges">
          <Badge
            label={insight.sentiment.toUpperCase()}
            variant={sentimentVariant}
            size="sm"
          />
          <span className="insight-confidence">
            {scorePercent}% confidence
          </span>
        </div>
        {onDismiss && (
          <button className="insight-dismiss" onClick={onDismiss} title="Dismiss">
            ×
          </button>
        )}
      </div>

      <div className="insight-summary">
        {insight.summary}
      </div>

      <div className="insight-meta">
        <div className="insight-stats">
          <span className="insight-stat">
            <span className="insight-stat-label">Shift:</span>
            <span className={`insight-stat-value ${insight.consensusShift >= 0 ? 'positive' : 'negative'}`}>
              {shiftSign}{shiftPercent}%
            </span>
          </span>
          <span className="insight-stat">
            <span className="insight-stat-label">Tweets:</span>
            <span className="insight-stat-value">{insight.tweetCount}</span>
          </span>
          <span className="insight-stat">
            <span className="insight-stat-label">Opportunity:</span>
            <span className="insight-stat-value">{Math.round(insight.opportunityScore * 100)}%</span>
          </span>
        </div>
        <span className="insight-time">{timeAgo}</span>
      </div>

      {insight.riskFlags.length > 0 && (
        <button
          className="insight-expand-btn"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Hide' : 'Show'} risk flags ({insight.riskFlags.length})
        </button>
      )}

      {isExpanded && insight.riskFlags.length > 0 && (
        <div className="insight-risks">
          {insight.riskFlags.map((flag, idx) => (
            <div key={idx} className="insight-risk-item">
              <span className="risk-icon">⚠</span>
              {flag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
