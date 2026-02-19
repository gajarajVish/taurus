// Trade-related types

export interface TradeRequest {
  marketId: string;
  outcomeId: string;
  side: 'buy' | 'sell';
  amount: string;
  price?: number;
}

export interface TradeResponse {
  id: string;
  status: TradeStatus;
  marketId: string;
  outcomeId: string;
  side: 'buy' | 'sell';
  amount: string;
  price: number;
  timestamp: string;
  txHash?: string;
}

export type TradeStatus = 'pending' | 'confirmed' | 'failed';
