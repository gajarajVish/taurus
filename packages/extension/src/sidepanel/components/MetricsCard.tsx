import React from 'react';
import { Sparkline } from './Sparkline';

interface MetricsCardProps {
  pnl: number;
  volume: number;
  streak: number;
  sparklineData?: number[];
}

export function MetricsCard({ pnl, volume, streak, sparklineData }: MetricsCardProps) {
  const pnlClass = pnl >= 0 ? 'positive' : 'negative';
  const pnlSign = pnl >= 0 ? '+' : '';

  // Use real PnL history if available, otherwise flat line at current PnL
  const data = sparklineData && sparklineData.length > 1 ? sparklineData : [pnl, pnl];

  return (
    <div className="metrics-card">
      <div className="metrics-row">
        <div className="metric-item">
          <div className="metric-label">Total PnL</div>
          <div className={`metric-value ${pnlClass}`}>
            {pnlSign}${Math.abs(pnl).toFixed(2)}
          </div>
        </div>
        <div className="metric-sparkline">
             <Sparkline data={data} width={80} height={25} color={pnl >= 0 ? '#30d158' : '#ff453a'} />
        </div>
      </div>

      <div className="metrics-divider" />

      <div className="metrics-row">
        <div className="metric-item">
          <div className="metric-label">Volume</div>
          <div className="metric-value metric-value--secondary">${volume.toLocaleString()}</div>
        </div>
        <div className="metric-item metric-item--end">
          <div className="metric-label">Streak</div>
          <div className="metric-value metric-value--secondary">
            {streak}
            <svg className="metric-streak-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.5 9.5 10 13 10 13s-4 0-4 5c0 3 3 4 6 4s6-1 6-4c0-7-6-16-6-16z" fill="#ff9f0a" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
