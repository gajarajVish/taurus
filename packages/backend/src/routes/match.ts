import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { fetchAllMarkets } from '../services/polymarket/markets.js';
import { findBestMatch } from '../services/matching/keywords.js';
import type { Market } from '@polyoverlay/types';

const matchBodySchema = z.object({
  tweetText: z.string().min(1).max(2000),
});

export const matchPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/markets/match', async (request, reply) => {
    const parseResult = matchBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
    }

    const { tweetText } = parseResult.data;

    try {
      // fetchAllMarkets is cached (15 min TTL) — fast on warm cache, slower on first call
      const markets = await fetchAllMarkets();
      const match: Market | null = findBestMatch(tweetText, markets);
      return reply.send({ match });
    } catch (err) {
      fastify.log.error(err, 'Failed to run market match');
      return reply.status(502).send({ error: 'Market matching failed' });
    }
  });
};
