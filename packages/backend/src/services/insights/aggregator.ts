import type { Insight } from '@taurus/types';
import * as viewStore from '../session/views.js';
import { analyzeTweets, isOGAvailable } from '../og/inference.js';
import { getMarket, fetchMarkets } from '../polymarket/markets.js';

const INSIGHT_CACHE_TTL_MS = 60 * 60 * 1000;

const pendingAnalysis = new Set<string>();

interface InsightWithMeta {
  insight: Insight;
  cachedAt: number;
}

const insightCacheWithMeta = new Map<string, InsightWithMeta>();

function getCacheKey(installId: string, marketId: string): string {
  return `${installId}:${marketId}`;
}

export function getCachedInsight(installId: string, marketId: string): Insight | null {
  const key = getCacheKey(installId, marketId);
  const cached = insightCacheWithMeta.get(key);

  if (!cached) return null;
  if (Date.now() - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
    insightCacheWithMeta.delete(key);
    return null;
  }

  return cached.insight;
}

function cacheInsight(installId: string, marketId: string, insight: Insight): void {
  const key = getCacheKey(installId, marketId);
  insightCacheWithMeta.set(key, { insight, cachedAt: Date.now() });
}

export function shouldTriggerAnalysis(installId: string, marketId: string): boolean {
  const settings = viewStore.getSettings(installId);
  if (!settings.enabled) return false;

  const viewCount = viewStore.getViewCount(installId, marketId);
  if (viewCount < settings.minTweetCount) return false;

  const key = getCacheKey(installId, marketId);
  if (pendingAnalysis.has(key)) return false;

  return true;
}

export async function triggerAnalysis(
  installId: string,
  marketId: string
): Promise<Insight | null> {
  const key = getCacheKey(installId, marketId);

  if (!shouldTriggerAnalysis(installId, marketId)) {
    return getCachedInsight(installId, marketId);
  }

  pendingAnalysis.add(key);

  try {
    const tweets = viewStore.getTweetTexts(installId, marketId);
    if (tweets.length === 0) {
      console.warn(`[Aggregator] No tweets found for ${key}`);
      return null;
    }

    const market = await getMarket(marketId);
    if (!market) {
      console.warn(`[Aggregator] Market not found: ${marketId}`);
      return null;
    }

    console.log(`[Aggregator] Starting analysis for ${key} with ${tweets.length} tweets`);

    const result = await analyzeTweets(tweets, market);

    const insight: Insight = {
      marketId,
      summary: result.explainableSummary,
      sentiment: result.sentiment,
      score: result.score,
      consensusShift: result.consensusShift,
      tweetCount: tweets.length,
      riskFlags: result.riskFlags,
      opportunityScore: result.opportunityScore,
      timestamp: new Date().toISOString(),
    };

    cacheInsight(installId, marketId, insight);

    console.log(`[Aggregator] ✓ ${result.source} analysis complete: ${insight.sentiment} (score: ${insight.score})`);

    return insight;
  } catch (err) {
    console.error(`[Aggregator] Analysis failed for ${key}:`, (err as Error).message);
    return null;
  } finally {
    pendingAnalysis.delete(key);
  }
}

export function getAllInsights(installId: string): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();

  for (const [key, cached] of insightCacheWithMeta.entries()) {
    if (!key.startsWith(`${installId}:`)) continue;
    if (now - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
      insightCacheWithMeta.delete(key);
      continue;
    }
    insights.push(cached.insight);
  }

  return insights.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getAggregatorStats(): {
  cachedInsights: number;
  pendingAnalyses: number;
} {
  return {
    cachedInsights: insightCacheWithMeta.size,
    pendingAnalyses: pendingAnalysis.size,
  };
}

// Global insight cache (not user-scoped) for proactive market scans
const globalInsightCache = new Map<string, InsightWithMeta>();

export function getGlobalInsight(marketId: string): Insight | null {
  const cached = globalInsightCache.get(marketId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
    globalInsightCache.delete(marketId);
    return null;
  }
  return cached.insight;
}

export function getAllGlobalInsights(): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();
  for (const [key, cached] of globalInsightCache.entries()) {
    if (now - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
      globalInsightCache.delete(key);
      continue;
    }
    insights.push(cached.insight);
  }
  return insights.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

const SCAN_MARKET_COUNT = 10;
const SCAN_INTERVAL_MS = 15 * 60 * 1000;
let scanRunning = false;

export async function scanTopMarkets(): Promise<number> {
  if (scanRunning) return 0;
  scanRunning = true;

  try {
    const available = await isOGAvailable();
    if (!available) {
      console.log('[Scanner] 0G not available, skipping market scan');
      return 0;
    }

    const markets = await fetchMarkets({ limit: SCAN_MARKET_COUNT, active: true });
    let generated = 0;

    for (const market of markets) {
      const existing = globalInsightCache.get(market.id);
      if (existing && Date.now() - existing.cachedAt < SCAN_INTERVAL_MS) continue;

      try {
        const syntheticTweet = `Market: "${market.question}" — Current YES price: ${market.yesPrice}, volume: ${market.volume}`;
        const result = await analyzeTweets([syntheticTweet], market);

        const insight: Insight = {
          marketId: market.id,
          summary: result.explainableSummary,
          sentiment: result.sentiment,
          score: result.score,
          consensusShift: result.consensusShift,
          tweetCount: 0,
          riskFlags: result.riskFlags,
          opportunityScore: result.opportunityScore,
          timestamp: new Date().toISOString(),
        };

        globalInsightCache.set(market.id, { insight, cachedAt: Date.now() });
        generated++;
        console.log(`[Scanner] ✓ ${market.question.slice(0, 60)}... → ${insight.sentiment}`);
      } catch (err) {
        console.warn(`[Scanner] Failed for ${market.id}:`, (err as Error).message);
      }
    }

    console.log(`[Scanner] Scan complete: ${generated}/${markets.length} insights generated`);
    return generated;
  } catch (err) {
    console.error('[Scanner] Scan failed:', (err as Error).message);
    return 0;
  } finally {
    scanRunning = false;
  }
}

export function startPeriodicScan(): void {
  setTimeout(() => {
    scanTopMarkets().catch(() => {});
  }, 5000);

  setInterval(() => {
    scanTopMarkets().catch(() => {});
  }, SCAN_INTERVAL_MS);

  console.log('[Scanner] Periodic market scan enabled (every 15m)');
}

// Cleanup expired insights periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of insightCacheWithMeta.entries()) {
    if (now - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
      insightCacheWithMeta.delete(key);
    }
  }
  for (const [key, cached] of globalInsightCache.entries()) {
    if (now - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
      globalInsightCache.delete(key);
    }
  }
}, INSIGHT_CACHE_TTL_MS / 2);
