import { createRequire } from 'module';
import { ethers } from 'ethers';

// Use CommonJS require to avoid Node.js v22 ESM compatibility issues with @0glabs/0g-serving-broker
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
type ZGComputeNetworkBroker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;
import { config } from '../../config/index.js';
import type { Market, SentimentType } from '@taurus/types';

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
    explainableSummary: `${tweets.length} tweets show ${sentiment} sentiment (${direction}, ~${shiftPct}% shift). Current YES price: ${(yesPrice * 100).toFixed(0)}%.`,
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
