// Session store for tracking tweet views per user/market
// Used to aggregate tweets before triggering AI analysis

import type { AIInsightsSettings } from '@taurus/types';

interface TweetView {
  tweetId: string;
  tweetText: string;
  timestamp: number;
}

interface MarketSession {
  tweetViews: TweetView[];
  lastActivity: number;
}

interface UserSession {
  markets: Map<string, MarketSession>;
  settings: AIInsightsSettings;
  lastActivity: number;
}

// In-memory session store (keyed by installId)
const sessions = new Map<string, UserSession>();

// Session TTL: 24 hours
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Cleanup interval: every hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Default settings
const defaultSettings: AIInsightsSettings = {
  enabled: true,
  minTweetCount: 1,
  minSentimentScore: 0.4,
};

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(userId);
      console.log(`[Session] Expired session for user: ${userId}`);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Get or create a user session
function getOrCreateSession(installId: string): UserSession {
  let session = sessions.get(installId);

  if (!session) {
    session = {
      markets: new Map(),
      settings: { ...defaultSettings },
      lastActivity: Date.now(),
    };
    sessions.set(installId, session);
  }

  return session;
}

// Get or create a market session within a user session
function getOrCreateMarketSession(userSession: UserSession, marketId: string): MarketSession {
  let marketSession = userSession.markets.get(marketId);

  if (!marketSession) {
    marketSession = {
      tweetViews: [],
      lastActivity: Date.now(),
    };
    userSession.markets.set(marketId, marketSession);
  }

  return marketSession;
}

// Record a tweet view for a user/market
export function recordView(
  installId: string,
  tweetId: string,
  tweetText: string,
  marketId: string
): { viewCount: number; thresholdMet: boolean } {
  const userSession = getOrCreateSession(installId);
  const marketSession = getOrCreateMarketSession(userSession, marketId);

  // Check if this tweet was already recorded (avoid duplicates)
  const existingView = marketSession.tweetViews.find((v) => v.tweetId === tweetId);
  if (existingView) {
    return {
      viewCount: marketSession.tweetViews.length,
      thresholdMet: marketSession.tweetViews.length >= userSession.settings.minTweetCount,
    };
  }

  // Add the new view
  marketSession.tweetViews.push({
    tweetId,
    tweetText,
    timestamp: Date.now(),
  });

  // Update activity timestamps
  marketSession.lastActivity = Date.now();
  userSession.lastActivity = Date.now();

  const viewCount = marketSession.tweetViews.length;
  const thresholdMet = viewCount >= userSession.settings.minTweetCount;

  console.log(
    `[Session] Recorded view for user ${installId}, market ${marketId}: ` +
    `${viewCount}/${userSession.settings.minTweetCount} tweets`
  );

  return { viewCount, thresholdMet };
}

// Get tweet texts for a user/market (for analysis)
export function getTweetTexts(installId: string, marketId: string): string[] {
  const userSession = sessions.get(installId);
  if (!userSession) return [];

  const marketSession = userSession.markets.get(marketId);
  if (!marketSession) return [];

  // Sort by timestamp (newest first) and return texts
  return marketSession.tweetViews
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((v) => v.tweetText);
}

// Get all market IDs with pending views for a user
export function getMarketsWithViews(installId: string): string[] {
  const userSession = sessions.get(installId);
  if (!userSession) return [];

  return Array.from(userSession.markets.keys());
}

// Get view count for a specific market
export function getViewCount(installId: string, marketId: string): number {
  const userSession = sessions.get(installId);
  if (!userSession) return 0;

  const marketSession = userSession.markets.get(marketId);
  if (!marketSession) return 0;

  return marketSession.tweetViews.length;
}

// Clear views for a market (after analysis is complete)
export function clearMarketViews(installId: string, marketId: string): void {
  const userSession = sessions.get(installId);
  if (!userSession) return;

  userSession.markets.delete(marketId);
  console.log(`[Session] Cleared views for user ${installId}, market ${marketId}`);
}

// Update user settings
export function updateSettings(
  installId: string,
  settings: Partial<AIInsightsSettings>
): AIInsightsSettings {
  const userSession = getOrCreateSession(installId);
  userSession.settings = { ...userSession.settings, ...settings };
  userSession.lastActivity = Date.now();

  return userSession.settings;
}

// Get user settings
export function getSettings(installId: string): AIInsightsSettings {
  const userSession = sessions.get(installId);
  return userSession?.settings ?? { ...defaultSettings };
}

// Get session stats (for debugging/monitoring)
export function getSessionStats(): {
  totalUsers: number;
  totalMarkets: number;
  totalViews: number;
} {
  let totalMarkets = 0;
  let totalViews = 0;

  for (const session of sessions.values()) {
    totalMarkets += session.markets.size;
    for (const marketSession of session.markets.values()) {
      totalViews += marketSession.tweetViews.length;
    }
  }

  return {
    totalUsers: sessions.size,
    totalMarkets,
    totalViews,
  };
}
