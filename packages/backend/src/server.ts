import Fastify from 'fastify';
import cors from '@fastify/cors';
import { marketsPlugin } from './routes/markets.js';
import { matchPlugin } from './routes/match.js';
import { positionsPlugin } from './routes/positions.js';
import { tradesPlugin } from './routes/trades.js';

export async function createServer() {
  const server = Fastify({
    logger: true,
  });

  // Enable CORS for extension
  await server.register(cors, {
    origin: true,
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Real market routes (fetches live data from Polymarket Gamma API)
  await server.register(marketsPlugin);

  // Tweet-to-market keyword matching
  await server.register(matchPlugin);

  // Positions — proxies Polymarket Data API
  await server.register(positionsPlugin);

  // Trades — submits signed orders to Polymarket CLOB
  await server.register(tradesPlugin);

  return server;
}
