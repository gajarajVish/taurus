// AI Insights API
// Provides access to generated insights for users

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { GetInsightResponse, Insight, AIInsightsSettings, PortfolioAnalysisRequest, PortfolioAnalysisResponse } from '@taurus/types';
import { getCachedInsight, getAllInsights, getAggregatorStats, getGlobalInsight, getAllGlobalInsights } from '../services/insights/aggregator.js';
import { getSettings, updateSettings } from '../services/session/views.js';
import { analyzePortfolio } from '../services/og/inference.js';

const GetInsightParamsSchema = z.object({
  marketId: z.string().min(1),
});

const GetInsightQuerySchema = z.object({
  installId: z.string().min(1),
});

const UpdateSettingsSchema = z.object({
  installId: z.string().min(1),
  settings: z.object({
    enabled: z.boolean().optional(),
    minTweetCount: z.number().int().min(1).max(20).optional(),
    minSentimentScore: z.number().min(0).max(1).optional(),
  }),
});

export const insightsPlugin: FastifyPluginAsync = async (server) => {
  // GET /api/insights/:marketId - Get insight for a specific market
  server.get<{
    Params: { marketId: string };
    Querystring: { installId: string };
    Reply: GetInsightResponse;
  }>('/api/insights/:marketId', async (request, reply) => {
    // Validate params
    const paramsResult = GetInsightParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({ insight: null });
    }

    // Validate query
    const queryResult = GetInsightQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({ insight: null });
    }

    const { marketId } = paramsResult.data;
    const { installId } = queryResult.data;

    const insight = getCachedInsight(installId, marketId) ?? getGlobalInsight(marketId);

    return { insight };
  });

  // GET /api/insights - Get all insights for a user
  server.get<{
    Querystring: { installId: string };
    Reply: { insights: Insight[] };
  }>('/api/insights', async (request, reply) => {
    const queryResult = GetInsightQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({ insights: [] });
    }

    const { installId } = queryResult.data;
    const userInsights = getAllInsights(installId);
    const globalInsights = getAllGlobalInsights();

    const seen = new Set(userInsights.map((i) => i.marketId));
    const merged = [
      ...userInsights,
      ...globalInsights.filter((i) => !seen.has(i.marketId)),
    ];

    return { insights: merged };
  });

  // GET /api/insights/settings - Get user's AI settings
  server.get<{
    Querystring: { installId: string };
    Reply: AIInsightsSettings;
  }>('/api/insights/settings', async (request, reply) => {
    const queryResult = GetInsightQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        enabled: true,
        minTweetCount: 3,
        minSentimentScore: 0.6,
      });
    }

    const { installId } = queryResult.data;
    return getSettings(installId);
  });

  // PUT /api/insights/settings - Update user's AI settings
  server.put<{
    Body: { installId: string; settings: Partial<AIInsightsSettings> };
    Reply: AIInsightsSettings;
  }>('/api/insights/settings', async (request, reply) => {
    const parseResult = UpdateSettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        enabled: true,
        minTweetCount: 3,
        minSentimentScore: 0.6,
      });
    }

    const { installId, settings } = parseResult.data;
    const updated = updateSettings(installId, settings);

    return updated;
  });

  // POST /api/insights/portfolio - Analyze portfolio for trends and hedging
  const InsightSchema = z.object({
    marketId: z.string(),
    summary: z.string(),
    sentiment: z.enum(['bullish', 'bearish', 'neutral']),
    score: z.number(),
    consensusShift: z.number(),
    tweetCount: z.number(),
    riskFlags: z.array(z.string()),
    opportunityScore: z.number(),
    timestamp: z.string(),
  });

  const PortfolioSchema = z.object({
    positions: z.array(z.object({
      marketQuestion: z.string(),
      side: z.enum(['yes', 'no']),
      size: z.number(),
      avgPrice: z.number(),
      currentPrice: z.number(),
      pnlPercent: z.number(),
    })).min(1),
    insights: z.array(InsightSchema).optional(),
  });

  server.post<{
    Body: PortfolioAnalysisRequest;
    Reply: PortfolioAnalysisResponse;
  }>('/api/insights/portfolio', async (request, reply) => {
    const parseResult = PortfolioSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ analysis: null });
    }

    try {
      const analysis = await analyzePortfolio(parseResult.data.positions, parseResult.data.insights ?? []);
      return { analysis };
    } catch (err) {
      server.log.error(err, 'Portfolio analysis failed');
      return reply.status(500).send({ analysis: null });
    }
  });

  // GET /api/insights/stats - Get aggregator stats (for debugging)
  server.get('/api/insights/stats', async () => {
    return getAggregatorStats();
  });
};
