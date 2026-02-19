import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { fetchPositions } from '../services/polymarket/positions.js';

const querySchema = z.object({
  address: z.string().min(1),
});

export const positionsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/positions', async (request, reply) => {
    const parseResult = querySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'address query parameter is required' });
    }

    try {
      const positions = await fetchPositions(parseResult.data.address);
      return reply.send(positions);
    } catch (err) {
      fastify.log.error(err, 'Failed to fetch positions from Polymarket Data API');
      return reply.status(502).send({ error: 'Failed to fetch positions from upstream' });
    }
  });
};
