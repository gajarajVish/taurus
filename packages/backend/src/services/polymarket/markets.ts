import { config } from '../../config/index.js';
import { fetchMarketsRaw, fetchAllMarketsRaw, fetchMarketRaw, type GammaMarket } from './client.js';
import type { Market, MarketStatus } from '@polyoverlay/types';

// ── Normalizer ─────────────────────────────────────────────────────────────

function deriveStatus(raw: { active: boolean; closed: boolean }): MarketStatus {
  if (raw.closed) return 'closed';
  if (!raw.active) return 'resolved';
  return 'open';
}

function normalizeMarket(raw: GammaMarket): Market {
  // Gamma returns these as JSON-encoded strings; outcomePrices/clobTokenIds can be
  // absent on some markets (undefined → JSON.parse would throw). Guard with nullish fallback.
  const outcomes: string[] = JSON.parse(raw.outcomes);
  const outcomePrices: string[] = raw.outcomePrices ? JSON.parse(raw.outcomePrices) : ['0.5', '0.5'];
  const clobTokenIds: string[] = raw.clobTokenIds ? JSON.parse(raw.clobTokenIds) : ['', ''];

  // Index-aligned — don't assume Yes is always [0]
  const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === 'yes');
  const noIndex = outcomes.findIndex((o) => o.toLowerCase() === 'no');

  return {
    id: raw.conditionId,
    conditionId: raw.conditionId,
    question: raw.question,
    slug: raw.slug,
    yesPrice: yesIndex >= 0 ? (outcomePrices[yesIndex] ?? '0.5') : '0.5',
    noPrice: noIndex >= 0 ? (outcomePrices[noIndex] ?? '0.5') : '0.5',
    yesTokenId: yesIndex >= 0 ? (clobTokenIds[yesIndex] ?? '') : '',
    noTokenId: noIndex >= 0 ? (clobTokenIds[noIndex] ?? '') : '',
    volume: raw.volume,
    liquidity: raw.liquidity,
    endDate: raw.endDateIso,
    status: deriveStatus(raw),
  };
}

// ── In-memory TTL cache ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + config.cache.marketsTtl });
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface FetchMarketsOptions {
  limit?: number;
  active?: boolean;
}

export async function fetchMarkets(options: FetchMarketsOptions = {}): Promise<Market[]> {
  const limit = options.limit ?? 50;
  const active = options.active ?? true;
  const cacheKey = `markets:list:${limit}:${active}`;

  const cached = getCached<Market[]>(cacheKey);
  if (cached) return cached;

  const raw = await fetchMarketsRaw({ limit, active });
  const normalized = raw.map(normalizeMarket);

  setCached(cacheKey, normalized);
  return normalized;
}

// Fetches ALL active markets via paginated requests (parallel batches of 500).
// Uses a dedicated cache key with 15-minute TTL — longer than the top-N cache
// because the full crawl is expensive (~multiple API round-trips).
export async function fetchAllMarkets(): Promise<Market[]> {
  const cacheKey = 'markets:all';

  const cached = getCached<Market[]>(cacheKey);
  if (cached) return cached;

  const raw = await fetchAllMarketsRaw();
  const normalized = raw.map(normalizeMarket);

  // 15-minute TTL for the full-market cache (3× default)
  cache.set(cacheKey, { data: normalized, expiresAt: Date.now() + config.cache.marketsTtl * 3 });
  return normalized;
}

export async function fetchMarket(conditionId: string): Promise<Market | null> {
  const cacheKey = `markets:single:${conditionId}`;

  const cached = getCached<Market>(cacheKey);
  if (cached) return cached;

  // Search within the full market list (Gamma's ?conditionId= filter is unreliable)
  const allMarkets = await fetchAllMarkets();
  const found = allMarkets.find((m) => m.conditionId === conditionId) ?? null;

  if (found) setCached(cacheKey, found);
  return found;
}
