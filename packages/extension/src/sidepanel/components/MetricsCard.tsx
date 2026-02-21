import React from 'react';
import { Sparkline } from './Sparkline';

interface MetricsCardProps {
  pnl: number;
  volume: number;
  streak: number;
  sparklineData?: number[];
}

export function MetricsCard({ pnl, volume, sparklineData }: MetricsCardProps) {
  const invested = volume;
  const current = volume + pnl;
  const isPositive = pnl >= 0;
  const pnlSign = isPositive ? '+' : '';
  const dir = isPositive ? 'up' : 'down';
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const roiBarWidth = invested > 0 ? Math.min(Math.abs(pnlPct), 100) : 0;

  const hasChart = sparklineData && sparklineData.length > 2 &&
    Math.max(...sparklineData) !== Math.min(...sparklineData);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="dash">
      <div className="dash-card">
        <div className={`dash-hero ${dir}`}>
          <span className="dash-hero-lbl">Portfolio Value</span>
          <span className="dash-hero-val">${fmt(current)}</span>

          <div className="dash-pnl-row">
            <span className={`dash-pnl-val ${dir}`}>
              {pnlSign}${fmt(Math.abs(pnl))}
            </span>
            {Math.abs(pnlPct) >= 0.1 && (
              <span className={`dash-pnl-badge ${dir}`}>
                {isPositive ? '\u2197' : '\u2198'} {pnlSign}{pnlPct.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="dash-roi-bar">
            <div className={`dash-roi-fill ${dir}`} style={{ width: `${roiBarWidth}%` }} />
          </div>

          {hasChart && (
            <div className="dash-hero-chart">
              <Sparkline data={sparklineData!} color={isPositive ? '#00F5A0' : '#FF4757'} filled />
            </div>
          )}
        </div>

        <div className="dash-details">
          <div className="dash-detail">
            <span className="dash-detail-lbl">Invested</span>
            <span className="dash-detail-val">${fmt(invested)}</span>
          </div>
          <div className="dash-detail">
            <span className="dash-detail-lbl">Current value</span>
            <span className="dash-detail-val">${fmt(current)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
