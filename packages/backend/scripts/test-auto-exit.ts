#!/usr/bin/env tsx
/**
 * test-auto-exit.ts — Demo/testing script for the auto-exit pipeline
 *
 * Usage:
 *   npx tsx scripts/test-auto-exit.ts [options]
 *
 * Options:
 *   --installId <id>       Extension install ID (required unless --auto)
 *   --positionId <id>      Position to test (required unless --auto)
 *   --currentPrice <n>     Override current price (0-1)
 *   --pnlPercent <n>       Override PnL percentage (e.g. 25 for +25%)
 *   --persist              Push the exit into the pending queue (extension will pick it up)
 *   --auto                 Auto-mode: fetch first position, auto-calculate trigger values, persist
 *   --api <url>            Backend URL (default: http://localhost:3000)
 *
 * Examples:
 *   # Auto-mode: one command to demo the full pipeline
 *   npx tsx scripts/test-auto-exit.ts --auto --installId <id>
 *
 *   # Manual: test a specific position with a specific pnl override
 *   npx tsx scripts/test-auto-exit.ts --installId abc --positionId xyz --pnlPercent 25 --persist
 */

const API_BASE = parseArg('--api') ?? 'http://localhost:3000';

function parseArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function log(msg: string) {
  console.log(msg);
}

function step(n: number, msg: string) {
  console.log(`\n[${n}] ${msg}`);
}

function success(msg: string) {
  console.log(`    ✓ ${msg}`);
}

function info(msg: string) {
  console.log(`    → ${msg}`);
}

function warn(msg: string) {
  console.log(`    ⚠ ${msg}`);
}

function noPositionsExit(): never {
  console.error('\n✗ No registered positions found for this installId.');
  console.error('  Sync positions first: open the extension, connect a wallet (or use guest),');
  console.error('  and wait for the sidepanel to load positions. The extension syncs every 15s.');
  process.exit(1);
}

async function fetchJSON(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

interface SyncedPosition {
  id: string;
  marketId: string;
  marketQuestion: string;
  tokenId: string;
  side: 'yes' | 'no';
  shares: string;
  avgPrice: number;
  currentPrice: number;
  pnlPercent: number;
}

interface AutoExitRule {
  id: string;
  type: 'pnl_gain' | 'pnl_loss' | 'risk_score' | 'price_target';
  threshold: number;
  action: 'exit_full' | 'exit_half';
  enabled: boolean;
}

interface TestExitResponse {
  triggered: boolean;
  message?: string;
  triggeredRule?: AutoExitRule;
  testPosition?: SyncedPosition;
  aiResult?: { confirm: boolean; reasoning: string; confidence: number };
  pendingExit?: unknown;
  persisted?: boolean;
  rules?: AutoExitRule[];
}

function autoCalculateOverrides(
  position: SyncedPosition,
  rules: AutoExitRule[]
): { overrides: { currentPrice?: number; pnlPercent?: number }; rule: AutoExitRule } | null {
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return null;

  for (const rule of enabledRules) {
    switch (rule.type) {
      case 'pnl_gain':
        // Set pnlPercent 10 percentage points above threshold
        return { overrides: { pnlPercent: rule.threshold * 100 + 10 }, rule };
      case 'pnl_loss':
        // Set pnlPercent 10 points below (more negative than) threshold
        return { overrides: { pnlPercent: rule.threshold * 100 - 10 }, rule };
      case 'risk_score':
        // Risk = 1 - |price - 0.5| * 2; risk >= threshold when price near 0.5
        // Set price to 0.5 (maximum risk = 1.0)
        return { overrides: { currentPrice: 0.5 }, rule };
      case 'price_target':
        // Set price above threshold
        return { overrides: { currentPrice: rule.threshold + 0.05 }, rule };
    }
  }
  return null;
}

async function run() {
  const isAuto = hasFlag('--auto');
  const persist = hasFlag('--persist') || isAuto;
  const installId = parseArg('--installId');
  let positionId = parseArg('--positionId');
  let currentPrice = parseArg('--currentPrice') ? parseFloat(parseArg('--currentPrice')!) : undefined;
  let pnlPercent = parseArg('--pnlPercent') ? parseFloat(parseArg('--pnlPercent')!) : undefined;

  if (!installId) {
    console.error('Error: --installId is required');
    console.error('Tip: Find your installId in chrome.storage.local (key: installId) or browser console');
    process.exit(1);
  }

  log('\n═══════════════════════════════════════════════');
  log('  Taurus Auto-Exit Pipeline Test');
  log('═══════════════════════════════════════════════');
  log(`  Backend: ${API_BASE}`);
  log(`  Install: ${installId}`);
  if (isAuto) log('  Mode:    AUTO (one-command demo)');
  log('');

  // Step 1: Health check
  step(1, 'Checking backend health...');
  try {
    const health = await fetchJSON('/health') as { status: string };
    success(`Backend online (${health.status})`);
  } catch {
    console.error('\n✗ Backend is not reachable at ' + API_BASE);
    console.error('  Start it with: npm run dev:api');
    process.exit(1);
  }

  // Step 2: In auto mode, look up registered positions
  if (isAuto && !positionId) {
    step(2, 'Fetching registered positions for installId...');

    // We'll use the test-exit endpoint with a dummy positionId to get the list
    // Actually let's try the pending endpoint to verify installId is registered
    try {
      const pending = await fetchJSON(`/api/automation/pending?installId=${encodeURIComponent(installId)}`) as { pendingExits: unknown[] };
      info(`Found ${pending.pendingExits.length} existing pending exits`);
    } catch {
      warn('Could not fetch pending exits — installId may not be synced yet');
    }

    // Probe test-exit with a placeholder; backend returns 404 with "Available: id1, id2, ..."
    try {
      const res = await fetch(`${API_BASE}/api/automation/test-exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installId,
          positionId: '__probe__',
          overrides: {},
        }),
      });
      const body = (await res.json()) as { error?: string };

      if (res.status === 404 && body.error?.includes('Available:')) {
        const match = body.error.match(/Available: (.+)/);
        if (match && match[1] && match[1].trim() !== 'none') {
          const ids = match[1].split(',').map((s) => s.trim()).filter(Boolean);
          if (ids.length > 0) {
            positionId = ids[0];
            success(`Auto-selected position: ${positionId}`);
          } else {
            noPositionsExit();
          }
        } else {
          noPositionsExit();
        }
      } else if (!res.ok) {
        console.error('\n✗ Backend returned ' + res.status + (body.error ? ': ' + body.error : ''));
        process.exit(1);
      }
    } catch (err) {
      console.error('\n✗ Could not probe positions. Is the backend running?', (err as Error).message);
      process.exit(1);
    }
  } else {
    step(2, 'Using specified position...');
    success(`Position ID: ${positionId}`);
  }

  if (!positionId) {
    console.error('\nError: --positionId is required (or use --auto)');
    process.exit(1);
  }

  // Step 3: Get position details and rules, auto-calculate overrides if needed
  step(3, 'Calculating trigger overrides...');

  let overrides: { currentPrice?: number; pnlPercent?: number } = {};
  if (currentPrice !== undefined) overrides.currentPrice = currentPrice;
  if (pnlPercent !== undefined) overrides.pnlPercent = pnlPercent;

  if (isAuto && Object.keys(overrides).length === 0) {
    // Probe to get position and rules info
    try {
      const probe = await fetchJSON('/api/automation/test-exit', {
        method: 'POST',
        body: JSON.stringify({ installId, positionId, overrides: {} }),
      }) as TestExitResponse;

      if (!probe.triggered && probe.testPosition && probe.rules) {
        const calc = autoCalculateOverrides(probe.testPosition, probe.rules);
        if (calc) {
          overrides = calc.overrides;
          info(`Auto-calculated overrides to trigger rule: ${calc.rule.type} (threshold: ${calc.rule.threshold})`);
          if (overrides.pnlPercent !== undefined) info(`  pnlPercent → ${overrides.pnlPercent.toFixed(1)}%`);
          if (overrides.currentPrice !== undefined) info(`  currentPrice → ${overrides.currentPrice}`);
        }
      } else if (probe.triggered) {
        info('Position already triggers a rule without overrides — running as-is');
      }
    } catch (err) {
      warn(`Could not probe position: ${(err as Error).message}`);
    }
  } else if (Object.keys(overrides).length > 0) {
    if (overrides.pnlPercent !== undefined) info(`pnlPercent override: ${overrides.pnlPercent}%`);
    if (overrides.currentPrice !== undefined) info(`currentPrice override: ${overrides.currentPrice}`);
  } else {
    info('No overrides specified — testing with current values');
  }

  // Step 4: Run the test
  step(4, 'Running auto-exit pipeline...');

  let result: TestExitResponse;
  try {
    result = await fetchJSON('/api/automation/test-exit', {
      method: 'POST',
      body: JSON.stringify({ installId, positionId, overrides, persist }),
    }) as TestExitResponse;
  } catch (err) {
    console.error(`\n✗ Test-exit request failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!result.triggered) {
    warn('No rules triggered with the given position/overrides.');
    if (result.rules && result.rules.length > 0) {
      info('Enabled rules:');
      for (const rule of result.rules) {
        info(`  ${rule.type}: threshold=${rule.threshold}, action=${rule.action}`);
      }
    }
    if (result.testPosition) {
      info(`Position state: price=${result.testPosition.currentPrice}, pnl=${result.testPosition.pnlPercent}%`);
    }
    info('Try using --pnlPercent or --currentPrice to override values that cross a threshold.');
    process.exit(0);
  }

  success('Threshold rule triggered!');
  if (result.triggeredRule) {
    info(`Rule: ${result.triggeredRule.type} (threshold: ${result.triggeredRule.threshold}, action: ${result.triggeredRule.action})`);
  }
  if (result.testPosition) {
    info(`Market: "${result.testPosition.marketQuestion}"`);
    info(`Side: ${result.testPosition.side.toUpperCase()}, Shares: ${result.testPosition.shares}`);
    info(`Price: ${result.testPosition.currentPrice}, PnL: ${result.testPosition.pnlPercent}%`);
  }

  // Step 5: AI evaluation result
  step(5, 'AI evaluation result...');
  if (result.aiResult) {
    const { confirm, reasoning, confidence } = result.aiResult;
    if (confirm) {
      success(`AI confirmed exit (confidence: ${(confidence * 100).toFixed(0)}%)`);
    } else {
      warn(`AI overrode exit (confidence: ${(confidence * 100).toFixed(0)}%)`);
    }
    info(`Reasoning: "${reasoning}"`);
  }

  // Step 6: Persistence result
  step(6, persist ? 'Checking if exit was queued...' : 'Persistence skipped (use --persist to queue)');
  if (persist) {
    if (result.persisted) {
      success('Exit queued in pending exits!');
      info('The extension will pick this up within 15 seconds via the auto-exit alarm.');
      info('Check the Insights tab in the sidepanel — a PendingExitBanner should appear.');
    } else if (result.aiResult && !result.aiResult.confirm) {
      warn('Exit was NOT queued because AI overrode it.');
    }
  } else {
    info('Run with --persist to push this exit into the extension\'s pending queue.');
  }

  log('\n═══════════════════════════════════════════════');
  log('  Test complete');
  log('═══════════════════════════════════════════════\n');
}

run().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
