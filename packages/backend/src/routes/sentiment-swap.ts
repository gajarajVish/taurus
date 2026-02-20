import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { analyzeSwapSentiment } from '../services/og/inference.js';

const sentimentSwapSchema = z.object({
  tweetText: z.string().min(1),
  walletAddress: z.string(),
});

export const sentimentSwapPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/swap/sentiment', async (request, reply) => {
    const parseResult = sentimentSwapSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid sentiment swap payload',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const recommendation = await analyzeSwapSentiment(parseResult.data.tweetText);
      return reply.send({ recommendation });
    } catch (err) {
      fastify.log.error(err, 'Failed to analyze swap sentiment');
      return reply.status(500).send({ error: 'Sentiment analysis failed' });
    }
  });
};
