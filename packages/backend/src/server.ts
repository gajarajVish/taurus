import Fastify from 'fastify';
import cors from '@fastify/cors';
import { marketsPlugin } from './routes/markets.js';
import { matchPlugin } from './routes/match.js';

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

  // Stub placeholders — to be implemented in future iterations
  server.get('/api/positions', async () => {
    return { message: 'Positions endpoint - to be implemented' };
  });

  server.post('/api/trades', async () => {
    return { message: 'Trades endpoint - to be implemented' };
  });

  return server;
}
