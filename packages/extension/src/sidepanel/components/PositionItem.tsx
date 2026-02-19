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
}

export function PositionItem({ marketQuestion, side, size, pnlPercent, outcomeId, onExit }: PositionItemProps) {
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
      if (prices.length > 1) {
        chartCache.set(outcomeId, prices);
        setChartData(prices);
      }
    }).catch(() => { /* silently skip — no chart is fine */ });

    return () => { cancelled = true; };
  }, [outcomeId]);

  const chartColor = chartData && chartData.length > 1
    ? chartData[chartData.length - 1] >= chartData[0] ? '#00c896' : '#f91880'
    : '#555';

  return (
    <div className={`position-item position-item--${side}`}>
      <div className="position-header">
        <div className="position-question">{marketQuestion}</div>
        <Badge
          label={side}
          variant={side === 'yes' ? 'positive' : 'negative'}
          size="sm"
        />
      </div>

      {chartData && chartData.length > 1 && (
        <div className="position-chart">
          <Sparkline data={chartData} width={120} height={28} color={chartColor} />
        </div>
      )}

      <div className="position-meta">
        <div className="position-stats">
          <span>{size} invested</span>
        </div>
        <div className="position-actions">
          <span className={`position-pnl ${pnlColorClass}`}>
            {pnlSign}{pnlPercent.toFixed(1)}%
          </span>
          {onExit && (
            <button className="position-exit-btn press-effect" onClick={onExit}>
              Exit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
