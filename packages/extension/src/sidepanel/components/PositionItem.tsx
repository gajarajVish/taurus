import React from 'react';
import { Badge } from './Badge';

interface PositionItemProps {
  marketQuestion: string;
  side: 'yes' | 'no';
  size: string;
  pnlPercent: number;
}

export function PositionItem({ marketQuestion, side, size, pnlPercent }: PositionItemProps) {
  const isPositive = pnlPercent >= 0;
  const pnlSign = isPositive ? '+' : '';
  const pnlColorClass = isPositive ? 'positive' : 'negative';

  return (
    <div className="position-item">
      <div className="position-header">
        <div className="position-question">{marketQuestion}</div>
        <Badge 
          label={side} 
          variant={side === 'yes' ? 'positive' : 'negative'} 
          size="sm" 
        />
      </div>
      
      <div className="position-meta">
        <div className="position-stats">
          <span>{size} invested</span>
        </div>
        <span className={`position-pnl ${pnlColorClass}`} style={{ fontWeight: 700 }}>
          {pnlSign}{pnlPercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
