import React from 'react';
import { PositionItem } from './PositionItem';
import type { DisplayPosition } from '../Sidecar';

interface PositionsCardProps {
  positions: DisplayPosition[];
  onExitPosition?: (position: DisplayPosition) => void;
}

export function PositionsCard({ positions, onExitPosition }: PositionsCardProps) {
  // Sort positions by absolute P&L impact (biggest movers first)
  const sorted = [...positions].sort((a, b) => Math.abs(b.pnlPercent) - Math.abs(a.pnlPercent));

  return (
    <div className="positions-card">
      <div className="section-header-row">
        <span className="section-title-text">Positions</span>
        {sorted.length > 0 && (
          <span className="section-title-count">{sorted.length}</span>
        )}
      </div>

      <div className="positions-list">
        {sorted.length === 0 ? (
          <div className="positions-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M9 12h6M12 9v6" />
            </svg>
            <span>No open positions yet</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Explore trending markets to start trading
            </span>
          </div>
        ) : (
          sorted.map((position) => (
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
