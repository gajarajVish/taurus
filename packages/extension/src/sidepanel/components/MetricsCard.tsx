import React from 'react';
import { Sparkline } from './Sparkline';

interface MetricsCardProps {
  pnl: number;
  volume: number;
  streak: number;
}

export function MetricsCard({ pnl, volume, streak }: MetricsCardProps) {
  const pnlClass = pnl >= 0 ? 'positive' : 'negative';
  const pnlSign = pnl >= 0 ? '+' : '';
  
  // Fake sparkline data
  const data = [10, 15, 13, 20, 18, 25, 22, 30, 28, 35, 40, 38, 45];

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
      
      <div style={{ height: '1px', backgroundColor: '#2f3336', margin: '4px 0' }}></div>

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
