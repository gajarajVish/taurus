import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { submitTrade } from '../services/polymarket/trade.js';

const signedOrderSchema = z.object({
  salt: z.string(),
  maker: z.string(),
  signer: z.string(),
  taker: z.string(),
  tokenId: z.string(),
  makerAmount: z.string(),
  takerAmount: z.string(),
  expiration: z.string(),
  nonce: z.string(),
  feeRateBps: z.string(),
  side: z.number(),
  signatureType: z.number(),
});

const bodySchema = z.object({
  order: signedOrderSchema,
  signature: z.string(),
  orderType: z.string().default('GTC'),
  chainId: z.number().optional(),
  l1Auth: z.object({
    address: z.string(),
    signature: z.string(),
    timestamp: z.string(),
    nonce: z.string(),
  }),
});

export const tradesPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/trades', async (request, reply) => {
    const parseResult = bodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid trade payload',
        details: parseResult.error.flatten(),
      });
    }

    // Polygon Amoy testnet — skip real CLOB, return mock success
    if (parseResult.data.chainId === 80002) {
      return reply.send({
        success: true,
        data: { orderID: `mock-amoy-${Date.now()}`, status: 'matched' },
      });
    }

    try {
      const result = await submitTrade(parseResult.data);
      return reply.send({ success: true, data: result });
    } catch (err) {
      fastify.log.error(err, 'Failed to submit trade to Polymarket CLOB');
      const message = err instanceof Error ? err.message : 'Failed to submit trade';
      return reply.status(502).send({ error: message });
    }
  });
};
