import React, { useState } from 'react';
import type { Insight, SourceTweet } from '@taurus/types';
import type { DisplayPosition } from '../Sidecar';

interface InsightCardProps {
  insight: Insight;
  position?: DisplayPosition;
  onDismiss?: () => void;
}

export function InsightCard({ insight, position, onDismiss }: InsightCardProps) {
  const [cardExpanded, setCardExpanded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showTweets, setShowTweets] = useState(false);

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
  const sourceTweets = insight.sourceTweets ?? [];

  return (
    <div className="ic" style={{ borderLeftColor: sentimentConfig.color }}>
      {/* Top row: sentiment pill + market question (truncated) + time + dismiss */}
      <div className="ic-top-v2">
        <div className="ic-pill" style={{ background: sentimentConfig.bg, color: sentimentConfig.color }}>
          <span className="ic-pill-icon">{sentimentConfig.icon}</span>
          {sentimentConfig.label}
        </div>
        <p className={cardExpanded ? 'ic-market-question--expanded' : 'ic-market-question--collapsed'}>
          {insight.marketQuestion}
        </p>
        <span className="ic-time">{timeAgo}</span>
        {onDismiss && (
          <button className="ic-dismiss" onClick={onDismiss} aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Summary — 2-line clamp when collapsed, full when expanded */}
      <p className={cardExpanded ? 'ic-summary ic-summary--expanded' : 'ic-summary ic-summary--collapsed'}>
        {insight.summary}
      </p>

      {/* Collapsed strip: position micro-pill + inline stats + expand button */}
      {!cardExpanded && (
        <div className="ic-stats-strip">
          {position && (
            <span className={`ic-stats-strip-pos ic-stats-strip-pos--${position.side}`}>
              {position.side.toUpperCase()} {position.size}
            </span>
          )}
          <span className="ic-stats-strip-seg">{scorePercent}%</span>
          <span className="ic-stats-strip-lbl">conf</span>
          <span className="ic-stats-strip-div">·</span>
          <span className="ic-stats-strip-seg">{shiftSign}{shiftPercent}%</span>
          <span className="ic-stats-strip-lbl">shift</span>
          <span className="ic-stats-strip-div">·</span>
          <span className="ic-stats-strip-seg">{opportunityPercent}%</span>
          <span className="ic-stats-strip-lbl">opp</span>
          <button className="ic-stats-strip-expand" onClick={() => setCardExpanded(true)}>
            More
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      )}

      {/* Expanded detail content */}
      {cardExpanded && (
        <div className="ic-expanded-content">
          {/* Position badge — only shown when user has a position */}
          {position && (
            <div className="ic-position-badge ic-position-badge--active">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="ic-position-label">Your position</span>
              <span
                className="ic-position-side"
                style={{ color: position.side === 'yes' ? '#34d399' : '#f87171' }}
              >
                {position.side.toUpperCase()}
              </span>
              <span className="ic-position-size">{position.size}</span>
              <span
                className="ic-position-pnl"
                style={{ color: position.pnlPercent >= 0 ? '#34d399' : '#f87171' }}
              >
                {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(1)}%
              </span>
            </div>
          )}

          {/* Stats grid */}
          <div className="ic-grid">
            <StatCell label="Confidence" value={`${scorePercent}%`} bar={scorePercent} color="var(--color-brand)" />
            <StatCell label="Shift" value={`${shiftSign}${shiftPercent}%`} bar={Math.abs(shiftPercent) * 3} color={shiftColor} />
            <StatCell label="Opportunity" value={`${opportunityPercent}%`} bar={opportunityPercent} color="#a78bfa" />
            <StatCell label={insight.tweetCount === 1 ? 'Tweet' : 'Tweets'} value={String(insight.tweetCount)} />
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

          {/* Source tweets */}
          {sourceTweets.length > 0 && (
            <>
              <button className="ic-tweets-toggle" onClick={() => setShowTweets(!showTweets)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span>{sourceTweets.length} source tweet{sourceTweets.length > 1 ? 's' : ''}</span>
                <svg className={`ic-chevron ${showTweets ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showTweets && (
                <div className="ic-tweets">
                  {sourceTweets.map((tweet) => (
                    <TweetRow key={tweet.tweetId} tweet={tweet} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Collapse button */}
          <button className="ic-collapse-btn" onClick={() => setCardExpanded(false)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
            Less
          </button>
        </div>
      )}
    </div>
  );
}

function TweetRow({ tweet }: { tweet: SourceTweet }) {
  const [expanded, setExpanded] = useState(false);
  const TRUNCATE_LEN = 140;
  const isTruncated = tweet.text.length > TRUNCATE_LEN;
  const displayText = expanded || !isTruncated ? tweet.text : tweet.text.slice(0, TRUNCATE_LEN) + '…';

  return (
    <div className="ic-tweet-row">
      <p className="ic-tweet-text">{displayText}</p>
      <div className="ic-tweet-actions">
        {isTruncated && (
          <button className="ic-tweet-expand" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <a
          className="ic-tweet-link"
          href={`https://x.com/i/status/${tweet.tweetId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on X ↗
        </a>
      </div>
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
