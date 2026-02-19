import Fastify from 'fastify';
import cors from '@fastify/cors';
import { marketsPlugin } from './routes/markets.js';
import { matchPlugin } from './routes/match.js';
import { tweetsPlugin } from './routes/tweets.js';
import { insightsPlugin } from './routes/insights.js';
import { demoPlugin } from './routes/demo.js';
import { getOGStatus } from './services/og/inference.js';

export async function createServer() {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, { origin: true });

  server.get('/health', async () => {
    const ogStatus = await getOGStatus();
    return {
      status: 'ok',
      og: {
        connected: ogStatus.brokerConnected,
        ledgerFunded: ogStatus.ledgerFunded,
        mode: ogStatus.mode,
        services: ogStatus.servicesAvailable,
        wallet: ogStatus.walletAddress,
      },
      timestamp: new Date().toISOString(),
    };
  });

  await server.register(marketsPlugin);
  await server.register(matchPlugin);
  await server.register(tweetsPlugin);
  await server.register(insightsPlugin);
  await server.register(demoPlugin);

  server.get('/api/positions', async () => {
    return { message: 'Positions endpoint - to be implemented' };
  });

  server.post('/api/trades', async () => {
    return { message: 'Trades endpoint - to be implemented' };
  });

  return server;
}
