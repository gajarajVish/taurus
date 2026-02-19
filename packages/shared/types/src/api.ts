// API request/response types

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ── Match endpoint ───────────────────────────────────────────────────────────
import type { Market } from './markets.js';

export interface MatchResponse {
  match: Market | null;
}
