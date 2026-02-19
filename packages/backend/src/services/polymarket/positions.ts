import type { Position } from '@polyoverlay/types';
import { config } from '../../config/index.js';

const MOCK_POSITIONS: Position[] = [
  {
    id: 'mock-token-1',
    marketId: 'mock-condition-1',
    marketQuestion: 'Will the Fed cut rates in March 2026?',
    outcomeId: 'mock-token-1',
    outcomeName: 'Yes',
    shares: '50',
    avgPrice: 0.62,
    currentPrice: 0.71,
    pnl: 4.50,
    pnlPercent: 14.5,
  },
  {
    id: 'mock-token-2',
    marketId: 'mock-condition-2',
    marketQuestion: 'Will Bitcoin hit $150k before July 2026?',
    outcomeId: 'mock-token-2',
    outcomeName: 'No',
    shares: '30',
    avgPrice: 0.38,
    currentPrice: 0.34,
    pnl: -1.20,
    pnlPercent: -10.5,
  },
  {
    id: 'mock-token-3',
    marketId: 'mock-condition-3',
    marketQuestion: 'Will SpaceX reach Mars before 2030?',
    outcomeId: 'mock-token-3',
    outcomeName: 'Yes',
    shares: '100',
    avgPrice: 0.25,
    currentPrice: 0.28,
    pnl: 3.00,
    pnlPercent: 12.0,
  },
];

// Shape returned by the Polymarket Data API /positions endpoint
interface DataApiPosition {
  proxyWallet: string;
  asset: string;       // outcome token ID
  conditionId: string; // market condition ID
  size: string;        // shares held (decimal string, e.g. "10.5")
  avgPrice: number;
  curPrice: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  title: string;       // market question
  outcome: string;     // "Yes" or "No"
  outcomeIndex: number;
}

function mapToPosition(raw: DataApiPosition): Position {
  return {
    id: raw.asset,
    marketId: raw.conditionId,
    marketQuestion: raw.title,
    outcomeId: raw.asset,
    outcomeName: raw.outcome,
    shares: raw.size,
    avgPrice: raw.avgPrice,
    currentPrice: raw.curPrice,
    pnl: raw.cashPnl,
    pnlPercent: raw.percentPnl,
  };
}

export async function fetchPositions(address: string): Promise<Position[]> {
  if (config.mockPositions) return MOCK_POSITIONS;

  const url = new URL('/positions', 'https://data-api.polymarket.com');
  url.searchParams.set('user', address);
  url.searchParams.set('sizeThreshold', '0');
  url.searchParams.set('limit', '100');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Data API error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as DataApiPosition[];
  return data.map(mapToPosition);
}
