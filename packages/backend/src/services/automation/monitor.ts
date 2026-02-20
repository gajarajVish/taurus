import type { AutoExitConfig, AutoExitRule, PendingExit } from '@taurus/types';

// Position data synced from extension
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

interface UserState {
  positions: SyncedPosition[];
  config: AutoExitConfig;
  pendingExits: Map<string, PendingExit>;
  lastCheck: number;
}

const users = new Map<string, UserState>();

const CHECK_COOLDOWN_MS = 15_000;

export function registerPositions(
  installId: string,
  positions: SyncedPosition[],
  exitConfig: AutoExitConfig
): void {
  const existing = users.get(installId);
  users.set(installId, {
    positions,
    config: exitConfig,
    pendingExits: existing?.pendingExits ?? new Map(),
    lastCheck: existing?.lastCheck ?? 0,
  });
}

// Pure threshold check — no AI, no side effects
export function checkThresholds(
  positions: SyncedPosition[],
  rules: AutoExitRule[]
): Array<{ position: SyncedPosition; rule: AutoExitRule }> {
  const triggered: Array<{ position: SyncedPosition; rule: AutoExitRule }> = [];

  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return triggered;

  for (const pos of positions) {
    for (const rule of enabledRules) {
      let hit = false;

      switch (rule.type) {
        case 'pnl_gain':
          hit = pos.pnlPercent / 100 >= rule.threshold;
          break;
        case 'pnl_loss':
          // threshold is negative (e.g. -0.15), pnlPercent is e.g. -18 → -0.18
          hit = pos.pnlPercent / 100 <= rule.threshold;
          break;
        case 'risk_score':
          // Approximate risk = 1 - abs(currentPrice - 0.5) * 2
          // Price near 0 or 1 → low risk, near 0.5 → high risk
          const riskScore = 1 - Math.abs(pos.currentPrice - 0.5) * 2;
          hit = riskScore >= rule.threshold;
          break;
        case 'price_target':
          hit = pos.currentPrice >= rule.threshold;
          break;
      }

      if (hit) {
        triggered.push({ position: pos, rule });
        break; // one trigger per position is enough
      }
    }
  }

  return triggered;
}

export function getRegisteredPositions(installId: string): SyncedPosition[] {
  const state = users.get(installId);
  return state?.positions ?? [];
}

export function getRegisteredConfig(installId: string): AutoExitConfig | null {
  const state = users.get(installId);
  return state?.config ?? null;
}

export function queuePendingExit(installId: string, exit: PendingExit): void {
  const state = users.get(installId);
  if (state) {
    state.pendingExits.set(exit.positionId, exit);
  }
}

// Send to 0G for evaluation — adds context and filtering
export async function evaluateWithAI(
  position: SyncedPosition,
  rule: AutoExitRule
): Promise<{ confirm: boolean; reasoning: string; confidence: number }> {
  const inference = await import('../og/inference.js');

  if (!(await inference.isOGAvailable())) {
    return buildLocalEvaluation(position, rule);
  }

  try {
    const prompt = buildAIPrompt(position, rule);
    const result = await inference.evaluateExitSignal(prompt);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in 0G response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      confirm: Boolean(parsed.confirm),
      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : 'AI evaluation completed.',
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
    };
  } catch (err) {
    console.warn(
      '[Automation] 0G evaluation failed, using local:',
      (err as Error).message
    );
    return buildLocalEvaluation(position, rule);
  }
}

function buildAIPrompt(position: SyncedPosition, rule: AutoExitRule): string {
  const pnlSign = position.pnlPercent >= 0 ? '+' : '';
  const ruleDesc =
    rule.type === 'pnl_gain'
      ? `${(rule.threshold * 100).toFixed(0)}% profit-taking threshold`
      : rule.type === 'pnl_loss'
        ? `${(rule.threshold * 100).toFixed(0)}% stop-loss threshold`
        : rule.type === 'risk_score'
          ? `${(rule.threshold * 100).toFixed(0)}% risk score threshold`
          : `price target of ${rule.threshold}`;

  return `Evaluate this auto-exit signal for a prediction market position:

Position: "${position.marketQuestion}"
Side: ${position.side.toUpperCase()}
Shares: ${position.shares}
Avg Price: ${position.avgPrice.toFixed(3)}
Current Price: ${position.currentPrice.toFixed(3)}
PnL: ${pnlSign}${position.pnlPercent.toFixed(1)}%
Triggered Rule: ${ruleDesc}
Action: ${rule.action === 'exit_full' ? 'Full exit' : 'Exit half position'}

Should the user execute this exit? Consider:
- Is the PnL signal genuine or noise?
- Is the current price near an extreme (0 or 1) suggesting the market is settled?
- Would exiting now capture meaningful value?

Respond ONLY with JSON: {"confirm": true/false, "reasoning": "<1-2 sentences>", "confidence": <0-1>}`;
}

function buildLocalEvaluation(
  position: SyncedPosition,
  rule: AutoExitRule
): { confirm: boolean; reasoning: string; confidence: number } {
  const pnl = position.pnlPercent / 100;

  if (rule.type === 'pnl_gain') {
    if (pnl > rule.threshold * 1.5) {
      return {
        confirm: true,
        reasoning: `Position is up ${position.pnlPercent.toFixed(1)}%, well above the ${(rule.threshold * 100).toFixed(0)}% target. Taking profits is prudent.`,
        confidence: 0.85,
      };
    }
    return {
      confirm: true,
      reasoning: `Position hit the ${(rule.threshold * 100).toFixed(0)}% gain threshold at ${position.pnlPercent.toFixed(1)}%.`,
      confidence: 0.7,
    };
  }

  if (rule.type === 'pnl_loss') {
    return {
      confirm: true,
      reasoning: `Position is down ${position.pnlPercent.toFixed(1)}%, breaching the ${(rule.threshold * 100).toFixed(0)}% stop-loss. Cutting losses to preserve capital.`,
      confidence: 0.8,
    };
  }

  if (rule.type === 'risk_score') {
    const risk = 1 - Math.abs(position.currentPrice - 0.5) * 2;
    return {
      confirm: risk > 0.9,
      reasoning: `Market price at ${position.currentPrice.toFixed(3)} indicates ${risk > 0.9 ? 'extreme' : 'elevated'} uncertainty (risk score: ${(risk * 100).toFixed(0)}%).`,
      confidence: 0.65,
    };
  }

  return { confirm: true, reasoning: 'Threshold condition met.', confidence: 0.6 };
}

// Run the check loop for a given user — called from the API route
export async function evaluateUser(installId: string): Promise<PendingExit[]> {
  const state = users.get(installId);
  if (!state || !state.config.enabled) return [];

  const now = Date.now();
  if (now - state.lastCheck < CHECK_COOLDOWN_MS) {
    return [...state.pendingExits.values()];
  }
  state.lastCheck = now;

  const triggered = checkThresholds(state.positions, state.config.rules);

  for (const { position, rule } of triggered) {
    // Skip if already pending
    if (state.pendingExits.has(position.id)) continue;

    const ai = await evaluateWithAI(position, rule);

    if (!ai.confirm) {
      console.log(
        `[Automation] AI overrode exit for ${position.id}: ${ai.reasoning}`
      );
      continue;
    }

    const exit: PendingExit = {
      positionId: position.id,
      marketId: position.marketId,
      marketQuestion: position.marketQuestion,
      tokenId: position.tokenId,
      side: position.side,
      shares:
        rule.action === 'exit_half'
          ? (parseFloat(position.shares) / 2).toString()
          : position.shares,
      currentPrice: position.currentPrice,
      triggeredRule: rule,
      aiReasoning: ai.reasoning,
      aiConfidence: ai.confidence,
      timestamp: new Date().toISOString(),
    };

    state.pendingExits.set(position.id, exit);
    console.log(
      `[Automation] Pending exit queued: ${position.marketQuestion} (${rule.type} ${rule.threshold})`
    );
  }

  return [...state.pendingExits.values()];
}

export function getPendingExits(installId: string): PendingExit[] {
  const state = users.get(installId);
  return state ? [...state.pendingExits.values()] : [];
}

export function dismissExit(installId: string, positionId: string): boolean {
  const state = users.get(installId);
  if (!state) return false;
  return state.pendingExits.delete(positionId);
}
