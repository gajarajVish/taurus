// Market-related types

export interface Market {
  id: string;           // conditionId — primary key used throughout
  conditionId: string;  // explicit duplicate for clarity at call sites
  question: string;
  slug: string;
  yesPrice: string;     // decimal string e.g. "0.65" (65% probability)
  noPrice: string;      // decimal string e.g. "0.35"
  yesTokenId: string;   // CLOB token ID for YES outcome (for trading)
  noTokenId: string;    // CLOB token ID for NO outcome (for trading)
  volume: string;       // USD total volume as string (avoids float precision loss)
  liquidity: string;    // USD liquidity available
  endDate: string;      // ISO-8601 string
  status: MarketStatus;
}

export type MarketStatus = 'open' | 'closed' | 'resolved';

export interface MarketListRequest {
  limit?: number;
  active?: boolean;
}
