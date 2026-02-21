import React, { useState, useEffect } from 'react';
import { Badge } from './Badge';
import { Sparkline } from './Sparkline';
import { api } from '../../lib/api';

// Module-level cache so chart data survives tab switches / re-renders
const chartCache = new Map<string, number[]>();

interface PositionItemProps {
  marketQuestion: string;
  side: 'yes' | 'no';
  size: string;
  pnlPercent: number;
  outcomeId: string;
  onExit?: () => void;
  onClick?: () => void;
}

export function PositionItem({ marketQuestion, side, size, pnlPercent, outcomeId, onExit, onClick }: PositionItemProps) {
  const isPositive = pnlPercent >= 0;
  const pnlSign = isPositive ? '+' : '';
  const pnlColorClass = isPositive ? 'positive' : 'negative';

  const [chartData, setChartData] = useState<number[] | null>(chartCache.get(outcomeId) ?? null);

  useEffect(() => {
    if (!outcomeId) return;
    if (chartCache.has(outcomeId)) {
      setChartData(chartCache.get(outcomeId)!);
      return;
    }

    let cancelled = false;
    api.markets.priceHistory(outcomeId, '1d', 60).then((res) => {
      if (cancelled) return;
      const prices = res.history.map((h) => h.p);
      // Need at least 2 points for a line; if we only have 1, duplicate it so sparkline can render
      if (prices.length >= 1) {
        const data = prices.length > 1 ? prices : [prices[0], prices[0]];
        chartCache.set(outcomeId, data);
        setChartData(data);
      }
    }).catch(() => { /* silently skip — no chart is fine */ });

    return () => { cancelled = true; };
  }, [outcomeId]);

  const chartColor = chartData && chartData.length > 1
    ? chartData[chartData.length - 1] >= chartData[0] ? '#00F5A0' : '#FF4757'
    : '#4C4C6E';

  return (
    <div
      className={`position-item position-item--${side}${onClick ? ' position-item--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="position-header">
        <div className="position-question">{marketQuestion}</div>
        {chartData && chartData.length > 1 && (
          <div className="position-mini-chart">
            <Sparkline data={chartData} width={60} height={20} color={chartColor} filled={false} />
          </div>
        )}
        <Badge
          label={side}
          variant={side === 'yes' ? 'positive' : 'negative'}
          size="sm"
        />
      </div>

      <div className="position-meta">
        <div className="position-stats">
          <span className="position-size">{size}</span>
        </div>
        <div className="position-actions">
          <span className={`position-pnl ${pnlColorClass}`}>
            {pnlSign}{pnlPercent.toFixed(1)}%
          </span>
          {onExit && (
            <button
              className="position-exit-icon-btn press-effect"
              onClick={(e) => { e.stopPropagation(); onExit(); }}
              title="Exit position"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
