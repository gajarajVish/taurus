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
        <div style={{ paddingBottom: '5px' }}>
             <Sparkline data={data} width={80} height={25} color={pnl >= 0 ? '#00ba7c' : '#f91880'} />
        </div>
      </div>
      
      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />

      <div className="metrics-row">
        <div className="metric-item">
          <div className="metric-label">Volume</div>
          <div className="metric-value" style={{ fontSize: '16px' }}>${volume.toLocaleString()}</div>
        </div>
        <div className="metric-item" style={{ alignItems: 'flex-end' }}>
          <div className="metric-label">Streak</div>
          <div className="metric-value" style={{ fontSize: '16px' }}>{streak} 🔥</div>
        </div>
      </div>
    </div>
  );
}
