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
  og: {
    privateKey: process.env.OG_COMPUTE_PRIVATE_KEY ?? '',
    rpcUrl: process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai',
  },
  uniswap: {
    apiKey: process.env.UNISWAP_API_KEY ?? '',
    baseUrl: process.env.UNISWAP_API_URL ?? 'https://trade-api.gateway.uniswap.org/v1',
  },
} as const;

export type Config = typeof config;
