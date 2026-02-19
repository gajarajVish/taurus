import React from 'react';
import type { PendingExit } from '@taurus/types';

const RULE_LABELS: Record<string, string> = {
  pnl_gain: 'Take Profit',
  pnl_loss: 'Stop Loss',
  risk_score: 'Risk',
  price_target: 'Target',
};

interface Props {
  exits: PendingExit[];
  onConfirm: (exit: PendingExit) => void;
  onDismiss: (positionId: string) => void;
}

export function PendingExitBanner({ exits, onConfirm, onDismiss }: Props) {
  if (exits.length === 0) return null;

  return (
    <div className="pe-banner">
      <div className="pe-header">
        <svg className="pe-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span className="pe-label">Exit Signals</span>
        <span className="pe-count">{exits.length} pending</span>
      </div>

      {exits.map((exit) => (
        <div key={exit.positionId} className="pe-item">
          <div className="pe-item-question">{exit.marketQuestion}</div>
          <div className="pe-item-reason">{exit.aiReasoning}</div>
          <div className="pe-item-meta">
            <span className="pe-confidence">
              {Math.round(exit.aiConfidence * 100)}% confidence
            </span>
            <span className="pe-rule-type">
              {RULE_LABELS[exit.triggeredRule.type] ?? exit.triggeredRule.type}
            </span>
          </div>
          <div className="pe-actions">
            <button className="pe-confirm-btn" onClick={() => onConfirm(exit)}>
              Confirm Exit
            </button>
            <button className="pe-dismiss-btn" onClick={() => onDismiss(exit.positionId)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
