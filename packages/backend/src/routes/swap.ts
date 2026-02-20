import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { config } from '../config/index.js';

const checkApprovalSchema = z.object({
  token: z.string(),
  amount: z.string(),
  walletAddress: z.string(),
  chainId: z.number(),
});

const quoteSchema = z.object({
  type: z.literal('EXACT_INPUT'),
  tokenIn: z.string(),
  tokenInChainId: z.number(),
  tokenOut: z.string(),
  tokenOutChainId: z.number(),
  amount: z.string(),
  swapper: z.string(),
  slippageTolerance: z.number().optional().default(0.5),
});

const orderSchema = z.object({
  quote: z.unknown(),
  signature: z.string(),
  chainId: z.number(),
});

async function proxyToUniswap(
  endpoint: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const resp = await fetch(`${config.uniswap.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.uniswap.apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({ error: 'Invalid JSON from Uniswap API' }));
  return { ok: resp.ok, status: resp.status, data };
}

// Transform raw Uniswap quote response into our SwapQuoteResponse shape
function transformQuoteResponse(raw: Record<string, unknown>): unknown {
  const rawQuote = raw.quote as Record<string, unknown> | undefined;
  if (!rawQuote) return raw;

  const output = rawQuote.output as { amount?: string; token?: string } | undefined;
  const input = rawQuote.input as { amount?: string; token?: string } | undefined;
  const route = rawQuote.route as unknown[][] | undefined;

  // Build human-readable output amount
  const amountOut = output?.amount ?? '0';
  // Guess decimals from token — USDC=6, ETH/WETH=18
  const outToken = output?.token?.toLowerCase() ?? '';
  const isUSDC = outToken === '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
  const decimals = isUSDC ? 6 : 18;
  const amountOutReadable = (Number(amountOut) / 10 ** decimals).toFixed(decimals <= 6 ? 2 : 6);

  // Build route description
  let routeDesc = '';
  if (route && route[0]) {
    const hops = route[0] as Array<{ tokenIn?: { symbol?: string }; tokenOut?: { symbol?: string } }>;
    const symbols = hops.map(h => `${h.tokenIn?.symbol ?? '?'} → ${h.tokenOut?.symbol ?? '?'}`);
    routeDesc = symbols.join(' → ');
  }

  // Extract methodParameters for CLASSIC routing (direct on-chain swap)
  const methodParameters = rawQuote.methodParameters as {
    calldata?: string; value?: string; to?: string;
  } | undefined;

  return {
    routing: String(raw.routing ?? 'CLASSIC'),
    quote: {
      amountOut,
      amountOutReadable,
      gasEstimate: String(rawQuote.gasUseEstimate ?? '0'),
      gasFeeUSD: String(rawQuote.gasFeeUSD ?? '0'),
      priceImpact: String(rawQuote.priceImpact ?? '0'),
      route: routeDesc,
      permit2Data: raw.permitData ?? null,
      methodParameters: methodParameters ?? null,
      routeData: raw, // Pass full raw response for order submission
    },
    requestId: String(raw.requestId ?? ''),
  };
}

export const swapPlugin: FastifyPluginAsync = async (fastify) => {
  // Check if token approval is needed for Permit2
  fastify.post('/api/swap/check-approval', async (request, reply) => {
    const parseResult = checkApprovalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid check-approval payload',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await proxyToUniswap('/check_approval', parseResult.data);
      if (!result.ok) {
        return reply.status(result.status).send(result.data);
      }
      return reply.send(result.data);
    } catch (err) {
      fastify.log.error(err, 'Failed to check approval via Uniswap API');
      return reply.status(502).send({ error: 'Uniswap API unavailable' });
    }
  });

  // Get a swap quote
  fastify.post('/api/swap/quote', async (request, reply) => {
    const parseResult = quoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid quote payload',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await proxyToUniswap('/quote', parseResult.data);
      if (!result.ok) {
        return reply.status(result.status).send(result.data);
      }
      // Log raw response for debugging
      const raw = result.data as Record<string, unknown>;
      const rawQuote = raw.quote as Record<string, unknown> | undefined;
      fastify.log.info({
        routing: raw.routing,
        hasMethodParameters: !!rawQuote?.methodParameters,
        hasPermitData: !!raw.permitData,
      }, 'Uniswap raw quote info');
      // Transform to match our SwapQuoteResponse type
      const transformed = transformQuoteResponse(raw);
      return reply.send(transformed);
    } catch (err) {
      fastify.log.error(err, 'Failed to get quote from Uniswap API');
      return reply.status(502).send({ error: 'Uniswap API unavailable' });
    }
  });

  // Submit a swap order with Permit2 signature
  fastify.post('/api/swap/order', async (request, reply) => {
    const parseResult = orderSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid order payload',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await proxyToUniswap('/order', parseResult.data);
      if (!result.ok) {
        return reply.status(result.status).send(result.data);
      }
      return reply.send(result.data);
    } catch (err) {
      fastify.log.error(err, 'Failed to submit order to Uniswap API');
      return reply.status(502).send({ error: 'Uniswap API unavailable' });
    }
  });
};
