// Tweet view recording API
// Records tweet views and triggers AI analysis when threshold is met

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { RecordViewRequest, RecordViewResponse } from '@taurus/types';
import * as viewStore from '../services/session/views.js';
import { shouldTriggerAnalysis, triggerAnalysis } from '../services/insights/aggregator.js';

const RecordViewSchema = z.object({
  installId: z.string().min(1),
  tweetId: z.string().min(1),
  tweetText: z.string().min(1),
  marketId: z.string().min(1),
});

export const tweetsPlugin: FastifyPluginAsync = async (server) => {
  // POST /api/tweets/view - Record a tweet view
  server.post<{
    Body: RecordViewRequest;
    Reply: RecordViewResponse;
  }>('/api/tweets/view', async (request, reply) => {
    // Validate request body
    const parseResult = RecordViewSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        recorded: false,
        insightReady: false,
      });
    }

    const { installId, tweetId, tweetText, marketId } = parseResult.data;

    // Record the view
    const { viewCount, thresholdMet } = viewStore.recordView(
      installId,
      tweetId,
      tweetText,
      marketId
    );

    let insightReady = false;

    // Check if we should trigger analysis
    if (thresholdMet && shouldTriggerAnalysis(installId, marketId)) {
      // Trigger analysis asynchronously (don't block the response)
      triggerAnalysis(installId, marketId)
        .then((insight) => {
          if (insight) {
            console.log(`[Tweets API] Insight generated for ${installId}:${marketId}`);
          }
        })
        .catch((err) => {
          console.error(`[Tweets API] Analysis error:`, (err as Error).message);
        });

      // Insight will be ready soon (analysis is in progress)
      insightReady = false;
    }

    return {
      recorded: true,
      insightReady,
    };
  });

  // GET /api/tweets/stats - Get session stats (for debugging)
  server.get('/api/tweets/stats', async () => {
    return viewStore.getSessionStats();
  });
};
