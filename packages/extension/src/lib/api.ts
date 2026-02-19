// API client for communicating with the backend
import type { Market, MatchResponse, Position, GetInsightResponse, Insight, RecordViewRequest, RecordViewResponse, PortfolioAnalysisRequest, PortfolioAnalysisResponse } from '@taurus/types';

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
};
