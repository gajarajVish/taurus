import React, { useState } from 'react';
import type { Insight, SourceTweet } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';

interface InsightCardProps {
  insight: Insight;
  position?: DisplayPosition;
  onDismiss?: () => void;
  onIncreasePosition?: (marketId: string, side: 'YES' | 'NO') => void;
  onExitPosition?: () => void;
}

const SENTIMENT = {
  bullish: { label: 'Bullish', color: '#00F5A0', cls: 'bullish' },
  bearish: { label: 'Bearish', color: '#FF4757', cls: 'bearish' },
  neutral: { label: 'Neutral', color: '#6B6B8A', cls: 'neutral' },
} as const;

export function InsightCard({ insight, position, onDismiss, onIncreasePosition, onExitPosition }: InsightCardProps) {
  const [open, setOpen] = useState(false);

  // Derive action: sentiment aligned with position side → increase; against → exit
  // bullish + YES or bearish + NO → increase; bearish + YES or bullish + NO → exit
  let positionAction: 'increase' | 'exit' | null = null;
  if (position && insight.sentiment !== 'neutral') {
    const aligned =
      (insight.sentiment === 'bullish' && position.side === 'yes') ||
      (insight.sentiment === 'bearish' && position.side === 'no');
    positionAction = aligned ? 'increase' : 'exit';
  }

  const conf = Math.round(insight.score * 100);
  const shift = Math.round(insight.consensusShift * 100);
  const opp = Math.round(insight.opportunityScore * 100);
  const timeAgo = getTimeAgo(insight.timestamp);
  const s = SENTIMENT[insight.sentiment];
  const shiftSign = shift >= 0 ? '+' : '';
  const sourceTweets = insight.sourceTweets ?? [];

  return (
    <div className={`ic ic--${s.cls}`}>
      {/* Meta row */}
      <div className="ic-meta">
        <span className="ic-sentiment" style={{ color: s.color }}>{s.label}</span>
        <span className="ic-dot">&middot;</span>
        <span className="ic-time">{timeAgo}</span>
        {onDismiss && (
          <button className="ic-dismiss" onClick={onDismiss} aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Title */}
      <h3 className="ic-title">{insight.marketQuestion}</h3>

      {/* Summary */}
      <p className={open ? 'ic-summary' : 'ic-summary ic-summary--clamped'}>
        {insight.summary}
      </p>

      {/* Stats row */}
      <div className="ic-stats">
        <div className="ic-stat">
          <span className="ic-stat-val">{conf}%</span>
          <span className="ic-stat-lbl">Confidence</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-val">{shiftSign}{shift}%</span>
          <span className="ic-stat-lbl">Shift</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-val">{opp}%</span>
          <span className="ic-stat-lbl">Opportunity</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-val">{insight.tweetCount}</span>
          <span className="ic-stat-lbl">{insight.tweetCount === 1 ? 'Tweet' : 'Tweets'}</span>
        </div>
      </div>

      {/* Footer: position info + details toggle */}
      <div className="ic-foot">
        {position && (
          <span className="ic-position">
            <span className="ic-position-side" style={{ color: position.side === 'yes' ? '#00F5A0' : '#FF4757' }}>
              {position.side.toUpperCase()}
            </span>
            <span className="ic-position-size">{position.size}</span>
            <span className="ic-position-pnl" style={{ color: position.pnlPercent >= 0 ? '#00F5A0' : '#FF4757' }}>
              {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%
            </span>
          </span>
        )}
        {(insight.riskFlags.length > 0 || sourceTweets.length > 0) && (
          <button className="ic-toggle" onClick={() => setOpen(!open)}>
            {open ? 'Less' : 'Details'}
            <svg className={`ic-chev ${open ? 'open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        )}
      </div>

      {/* Position action buttons */}
      {positionAction && (
        <div className="ic-actions">
          {positionAction === 'increase' && onIncreasePosition && (
            <button
              className="ic-action-btn ic-action-btn--increase"
              onClick={() => onIncreasePosition(insight.marketId, position!.side === 'yes' ? 'YES' : 'NO')}
            >
              ↑ Increase Position
            </button>
          )}
          {positionAction === 'exit' && onExitPosition && (
            <button
              className="ic-action-btn ic-action-btn--exit"
              onClick={onExitPosition}
            >
              ↗ Exit Position
            </button>
          )}
        </div>
      )}

      {/* Expanded details */}
      {open && (
        <div className="ic-details">
          {insight.riskFlags.length > 0 && (
            <div className="ic-section">
              <span className="ic-section-label">Risk Flags</span>
              {insight.riskFlags.map((flag, i) => (
                <p key={i} className="ic-section-item">&bull; {flag}</p>
              ))}
            </div>
          )}
          {sourceTweets.length > 0 && (
            <div className="ic-section">
              <span className="ic-section-label">Sources</span>
              {sourceTweets.map((tweet) => (
                <TweetRow key={tweet.tweetId} tweet={tweet} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TweetRow({ tweet }: { tweet: SourceTweet }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 120;
  const long = tweet.text.length > MAX;
  const text = expanded || !long ? tweet.text : tweet.text.slice(0, MAX) + '\u2026';

  return (
    <div className="ic-tweet">
      <p className="ic-tweet-text">{text}</p>
      <div className="ic-tweet-foot">
        {long && (
          <button className="ic-tweet-more" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'less' : 'more'}
          </button>
        )}
        <a className="ic-tweet-link" href={`https://x.com/i/status/${tweet.tweetId}`}
          target="_blank" rel="noopener noreferrer">
          view on X
        </a>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
