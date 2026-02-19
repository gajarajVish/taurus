import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai');
  const wallet = new ethers.Wallet(process.env.OG_COMPUTE_PRIVATE_KEY!, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`Wallet:  ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} A0GI\n`);

  const broker = await createZGComputeNetworkBroker(wallet as any);

  // Step 1: Check/create ledger
  let hasLedger = false;
  try {
    const ledger = await broker.ledger.getLedger();
    console.log(`✓ Ledger exists — balance: ${ethers.formatEther(ledger.totalBalance)} OG`);
    hasLedger = true;
  } catch {
    console.log('No ledger. Attempting to fund with 0.1 A0GI...');
    try {
      await broker.ledger.addLedger(0.1);
      console.log('✓ Ledger created!');
      hasLedger = true;
    } catch (err: any) {
      console.error(`✗ ${err.message}`);
      const minNeeded = ethers.parseEther('0.101');
      const shortfall = minNeeded - balance;
      if (shortfall > 0n) {
        console.log(`\nNeed ~${ethers.formatEther(shortfall)} more A0GI for deposit (0.1) + gas.`);
        console.log(`Claim from: https://faucet.0g.ai`);
        console.log(`Then re-run: npm run fund -w packages/backend`);
      }
      return;
    }
  }

  if (!hasLedger) return;

  // Step 2: Test real inference
  console.log('\nListing services...');
  const services = await broker.inference.listService();
  const chat = services.find((s: any) =>
    s.serviceType === 'chatbot' || s.model.toLowerCase().includes('instruct')
  );
  if (!chat) { console.log('No chat service found.'); return; }

  console.log(`Using: ${chat.model}\n`);

  const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);
  const question = 'Analyze: 3 tweets say Bitcoin is bullish and breaking out. Respond only with JSON: {"sentiment":"bullish","score":0.85,"summary":"Strong bullish consensus"}';
  const headers = await broker.inference.getRequestHeaders(chat.provider, question);

  console.log('Sending inference request to 0G network...');
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a financial analyst. Respond with JSON only.' },
        { role: 'user', content: question },
      ],
      model,
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    console.error(`✗ ${res.status}: ${await res.text()}`);
    return;
  }

  const data = await res.json() as any;
  console.log('\n✓ 0G AI Response:');
  console.log(data.choices?.[0]?.message?.content ?? '(empty)');
  console.log('\n✓ Real 0G inference is working!');
}

main().catch(err => { console.error(err.message); process.exit(1); });
