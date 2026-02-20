// API client for communicating with the backend
import type { Market, MatchResponse, Position, GetInsightResponse, Insight, RecordViewRequest, RecordViewResponse, PortfolioAnalysisRequest, PortfolioAnalysisResponse, AutoExitConfig, AutoSyncRequest, AutoSyncResponse, PendingExit, CheckApprovalRequest, CheckApprovalResponse, SwapQuoteRequest, SwapQuoteResponse, SwapOrderRequest, SwapOrderResponse, SentimentSwapRequest, SentimentSwapResponse } from '@taurus/types';

const API_BASE_URL = 'http://localhost:3000';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Health check
  health: () => request<{ status: string }>('/health'),

  // Markets
  markets: {
    list: (params?: { limit?: number; active?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set('limit', String(params.limit));
      if (params?.active !== undefined) qs.set('active', String(params.active));
      const query = qs.toString();
      return request<Market[]>(`/api/markets${query ? '?' + query : ''}`);
    },
    get: (id: string) => request<Market>(`/api/markets/${id}`),
    midpoint: (tokenId: string) => request<{ mid: string }>(`/api/markets/${tokenId}/price`),
    priceHistory: (tokenId: string, interval = '1d', fidelity = 60) =>
      request<{ history: { t: number; p: number }[] }>(
        `/api/markets/${tokenId}/history?interval=${interval}&fidelity=${fidelity}`
      ),
    match: (tweetText: string) =>
      request<MatchResponse>('/api/markets/match', { method: 'POST', body: { tweetText } }),
  },

  // Positions
  positions: {
    list: (address: string) => request<Position[]>(`/api/positions?address=${encodeURIComponent(address)}`),
  },

  // Trades
  trades: {
    submit: (trade: unknown) => request<{ success: boolean; data?: unknown; error?: string }>('/api/trades', { method: 'POST', body: trade }),
  },

  // Tweets
  tweets: {
    recordView: (body: RecordViewRequest) =>
      request<RecordViewResponse>('/api/tweets/view', { method: 'POST', body }),
  },

  // Insights
  insights: {
    get: (marketId: string, installId: string) =>
      request<GetInsightResponse>(`/api/insights/${marketId}?installId=${encodeURIComponent(installId)}`),
    getAll: (installId: string) =>
      request<{ insights: Insight[] }>(`/api/insights?installId=${encodeURIComponent(installId)}`),
    analyzePortfolio: (body: PortfolioAnalysisRequest) =>
      request<PortfolioAnalysisResponse>('/api/insights/portfolio', { method: 'POST', body }),
  },

  // Swap (Uniswap)
  swap: {
    checkApproval: (body: CheckApprovalRequest) =>
      request<CheckApprovalResponse>('/api/swap/check-approval', { method: 'POST', body }),
    quote: (body: SwapQuoteRequest) =>
      request<SwapQuoteResponse>('/api/swap/quote', { method: 'POST', body }),
    order: (body: SwapOrderRequest) =>
      request<SwapOrderResponse>('/api/swap/order', { method: 'POST', body }),
    sentimentSwap: (body: SentimentSwapRequest) =>
      request<SentimentSwapResponse>('/api/swap/sentiment', { method: 'POST', body }),
  },

  // Automation
  automation: {
    sync: (body: AutoSyncRequest) =>
      request<AutoSyncResponse>('/api/automation/sync', { method: 'POST', body }),
    updateConfig: (installId: string, config: AutoExitConfig) =>
      request<{ success: boolean }>('/api/automation/config', { method: 'PUT', body: { installId, config } }),
    getPending: (installId: string) =>
      request<{ pendingExits: PendingExit[] }>(`/api/automation/pending?installId=${encodeURIComponent(installId)}`),
    dismiss: (installId: string, positionId: string) =>
      request<{ success: boolean }>('/api/automation/dismiss', { method: 'POST', body: { installId, positionId } }),
    testExit: (body: {
      installId: string;
      positionId: string;
      overrides: { currentPrice?: number; pnlPercent?: number };
      persist?: boolean;
    }) =>
      request<{
        triggered: boolean;
        triggeredRule?: unknown;
        testPosition?: unknown;
        aiResult?: { confirm: boolean; reasoning: string; confidence: number };
        pendingExit?: PendingExit;
        persisted?: boolean;
        message?: string;
        rules?: unknown;
      }>('/api/automation/test-exit', { method: 'POST', body }),
  },
};
