// AI Insight types for 0G integration

export type SentimentType = 'bullish' | 'bearish' | 'neutral';

export interface Insight {
  marketId: string;
  summary: string;
  sentiment: SentimentType;
  score: number;              // 0-1 confidence score
  consensusShift: number;     // estimated probability shift (-1 to 1)
  tweetCount: number;
  riskFlags: string[];
  opportunityScore: number;   // 0-1 opportunity rating
  timestamp: string;          // ISO-8601
}

export interface RecordViewRequest {
  installId: string;
  tweetId: string;
  tweetText: string;
  marketId: string;
}

export interface RecordViewResponse {
  recorded: boolean;
  insightReady: boolean;      // true if aggregation threshold was met and insight is available
}

export interface GetInsightResponse {
  insight: Insight | null;
}

// Settings stored per-user for AI insights
export interface AIInsightsSettings {
  enabled: boolean;
  minTweetCount: number;      // threshold before triggering analysis (default: 3)
  minSentimentScore: number;  // minimum confidence score to show (default: 0.6)
}

export const DEFAULT_AI_SETTINGS: AIInsightsSettings = {
  enabled: true,
  minTweetCount: 3,
  minSentimentScore: 0.6,
};
