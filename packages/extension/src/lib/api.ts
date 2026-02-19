// API client for communicating with the backend
import type {
  Market,
  MatchResponse,
  RecordViewRequest,
  RecordViewResponse,
  GetInsightResponse,
  Insight,
  AIInsightsSettings,
} from '@taurus/types';

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
    list: () => request<unknown[]>('/api/positions'),
  },

  // Trades
  trades: {
    submit: (trade: unknown) => request<unknown>('/api/trades', { method: 'POST', body: trade }),
  },

  // Tweet view recording (for AI analysis)
  tweets: {
    recordView: (data: RecordViewRequest) =>
      request<RecordViewResponse>('/api/tweets/view', { method: 'POST', body: data }),
  },

  // AI Insights
  insights: {
    get: (marketId: string, installId: string) =>
      request<GetInsightResponse>(`/api/insights/${marketId}?installId=${encodeURIComponent(installId)}`),
    getAll: (installId: string) =>
      request<{ insights: Insight[] }>(`/api/insights?installId=${encodeURIComponent(installId)}`),
    getSettings: (installId: string) =>
      request<AIInsightsSettings>(`/api/insights/settings?installId=${encodeURIComponent(installId)}`),
    updateSettings: (installId: string, settings: Partial<AIInsightsSettings>) =>
      request<AIInsightsSettings>('/api/insights/settings', {
        method: 'PUT',
        body: { installId, settings },
      }),
  },
};
