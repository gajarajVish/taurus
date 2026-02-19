export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mockPositions: process.env.MOCK_POSITIONS === 'true',
  polymarket: {
    gammaBaseUrl: process.env.GAMMA_API_URL ?? 'https://gamma-api.polymarket.com',
    clobBaseUrl: process.env.CLOB_API_URL ?? 'https://clob.polymarket.com',
  },
  cache: {
    marketsTtl: parseInt(process.env.MARKETS_CACHE_TTL_MS ?? '300000', 10), // 5 min
  },
} as const;

export type Config = typeof config;
