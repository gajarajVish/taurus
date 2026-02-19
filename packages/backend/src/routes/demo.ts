import type { FastifyPluginAsync } from 'fastify';
import type { Market, Insight } from '@taurus/types';
import { analyzeTweets, getOGStatus } from '../services/og/inference.js';
import * as viewStore from '../services/session/views.js';
import { getAllInsights, getAggregatorStats } from '../services/insights/aggregator.js';

const DEMO_INSTALL_ID = 'demo-user-001';

interface DemoScenario {
  name: string;
  market: Market;
  tweets: string[];
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    name: 'Bitcoin bullish',
    market: {
      id: 'demo-btc-100k',
      conditionId: 'demo-btc-100k',
      question: 'Will Bitcoin exceed $100,000 by end of 2026?',
      slug: 'bitcoin-100k-2026',
      yesPrice: '0.72',
      noPrice: '0.28',
      yesTokenId: '',
      noTokenId: '',
      volume: '5200000',
      liquidity: '1800000',
      endDate: '2026-12-31T23:59:59Z',
      status: 'open',
    },
    tweets: [
      'BTC just broke through major resistance at $95k, incredibly bullish setup',
      'Institutional inflows are massive right now, ETF volumes at all time highs',
      'Bitcoin hashrate just hit new ATH, network has never been stronger',
      'Every dip is getting bought aggressively, this rally has serious momentum',
    ],
  },
  {
    name: 'Election bearish',
    market: {
      id: 'demo-election',
      conditionId: 'demo-election',
      question: 'Will candidate X win the 2026 midterms?',
      slug: 'candidate-x-midterms',
      yesPrice: '0.58',
      noPrice: '0.42',
      yesTokenId: '',
      noTokenId: '',
      volume: '3100000',
      liquidity: '900000',
      endDate: '2026-11-03T23:59:59Z',
      status: 'open',
    },
    tweets: [
      'Latest polls show a major shift, this candidate is losing ground fast',
      'Campaign in crisis mode after scandal, donors pulling support',
      'Internal party sources say the situation is worse than reported',
    ],
  },
  {
    name: 'Fed rate neutral',
    market: {
      id: 'demo-fed-rate',
      conditionId: 'demo-fed-rate',
      question: 'Will the Fed cut rates before July 2026?',
      slug: 'fed-rate-cut-july',
      yesPrice: '0.45',
      noPrice: '0.55',
      yesTokenId: '',
      noTokenId: '',
      volume: '1500000',
      liquidity: '600000',
      endDate: '2026-07-31T23:59:59Z',
      status: 'open',
    },
    tweets: [
      'Fed signals mixed outlook, markets uncertain about next move',
      'Some FOMC members hawkish but others see risk of overtightening',
      'Economic data is contradictory — strong jobs but falling manufacturing',
      'Wall Street split on rate decision, could go either way',
    ],
  },
];

export const demoPlugin: FastifyPluginAsync = async (server) => {
  // POST /api/demo/run — Execute the full Taurus analysis pipeline
  server.post('/api/demo/run', async () => {
    const results: Array<{
      scenario: string;
      marketQuestion: string;
      tweetsAnalyzed: number;
      insight: {
        sentiment: string;
        confidence: string;
        consensusShift: string;
        opportunityScore: string;
        riskFlags: string[];
        summary: string;
        source: string;
      };
    }> = [];

    for (const scenario of DEMO_SCENARIOS) {
      const result = await analyzeTweets(scenario.tweets, scenario.market);

      results.push({
        scenario: scenario.name,
        marketQuestion: scenario.market.question,
        tweetsAnalyzed: scenario.tweets.length,
        insight: {
          sentiment: result.sentiment,
          confidence: `${(result.score * 100).toFixed(0)}%`,
          consensusShift: `${result.consensusShift > 0 ? '+' : ''}${(result.consensusShift * 100).toFixed(1)}%`,
          opportunityScore: `${(result.opportunityScore * 100).toFixed(0)}%`,
          riskFlags: result.riskFlags,
          summary: result.explainableSummary,
          source: result.source,
        },
      });
    }

    return {
      message: `Pipeline executed — ${results.length} markets analyzed`,
      results,
    };
  });

  // GET /api/demo/status — Full system status
  server.get('/api/demo/status', async () => {
    const ogStatus = await getOGStatus();
    const sessionStats = viewStore.getSessionStats();
    const aggStats = getAggregatorStats();

    return {
      og: ogStatus,
      pipeline: { sessions: sessionStats, aggregator: aggStats },
      instructions: ogStatus.ledgerFunded
        ? '0G AI mode active — inference powered by decentralized Qwen 2.5 7B'
        : {
            currentMode: 'local-fallback (keyword sentiment analysis)',
            upgrade: [
              `1. Get ≥0.15 A0GI from https://faucet.0g.ai for wallet ${ogStatus.walletAddress}`,
              '2. Restart the backend: npm run dev:api',
              '3. 0G AI will auto-activate',
            ],
          },
    };
  });
};
