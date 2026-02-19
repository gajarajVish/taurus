import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { fetchMarkets, fetchMarket } from '../services/polymarket/markets.js';

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
  active: z
    .string()
    .optional()
    .transform((v) => v !== 'false'), // default true; only "false" string disables
});

const getParamsSchema = z.object({
  id: z.string().min(1),
});

export const marketsPlugin: FastifyPluginAsync = async (fastify) => {
  // GET /api/markets?limit=50&active=true
  fastify.get('/api/markets', async (request, reply) => {
    const parseResult = listQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
    }

    const { limit, active } = parseResult.data;

    try {
      const markets = await fetchMarkets({ limit, active });
      return reply.send(markets);
    } catch (err) {
      fastify.log.error(err, 'Failed to fetch markets from Polymarket');
      return reply.status(502).send({ error: 'Failed to fetch markets from upstream' });
    }
  });

  // GET /api/markets/:id
  fastify.get<{ Params: { id: string } }>('/api/markets/:id', async (request, reply) => {
    const parseResult = getParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid market ID' });
    }

    const { id } = parseResult.data;

    try {
      const market = await fetchMarket(id);
      if (!market) {
        return reply.status(404).send({ error: 'Market not found' });
      }
      return reply.send(market);
    } catch (err) {
      fastify.log.error(err, `Failed to fetch market ${id} from Polymarket`);
      return reply.status(502).send({ error: 'Failed to fetch market from upstream' });
    }
  });
};
