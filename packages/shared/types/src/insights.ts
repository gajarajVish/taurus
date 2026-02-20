// AI Insight types for 0G integration

export type SentimentType = 'bullish' | 'bearish' | 'neutral';

export interface SourceTweet {
  tweetId: string;
  text: string;
  timestamp: string;          // ISO-8601
}

export interface Insight {
  marketId: string;
  marketQuestion: string;
  summary: string;
  sentiment: SentimentType;
  score: number;              // 0-1 confidence score
  consensusShift: number;     // estimated probability shift (-1 to 1)
  tweetCount: number;
  sourceTweets?: SourceTweet[]; // tweets used to generate this insight (absent for global/synthetic insights)
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
  minTweetCount: 1,
  minSentimentScore: 0.4,
};

// Portfolio analysis types
export interface PortfolioPosition {
  marketQuestion: string;
  side: 'yes' | 'no';
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnlPercent: number;
}

export interface ActionableItem {
  text: string;
  positionIndices: number[]; // 0-based into the positions array
}

export interface PortfolioAnalysis {
  summary: string;
  overallRisk: 'low' | 'medium' | 'high';
  correlationWarnings: ActionableItem[];
  hedgingSuggestions: ActionableItem[];
  trends: string[];
  diversificationScore: number;   // 0-1
  riskExplanation: string;        // Why this risk level was assigned
  diversificationExplanation: string; // Why this diversification score was given
  timestamp: string;
}

export interface PortfolioAnalysisRequest {
  positions: PortfolioPosition[];
  insights?: Insight[];           // Cached tweet sentiment insights for context
}

export interface PortfolioAnalysisResponse {
  analysis: PortfolioAnalysis | null;
}

// ── Auto-Exit Automation ────────────────────────────────────────────────────

export interface AutoExitRule {
  id: string;
  type: 'pnl_gain' | 'pnl_loss' | 'risk_score' | 'price_target';
  threshold: number;
  action: 'exit_full' | 'exit_half';
  enabled: boolean;
}

export interface AutoExitConfig {
  enabled: boolean;
  rules: AutoExitRule[];
  requireConfirmation: boolean;
}

export const DEFAULT_AUTO_EXIT_CONFIG: AutoExitConfig = {
  enabled: false,
  rules: [
    { id: 'gain-20', type: 'pnl_gain', threshold: 0.20, action: 'exit_full', enabled: true },
    { id: 'loss-15', type: 'pnl_loss', threshold: -0.15, action: 'exit_half', enabled: true },
    { id: 'risk-high', type: 'risk_score', threshold: 0.85, action: 'exit_full', enabled: false },
  ],
  requireConfirmation: true,
};

export interface PendingExit {
  positionId: string;
  marketId: string;
  marketQuestion: string;
  tokenId: string;
  side: 'yes' | 'no';
  shares: string;
  currentPrice: number;
  triggeredRule: AutoExitRule;
  aiReasoning: string;
  aiConfidence: number;
  timestamp: string;
}

export interface AutoSyncRequest {
  installId: string;
  positions: Array<{
    id: string;
    marketId: string;
    marketQuestion: string;
    tokenId: string;
    side: 'yes' | 'no';
    shares: string;
    avgPrice: number;
    currentPrice: number;
    pnlPercent: number;
  }>;
  config: AutoExitConfig;
}

export interface AutoSyncResponse {
  pendingExits: PendingExit[];
}
