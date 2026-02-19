import type { Insight } from '@taurus/types';
import * as viewStore from '../session/views.js';
import { analyzeTweets } from '../og/inference.js';
import { getMarket } from '../polymarket/markets.js';

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

  if (getCachedInsight(installId, marketId)) return false;

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
    viewStore.clearMarketViews(installId, marketId);

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

setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of insightCacheWithMeta.entries()) {
    if (now - cached.cachedAt > INSIGHT_CACHE_TTL_MS) {
      insightCacheWithMeta.delete(key);
    }
  }
}, INSIGHT_CACHE_TTL_MS / 2);
