import React from 'react';
import { PositionItem } from './PositionItem';
import type { DisplayPosition } from '../Sidecar';

interface PositionsCardProps {
  positions: DisplayPosition[];
  onExitPosition?: (position: DisplayPosition) => void;
}

export function PositionsCard({ positions, onExitPosition }: PositionsCardProps) {
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
              outcomeId={position.outcomeId}
              onExit={onExitPosition ? () => onExitPosition(position) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
