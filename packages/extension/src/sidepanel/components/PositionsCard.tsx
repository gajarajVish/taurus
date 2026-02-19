import React from 'react';
import { PositionItem } from './PositionItem';
import { Accordion } from './Accordion';

interface Position {
  id: string;
  marketQuestion: string;
  side: 'yes' | 'no';
  size: string;
  pnlPercent: number;
}

interface PositionsCardProps {
  positions: Position[];
}

export function PositionsCard({ positions }: PositionsCardProps) {
  // If we wanted to use the Accordion component, we could wrap each item.
  // For now, let's stick to the list view as it's more dashboard-like, 
  // but we can use the sleek styling we defined.

  return (
    <div className="positions-card">
      <div className="section-title">
        Open Positions
        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
          {positions.length} active
        </span>
      </div>
      <div className="positions-list">
        {positions.length === 0 ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '12.5px', textAlign: 'center', padding: '20px' }}>
            No open positions
          </div>
        ) : (
          positions.map((position) => (
            <PositionItem
              key={position.id}
              marketQuestion={position.marketQuestion}
              side={position.side}
              size={position.size}
              pnlPercent={position.pnlPercent}
            />
          ))
        )}
      </div>
    </div>
  );
}
