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
      <div className="section-header-row">
        <span className="section-title-text">Your positions</span>
        {positions.length > 0 && (
          <span className="section-title-count">{positions.length}</span>
        )}
      </div>

      <div className="positions-list">
        {positions.length === 0 ? (
          <div className="positions-empty">
            No open positions yet
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
