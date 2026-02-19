// Position-related types

export interface Position {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcomeId: string;
  outcomeName: string;
  shares: string;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface PositionSummary {
  totalValue: string;
  totalPnl: number;
  totalPnlPercent: number;
  positionCount: number;
}
