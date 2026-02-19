// AI Insights API
// Provides access to generated insights for users

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { GetInsightResponse, Insight, AIInsightsSettings } from '@taurus/types';
import { getCachedInsight, getAllInsights, getAggregatorStats } from '../services/insights/aggregator.js';
import { getSettings, updateSettings } from '../services/session/views.js';

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

    const insight = getCachedInsight(installId, marketId);

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
    const insights = getAllInsights(installId);

    return { insights };
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

  // GET /api/insights/stats - Get aggregator stats (for debugging)
  server.get('/api/insights/stats', async () => {
    return getAggregatorStats();
  });
};
