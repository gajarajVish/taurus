import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { ethers } from 'ethers';

async function main() {
  const rpcUrl = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY;

  if (!privateKey) {
    console.error('ERROR: OG_COMPUTE_PRIVATE_KEY not found.');
    console.error('Make sure your .env file exists at the project root with:');
    console.error('  OG_COMPUTE_PRIVATE_KEY=<your-key>');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      0G Compute Network — Integration Test      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Step 1: Connect wallet
  console.log('STEP 1 — Connect wallet');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`  Address:  ${wallet.address}`);
  console.log(`  Balance:  ${ethers.formatEther(balance)} A0GI`);
  console.log(`  RPC:      ${rpcUrl}\n`);

  // Step 2: Init broker
  console.log('STEP 2 — Initialize 0G broker');
  const broker = await createZGComputeNetworkBroker(wallet as any);
  console.log('  ✓ Broker initialized\n');

  // Step 3: Check / fund ledger
  console.log('STEP 3 — Check inference ledger');
  let ledgerOk = false;
  try {
    const ledger = await broker.ledger.getLedger();
    const bal = Number(ethers.formatEther(ledger.totalBalance));
    console.log(`  ✓ Ledger exists — balance: ${bal} OG`);
    ledgerOk = true;
  } catch {
    console.log('  ✗ No ledger found');
    const walletBal = Number(ethers.formatEther(balance));
    if (walletBal >= 0.15) {
      console.log('  → Funding ledger with 0.1 A0GI...');
      await broker.ledger.addLedger(0.1);
      const ledger = await broker.ledger.getLedger();
      console.log(`  ✓ Ledger funded — balance: ${ethers.formatEther(ledger.totalBalance)} OG`);
      ledgerOk = true;
    } else {
      console.log(`  ✗ Wallet balance too low (${walletBal} A0GI). Need ≥ 0.15 to cover deposit + gas.`);
      console.log('  → Get testnet tokens: https://faucet.0g.ai');
      console.log(`  → Your address: ${wallet.address}`);
    }
  }
  console.log();

  // Step 4: List services
  console.log('STEP 4 — Discover inference services');
  const services = await broker.inference.listService();
  console.log(`  Found ${services.length} service(s):`);
  for (const s of services) {
    console.log(`    • ${s.model} (${s.serviceType}) — ${s.url}`);
  }

  const chatService = services.find(
    (s: any) => s.serviceType === 'chatbot' || s.model.toLowerCase().includes('instruct')
  );

  if (!chatService) {
    console.log('\n  ✗ No chat/instruct service available. Cannot run inference.');
    return;
  }
  console.log(`\n  Using: ${chatService.model}\n`);

  if (!ledgerOk) {
    console.log('STEP 5 — SKIPPED (ledger not funded)');
    console.log('\n  Fund the ledger first, then re-run this test.\n');
    return;
  }

  // Step 5: Real inference call
  console.log('STEP 5 — Send inference request (sentiment analysis demo)');
  const { endpoint, model } = await broker.inference.getServiceMetadata(chatService.provider);

  const demoPrompt = `Analyze the following tweets about this prediction market:

Market Question: Will Bitcoin exceed $100,000 by end of 2026?
Current YES price: 0.72 (72% probability)

Tweets:
1. "BTC just broke through major resistance at $95k, this is incredibly bullish"
2. "Institutional inflows are massive right now, ETF volumes at all time highs"
3. "Bitcoin hashrate just hit new ATH, network has never been stronger"

Provide a JSON response:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "score": <0-1 confidence>,
  "consensusShift": <-1 to 1>,
  "riskFlags": ["..."],
  "opportunityScore": <0-1>,
  "explainableSummary": "<1-2 sentence summary>"
}
Respond ONLY with valid JSON.`;

  const headers = await broker.inference.getRequestHeaders(chatService.provider, demoPrompt);

  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Model:    ${model}`);
  console.log('  Sending...\n');

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a financial sentiment analyst. Respond with valid JSON only.' },
        { role: 'user', content: demoPrompt },
      ],
      model,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`  ✗ Request failed: ${response.status}`);
    console.error(`    ${errText}`);
    return;
  }

  const data = await response.json() as any;
  const answer = data.choices?.[0]?.message?.content;

  console.log('  ✓ 0G AI Response:');
  console.log('  ─────────────────');
  console.log(`  ${answer}`);

  // Try to parse as JSON for a nice summary
  try {
    const jsonMatch = answer?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n  Parsed insight:');
      console.log(`    Sentiment:    ${parsed.sentiment}`);
      console.log(`    Confidence:   ${(parsed.score * 100).toFixed(0)}%`);
      console.log(`    Price shift:  ${parsed.consensusShift > 0 ? '+' : ''}${(parsed.consensusShift * 100).toFixed(1)}%`);
      console.log(`    Opportunity:  ${(parsed.opportunityScore * 100).toFixed(0)}%`);
      console.log(`    Risk flags:   ${parsed.riskFlags?.join(', ') || 'none'}`);
      console.log(`    Summary:      ${parsed.explainableSummary}`);
    }
  } catch { /* raw output already printed */ }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║          ✓ Integration Test PASSED               ║');
  console.log('╚══════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\nTest failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
