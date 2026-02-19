import Fastify from 'fastify';
import cors from '@fastify/cors';
import { marketsPlugin } from './routes/markets.js';
import { matchPlugin } from './routes/match.js';
import { positionsPlugin } from './routes/positions.js';
import { tradesPlugin } from './routes/trades.js';
import { insightsPlugin } from './routes/insights.js';
import { tweetsPlugin } from './routes/tweets.js';
import { startPeriodicScan } from './services/insights/aggregator.js';

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

  // Insights — AI-powered market insights via 0G
  await server.register(insightsPlugin);

  // Tweets — tweet view recording for insight aggregation
  await server.register(tweetsPlugin);

  // Start proactive 0G market scanning
  startPeriodicScan();

  return server;
}
