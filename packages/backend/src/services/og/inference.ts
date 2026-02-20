import { createRequire } from 'module';
import { ethers } from 'ethers';

// Use CommonJS require to avoid Node.js v22 ESM compatibility issues with @0glabs/0g-serving-broker
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
type ZGComputeNetworkBroker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;
import { config } from '../../config/index.js';
import type { Market, SentimentType, PortfolioPosition, PortfolioAnalysis, ActionableItem, Insight } from '@taurus/types';

export interface SentimentResult {
  sentiment: SentimentType;
  score: number;
  consensusShift: number;
  riskFlags: string[];
  opportunityScore: number;
  explainableSummary: string;
  source: '0g' | 'local';
}

// ── 0G Broker singleton ─────────────────────────────────────────────────────

let brokerInstance: ZGComputeNetworkBroker | null = null;
let brokerInitPromise: Promise<ZGComputeNetworkBroker> | null = null;
let ledgerReady = false;

async function getBroker(): Promise<ZGComputeNetworkBroker> {
  if (brokerInstance) return brokerInstance;
  if (brokerInitPromise) return brokerInitPromise;

  brokerInitPromise = initializeBroker();
  brokerInstance = await brokerInitPromise;
  return brokerInstance;
}

async function initializeBroker(): Promise<ZGComputeNetworkBroker> {
  if (!config.og.privateKey) {
    throw new Error('OG_COMPUTE_PRIVATE_KEY not configured');
  }

  const provider = new ethers.JsonRpcProvider(config.og.rpcUrl);
  const wallet = new ethers.Wallet(config.og.privateKey, provider);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broker = await createZGComputeNetworkBroker(wallet as any);
  console.log('[0G] Broker initialized');

  ledgerReady = await checkLedger(broker);

  return broker;
}

async function checkLedger(broker: ZGComputeNetworkBroker): Promise<boolean> {
  try {
    const ledger = await broker.ledger.getLedger();
    const balance = Number(ethers.formatEther(ledger.totalBalance));
    console.log(`[0G] Ledger balance: ${balance} OG`);
    return balance > 0;
  } catch {
    console.warn('[0G] No ledger found — will use local analysis until funded');
    console.warn('[0G] Fund your wallet with >0.15 A0GI, then restart the server');
    console.warn('[0G] Faucet: https://faucet.0g.ai');
    return false;
  }
}

interface ServiceInfo {
  provider: string;
  serviceType: string;
  url: string;
  model: string;
}

async function findChatService(broker: ZGComputeNetworkBroker): Promise<ServiceInfo | null> {
  const services = await broker.inference.listService();

  const chatService = services.find(
    (s: ServiceInfo) =>
      s.serviceType === 'chatbot' ||
      s.model.toLowerCase().includes('instruct') ||
      s.model.toLowerCase().includes('chat')
  );

  return chatService
    ? { provider: chatService.provider, serviceType: chatService.serviceType, url: chatService.url, model: chatService.model }
    : null;
}

// ── Local keyword-based analysis (fallback) ──────────────────────────────────

const BULLISH_SIGNALS = [
  'bullish', 'moon', 'pump', 'rally', 'surge', 'breakout', 'ath', 'all time high',
  'soar', 'rocket', 'buy', 'long', 'upside', 'optimistic', 'confirmed', 'passed',
  'approved', 'win', 'won', 'victory', 'success', 'strong', 'higher', 'rise',
  'rising', 'growth', 'positive', 'support', 'breaking', 'massive', 'huge',
];

const BEARISH_SIGNALS = [
  'bearish', 'crash', 'dump', 'sell', 'short', 'drop', 'plunge', 'decline',
  'fail', 'failed', 'reject', 'rejected', 'denied', 'loss', 'weak', 'lower',
  'falling', 'negative', 'risk', 'warning', 'concern', 'doubt', 'unlikely',
  'overvalued', 'bubble', 'scam', 'fraud', 'collapse',
];

function analyzeLocal(tweets: string[], market: Market): SentimentResult {
  const allText = tweets.join(' ').toLowerCase();

  let bullishScore = 0;
  let bearishScore = 0;

  for (const signal of BULLISH_SIGNALS) {
    const regex = new RegExp(`\\b${signal}\\b`, 'gi');
    const matches = allText.match(regex);
    if (matches) bullishScore += matches.length;
  }

  for (const signal of BEARISH_SIGNALS) {
    const regex = new RegExp(`\\b${signal}\\b`, 'gi');
    const matches = allText.match(regex);
    if (matches) bearishScore += matches.length;
  }

  const total = bullishScore + bearishScore || 1;
  const bullishRatio = bullishScore / total;
  const bearishRatio = bearishScore / total;

  let sentiment: SentimentType;
  let consensusShift: number;

  if (bullishRatio > 0.6) {
    sentiment = 'bullish';
    consensusShift = Math.min(0.15, bullishRatio * 0.2);
  } else if (bearishRatio > 0.6) {
    sentiment = 'bearish';
    consensusShift = -Math.min(0.15, bearishRatio * 0.2);
  } else {
    sentiment = 'neutral';
    consensusShift = (bullishRatio - bearishRatio) * 0.1;
  }

  const confidence = Math.min(0.85, 0.3 + (Math.abs(bullishScore - bearishScore) / total) * 0.5 + tweets.length * 0.05);
  const opportunityScore = Math.min(0.9, Math.abs(consensusShift) * 3 + confidence * 0.3);

  const riskFlags: string[] = [];
  if (tweets.length < 5) riskFlags.push('low sample size');
  if (Math.abs(bullishRatio - bearishRatio) < 0.2) riskFlags.push('mixed signals');
  if (bullishScore + bearishScore < 3) riskFlags.push('weak signal strength');

  const yesPrice = parseFloat(market.yesPrice) || 0.5;
  const direction = sentiment === 'bullish' ? 'YES ↑' : sentiment === 'bearish' ? 'NO ↑' : 'neutral';
  const shiftPct = Math.abs(consensusShift * 100).toFixed(1);

  return {
    sentiment,
    score: Math.round(confidence * 100) / 100,
    consensusShift: Math.round(consensusShift * 1000) / 1000,
    riskFlags,
    opportunityScore: Math.round(opportunityScore * 100) / 100,
    explainableSummary: `${tweets.length} ${tweets.length === 1 ? 'tweet shows' : 'tweets show'} ${sentiment} sentiment (${direction}, ~${shiftPct}% shift). Current YES price: ${(yesPrice * 100).toFixed(0)}%.`,
    source: 'local',
  };
}

// ── 0G AI analysis ───────────────────────────────────────────────────────────

function buildPrompt(tweets: string[], market: Market): string {
  const tweetsFormatted = tweets.map((t, i) => `${i + 1}. "${t}"`).join('\n');

  return `Analyze the following tweets about this prediction market:

Market Question: ${market.question}
Current YES price: ${market.yesPrice} (${Math.round(parseFloat(market.yesPrice) * 100)}% probability)

Tweets:
${tweetsFormatted}

Analyze the sentiment and provide a JSON response with this exact structure:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "score": <number 0-1 representing confidence>,
  "consensusShift": <number -1 to 1 representing expected probability change>,
  "riskFlags": [<array of risk warning strings, if any>],
  "opportunityScore": <number 0-1 representing trading opportunity strength>,
  "explainableSummary": "<1-2 sentence summary for users>"
}

Rules:
- "bullish" means tweets suggest YES is underpriced
- "bearish" means tweets suggest NO is underpriced
- "neutral" means mixed or inconclusive signals
- consensusShift: positive = YES odds should rise, negative = NO odds should rise
- riskFlags: include warnings like "contradictory sources", "low sample size", "breaking news volatility"
- Be conservative with high scores unless consensus is very clear

Respond ONLY with valid JSON, no other text.`;
}

function parseResponse(response: string): SentimentResult {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in LLM response');

  const parsed = JSON.parse(jsonMatch[0]);

  const sentiment = ['bullish', 'bearish', 'neutral'].includes(parsed.sentiment)
    ? (parsed.sentiment as SentimentType)
    : 'neutral';

  return {
    sentiment,
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0.5,
    consensusShift: typeof parsed.consensusShift === 'number' ? Math.max(-1, Math.min(1, parsed.consensusShift)) : 0,
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.filter((f: unknown) => typeof f === 'string') : [],
    opportunityScore: typeof parsed.opportunityScore === 'number' ? Math.max(0, Math.min(1, parsed.opportunityScore)) : 0.5,
    explainableSummary: typeof parsed.explainableSummary === 'string'
      ? parsed.explainableSummary
      : `Analysis of ${sentiment} sentiment with ${Math.round((parsed.score ?? 0.5) * 100)}% confidence.`,
    source: '0g',
  };
}

async function analyzeWith0G(tweets: string[], market: Market): Promise<SentimentResult> {
  const broker = await getBroker();
  const service = await findChatService(broker);
  if (!service) throw new Error('No chat service available on 0G');

  const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider);
  const prompt = buildPrompt(tweets, market);
  const headers = await broker.inference.getRequestHeaders(service.provider, prompt);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a financial sentiment analyst specializing in prediction markets. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      model,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`0G inference failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from 0G inference');

  console.log('[0G] AI inference completed for market:', market.id);
  return parseResponse(content);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function analyzeTweets(tweets: string[], market: Market): Promise<SentimentResult> {
  if (tweets.length === 0) throw new Error('No tweets provided for analysis');

  // Try 0G first if configured and ledger is funded
  if (config.og.privateKey && ledgerReady) {
    try {
      return await analyzeWith0G(tweets, market);
    } catch (err) {
      console.warn('[0G] AI inference failed, falling back to local:', (err as Error).message);
    }
  }

  // Fallback: local keyword-based analysis
  console.log('[Inference] Using local analysis for market:', market.id);
  return analyzeLocal(tweets, market);
}

export type OGStatus = {
  configured: boolean;
  brokerConnected: boolean;
  ledgerFunded: boolean;
  servicesAvailable: string[];
  walletAddress: string | null;
  walletBalance: string | null;
  mode: 'og-ai' | 'local-fallback' | 'not-configured';
};

export async function getOGStatus(): Promise<OGStatus> {
  if (!config.og.privateKey) {
    return {
      configured: false, brokerConnected: false, ledgerFunded: false,
      servicesAvailable: [], walletAddress: null, walletBalance: null,
      mode: 'not-configured',
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.og.rpcUrl);
    const wallet = new ethers.Wallet(config.og.privateKey, provider);
    const balance = await provider.getBalance(wallet.address);

    const broker = await getBroker();
    const services = await broker.inference.listService();
    const serviceNames = services.map((s: ServiceInfo) => `${s.model} (${s.serviceType})`);

    return {
      configured: true,
      brokerConnected: true,
      ledgerFunded: ledgerReady,
      servicesAvailable: serviceNames,
      walletAddress: wallet.address,
      walletBalance: `${ethers.formatEther(balance)} A0GI`,
      mode: ledgerReady ? 'og-ai' : 'local-fallback',
    };
  } catch (err) {
    return {
      configured: true, brokerConnected: false, ledgerFunded: false,
      servicesAvailable: [], walletAddress: null, walletBalance: null,
      mode: 'local-fallback',
    };
  }
}

// ── Portfolio analysis ────────────────────────────────────────────────────

function buildPortfolioPrompt(positions: PortfolioPosition[], insights: Insight[] = []): string {
  const positionsFormatted = positions.map((p, i) => {
    const direction = p.side === 'yes' ? 'YES' : 'NO';
    const pnlSign = p.pnlPercent >= 0 ? '+' : '';
    return `${i}. "${p.marketQuestion}" — ${direction} @ $${p.size.toFixed(2)}, avg price ${p.avgPrice.toFixed(2)}, current ${p.currentPrice.toFixed(2)}, PnL: ${pnlSign}${p.pnlPercent.toFixed(1)}%`;
  }).join('\n');

  let insightsSection = '';
  if (insights.length > 0) {
    const insightsFormatted = insights.map((ins) => {
      const flags = ins.riskFlags.length > 0 ? ` Flags: ${ins.riskFlags.join(', ')}.` : '';
      return `- "${ins.marketId}": ${ins.sentiment} sentiment (${Math.round(ins.score * 100)}% confidence, ${ins.tweetCount} ${ins.tweetCount === 1 ? 'tweet' : 'tweets'}). ${ins.summary}${flags}`;
    }).join('\n');
    insightsSection = `\n\nTweet Sentiment Insights (from live X/Twitter data):\n${insightsFormatted}`;
  }

  return `Analyze this prediction market portfolio for risk management:

Positions (${positions.length} total, 0-indexed):
${positionsFormatted}${insightsSection}

Provide a JSON response with this exact structure:
{
  "summary": "<2-3 sentence portfolio overview>",
  "overallRisk": "low" | "medium" | "high",
  "riskExplanation": "<1-2 sentences explaining WHY this risk level was assigned, referencing specific portfolio characteristics and tweet sentiment signals if available>",
  "correlationWarnings": [{"text": "<warning about correlated positions>", "positionIndices": [<0-based indices of referenced positions>]}],
  "hedgingSuggestions": [{"text": "<specific actionable hedging idea>", "positionIndices": [<0-based indices of referenced positions>]}],
  "trends": ["<common themes or sector concentrations>"],
  "diversificationScore": <number 0-1, 1 = well diversified>,
  "diversificationExplanation": "<1-2 sentences explaining WHY this diversification score was given, referencing which categories are represented and any concentration>"
}

Rules:
- Identify positions that are likely correlated (e.g. multiple political markets, multiple crypto markets)
- Flag concentration risk (too much exposure in one area)
- Suggest specific hedges: "Consider taking NO on X to hedge your YES on Y"
- Note if PnL distribution is skewed (all winning or all losing)
- diversificationScore: 0 = all positions highly correlated, 1 = well diversified across topics
- riskExplanation: cite tweet sentiment data if present (e.g. "bearish sentiment on 2 of your markets adds downside risk")
- diversificationExplanation: mention how many distinct topics/sectors appear and where concentration lies
- positionIndices: list the 0-based array indices of every position referenced in this item. Leave empty [] if no specific position applies.

Respond ONLY with valid JSON, no other text.`;
}

function parsePortfolioResponse(response: string): PortfolioAnalysis {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in portfolio analysis response');

  const parsed = JSON.parse(jsonMatch[0]);

  const parseActionableItems = (raw: unknown): ActionableItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((item: unknown): ActionableItem => {
      if (typeof item === 'string') return { text: item, positionIndices: [] };
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const text = typeof obj.text === 'string' ? obj.text : String(obj.text ?? '');
        const indices = Array.isArray(obj.positionIndices)
          ? (obj.positionIndices as unknown[]).filter((n): n is number => typeof n === 'number')
          : [];
        return { text, positionIndices: indices };
      }
      return { text: String(item), positionIndices: [] };
    }).filter((item) => item.text.length > 0);
  };

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Portfolio analysis completed.',
    overallRisk: ['low', 'medium', 'high'].includes(parsed.overallRisk) ? parsed.overallRisk : 'medium',
    riskExplanation: typeof parsed.riskExplanation === 'string' ? parsed.riskExplanation : '',
    correlationWarnings: parseActionableItems(parsed.correlationWarnings),
    hedgingSuggestions: parseActionableItems(parsed.hedgingSuggestions),
    trends: Array.isArray(parsed.trends)
      ? parsed.trends.filter((s: unknown) => typeof s === 'string')
      : [],
    diversificationScore: typeof parsed.diversificationScore === 'number'
      ? Math.max(0, Math.min(1, parsed.diversificationScore))
      : 0.5,
    diversificationExplanation: typeof parsed.diversificationExplanation === 'string' ? parsed.diversificationExplanation : '',
    timestamp: new Date().toISOString(),
  };
}

function analyzePortfolioLocal(positions: PortfolioPosition[], insights: Insight[] = []): PortfolioAnalysis {
  const topics = positions.map((p) => p.marketQuestion.toLowerCase());

  const trends: string[] = [];
  const correlationWarnings: ActionableItem[] = [];
  const hedgingSuggestions: ActionableItem[] = [];

  const keywords: Record<string, string[]> = {
    'Politics': ['election', 'president', 'vote', 'congress', 'senate', 'trump', 'biden', 'democrat', 'republican'],
    'Crypto': ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'token', 'defi'],
    'Sports': ['nba', 'nfl', 'mlb', 'championship', 'win', 'game', 'series', 'match'],
    'Economy': ['fed', 'interest rate', 'inflation', 'gdp', 'recession', 'economic'],
  };

  const categoryCounts: Record<string, number> = {};
  const categoryPositionIndices: Record<string, number[]> = {};
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    for (const [category, kws] of Object.entries(keywords)) {
      if (kws.some((kw) => topic.includes(kw))) {
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
        categoryPositionIndices[category] = [...(categoryPositionIndices[category] ?? []), i];
      }
    }
  }

  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count >= 2) trends.push(`${count} positions in ${cat}`);
    if (count >= 3) correlationWarnings.push({
      text: `Heavy concentration in ${cat} markets (${count} positions) — highly correlated risk`,
      positionIndices: categoryPositionIndices[cat] ?? [],
    });
  }

  const allYesIndices = positions.reduce<number[]>((acc, p, i) => p.side === 'yes' ? [...acc, i] : acc, []);
  const allNoIndices = positions.reduce<number[]>((acc, p, i) => p.side === 'no' ? [...acc, i] : acc, []);
  if (allYesIndices.length > 0 && allNoIndices.length === 0) {
    hedgingSuggestions.push({ text: 'All positions are YES — consider taking NO on a correlated market to hedge directional risk', positionIndices: allYesIndices });
  }
  if (allNoIndices.length > 0 && allYesIndices.length === 0) {
    hedgingSuggestions.push({ text: 'All positions are NO — consider taking YES on a correlated market to balance exposure', positionIndices: allNoIndices });
  }

  const losingIndices = positions.reduce<number[]>((acc, p, i) => p.pnlPercent < -10 ? [...acc, i] : acc, []);
  if (losingIndices.length >= 2) {
    hedgingSuggestions.push({ text: `${losingIndices.length} positions down >10% — consider reducing exposure or setting mental stop-losses`, positionIndices: losingIndices });
  }

  const totalCategories = Object.keys(categoryCounts).length || 1;
  const maxConcentration = Math.max(...Object.values(categoryCounts), 0) / positions.length;
  const diversificationScore = Math.min(1, (totalCategories / 4) * (1 - maxConcentration * 0.5));

  let overallRisk: 'low' | 'medium' | 'high' = 'medium';
  if (correlationWarnings.length >= 2 || maxConcentration > 0.7) overallRisk = 'high';
  else if (correlationWarnings.length === 0 && diversificationScore > 0.6) overallRisk = 'low';

  // Build risk explanation from portfolio structure and available sentiment insights
  const riskReasons: string[] = [];
  if (correlationWarnings.length >= 2) riskReasons.push(`${correlationWarnings.length} correlation warnings detected`);
  if (maxConcentration > 0.7) riskReasons.push(`${Math.round(maxConcentration * 100)}% of positions concentrated in one sector`);
  if (correlationWarnings.length === 0 && diversificationScore > 0.6) riskReasons.push('positions are spread across multiple uncorrelated sectors');
  const bearishInsights = insights.filter((i) => i.sentiment === 'bearish');
  const bullishInsights = insights.filter((i) => i.sentiment === 'bullish');
  if (bearishInsights.length > 0) riskReasons.push(`tweet sentiment is bearish on ${bearishInsights.length} of your markets`);
  if (bullishInsights.length > 0 && bearishInsights.length === 0) riskReasons.push(`tweet sentiment is bullish on ${bullishInsights.length} of your markets`);
  const riskExplanation = riskReasons.length > 0
    ? `Risk is ${overallRisk} because ${riskReasons.join(', ')}.`
    : `Risk is ${overallRisk} based on portfolio composition across ${totalCategories} sector${totalCategories !== 1 ? 's' : ''}.`;

  // Build diversification explanation
  const categoryList = Object.keys(categoryCounts);
  const topCategory = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0];
  let diversificationExplanation: string;
  if (categoryList.length >= 3) {
    diversificationExplanation = `Well diversified across ${categoryList.length} sectors (${categoryList.join(', ')}), reducing correlation risk.`;
  } else if (topCategory && topCategory[1] / positions.length > 0.6) {
    diversificationExplanation = `${Math.round((topCategory[1] / positions.length) * 100)}% of positions are in ${topCategory[0]}, creating concentration risk. Spreading into other sectors would improve this score.`;
  } else {
    diversificationExplanation = `Positions span ${categoryList.length > 0 ? categoryList.join(' and ') : 'mixed topics'} with moderate spread across sectors.`;
  }

  return {
    summary: `Portfolio has ${positions.length} positions across ${totalCategories} categories. ${correlationWarnings.length > 0 ? 'Correlation risks detected.' : 'Moderate diversification.'}`,
    overallRisk,
    riskExplanation,
    correlationWarnings,
    hedgingSuggestions,
    trends,
    diversificationScore: Math.round(diversificationScore * 100) / 100,
    diversificationExplanation,
    timestamp: new Date().toISOString(),
  };
}

export async function analyzePortfolio(positions: PortfolioPosition[], insights: Insight[] = []): Promise<PortfolioAnalysis> {
  if (positions.length === 0) {
    return {
      summary: 'No positions to analyze.',
      overallRisk: 'low',
      riskExplanation: 'No positions in portfolio.',
      correlationWarnings: [],
      hedgingSuggestions: [],
      trends: [],
      diversificationScore: 1,
      diversificationExplanation: 'No positions to assess.',
      timestamp: new Date().toISOString(),
    };
  }

  if (config.og.privateKey && ledgerReady) {
    try {
      const broker = await getBroker();
      const service = await findChatService(broker);
      if (!service) throw new Error('No chat service');

      const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider);
      const prompt = buildPortfolioPrompt(positions, insights);
      const headers = await broker.inference.getRequestHeaders(service.provider, prompt);

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a risk management analyst specializing in prediction markets. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          model,
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!response.ok) throw new Error(`0G inference failed: ${response.status}`);

      const result = await response.json() as { choices: Array<{ message: { content: string } }> };
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response');

      console.log('[0G] Portfolio analysis completed');
      return parsePortfolioResponse(content);
    } catch (err) {
      console.warn('[0G] Portfolio analysis failed, using local:', (err as Error).message);
    }
  }

  return analyzePortfolioLocal(positions, insights);
}

export async function isOGAvailable(): Promise<boolean> {
  if (!config.og.privateKey) return false;
  try {
    const broker = await getBroker();
    const services = await broker.inference.listService();
    return services.length > 0;
  } catch {
    return false;
  }
}

// Used by automation monitor for exit signal evaluation via 0G
export async function evaluateExitSignal(prompt: string): Promise<string> {
  const broker = await getBroker();
  const service = await findChatService(broker);
  if (!service) throw new Error('No chat service');

  const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider);
  const headers = await broker.inference.getRequestHeaders(service.provider, prompt);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a trading automation assistant for prediction markets. Evaluate exit signals and respond with JSON only.' },
        { role: 'user', content: prompt },
      ],
      model,
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  if (!response.ok) throw new Error(`0G inference failed: ${response.status}`);

  const result = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty 0G response');

  return content;
}
