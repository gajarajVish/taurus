import { config } from '../../config/index.js';

// Raw shape returned by GET /markets from the Gamma API.
// NOTE: outcomes, outcomePrices, and clobTokenIds come back as JSON-encoded
// strings (e.g. '["Yes","No"]'), NOT actual arrays. normalizeMarket() parses them.
export interface GammaMarket {
  id: string;
  conditionId: string;
  question: string;
  outcomePrices: string | undefined;  // JSON-encoded string e.g. '["0.65","0.35"]' — absent on some markets
  outcomes: string;                    // JSON-encoded string e.g. '["Yes","No"]'
  clobTokenIds: string | undefined;    // JSON-encoded string e.g. '["123...","456..."]' — absent on some markets
  volume: string;
  liquidity: string;
  endDateIso: string;
  active: boolean;
  closed: boolean;
  slug: string;
}

async function gammaFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, config.polymarket.gammaBaseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Gamma API error ${response.status} for ${url.pathname}: ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchMarketsRaw(params: {
  limit?: number;
  offset?: number;
  active?: boolean;
}): Promise<GammaMarket[]> {
  const queryParams: Record<string, string> = {
    order: 'volume',
    ascending: 'false',
  };
  if (params.limit !== undefined) queryParams['limit'] = String(params.limit);
  if (params.offset !== undefined) queryParams['offset'] = String(params.offset);
  if (params.active !== undefined) {
    queryParams['active'] = String(params.active);
    // closed=false is required alongside active=true to exclude resolved markets
    if (params.active) queryParams['closed'] = 'false';
  }

  return gammaFetch<GammaMarket[]>('/markets', queryParams);
}

// Fetches ALL active markets via parallel-batch pagination.
// Gamma's max page size is 500. Pages are fetched BATCH_SIZE at a time
// concurrently; stops when any page returns fewer than PAGE_SIZE results.
export async function fetchAllMarketsRaw(): Promise<GammaMarket[]> {
  const PAGE_SIZE = 500;
  const BATCH_SIZE = 10; // concurrent requests per round

  const all: GammaMarket[] = [];
  let offset = 0;

  while (true) {
    const offsets = Array.from({ length: BATCH_SIZE }, (_, i) => offset + i * PAGE_SIZE);
    const pages = await Promise.all(
      offsets.map((o) => fetchMarketsRaw({ limit: PAGE_SIZE, offset: o, active: true }))
    );

    let done = false;
    for (const page of pages) {
      all.push(...page);
      if (page.length < PAGE_SIZE) {
        done = true;
        break;
      }
    }

    if (done) break;
    offset += BATCH_SIZE * PAGE_SIZE;
  }

  return all;
}

// Gamma wraps single-ID lookups in an array — caller handles the [0] indexing
export async function fetchMarketRaw(conditionId: string): Promise<GammaMarket[]> {
  return gammaFetch<GammaMarket[]>('/markets', { conditionId });
}
