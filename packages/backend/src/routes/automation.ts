import type { FastifyInstance } from 'fastify';
import type { AutoExitConfig, AutoSyncRequest, AutoSyncResponse, PendingExit } from '@taurus/types';
import {
  registerPositions,
  evaluateUser,
  getPendingExits,
  dismissExit,
  getRegisteredPositions,
  getRegisteredConfig,
  checkThresholds,
  evaluateWithAI,
  queuePendingExit,
} from '../services/automation/monitor.js';

export async function automationPlugin(server: FastifyInstance) {
  // Sync positions and config, then run evaluation
  server.post<{
    Body: AutoSyncRequest;
  }>('/api/automation/sync', async (request, reply) => {
    const { installId, positions, config } = request.body;

    if (!installId || !Array.isArray(positions) || !config) {
      return reply.status(400).send({ error: 'Missing installId, positions, or config' });
    }

    registerPositions(installId, positions, config);

    const pendingExits = await evaluateUser(installId);
    const response: AutoSyncResponse = { pendingExits };
    return response;
  });

  // Save/update user's auto-exit config (called when user edits rules in UI)
  server.put<{
    Body: { installId: string; config: AutoExitConfig };
  }>('/api/automation/config', async (request, reply) => {
    const { installId, config } = request.body;

    if (!installId || !config) {
      return reply.status(400).send({ error: 'Missing installId or config' });
    }

    // Register with empty positions — positions come via /sync
    registerPositions(installId, [], config);
    return { success: true };
  });

  // Poll pending exits (lightweight — no evaluation, just returns queue)
  server.get<{
    Querystring: { installId: string };
  }>('/api/automation/pending', async (request, reply) => {
    const installId = request.query.installId;
    if (!installId) {
      return reply.status(400).send({ error: 'Missing installId' });
    }

    const pendingExits = getPendingExits(installId);
    return { pendingExits };
  });

  // Dismiss a pending exit
  server.post<{
    Body: { installId: string; positionId: string };
  }>('/api/automation/dismiss', async (request, reply) => {
    const { installId, positionId } = request.body;

    if (!installId || !positionId) {
      return reply.status(400).send({ error: 'Missing installId or positionId' });
    }

    const dismissed = dismissExit(installId, positionId);
    return { success: dismissed };
  });

  // Test auto-exit pipeline with overridden position data (for demo/testing)
  server.post<{
    Body: {
      installId: string;
      positionId: string;
      overrides: { currentPrice?: number; pnlPercent?: number };
      persist?: boolean;
    };
  }>('/api/automation/test-exit', async (request, reply) => {
    const { installId, positionId, overrides, persist } = request.body;

    if (!installId || !positionId) {
      return reply.status(400).send({ error: 'Missing installId or positionId' });
    }

    const positions = getRegisteredPositions(installId);
    const config = getRegisteredConfig(installId);

    if (!config) {
      return reply.status(404).send({ error: 'No registered config for this installId. Sync positions first.' });
    }

    const position = positions.find((p) => p.id === positionId);
    if (!position) {
      return reply.status(404).send({
        error: `Position ${positionId} not found. Available: ${positions.map((p) => p.id).join(', ') || 'none'}`,
      });
    }

    // Clone with overrides applied
    const testPosition = {
      ...position,
      ...(overrides.currentPrice !== undefined ? { currentPrice: overrides.currentPrice } : {}),
      ...(overrides.pnlPercent !== undefined ? { pnlPercent: overrides.pnlPercent } : {}),
    };

    const triggered = checkThresholds([testPosition], config.rules);

    if (triggered.length === 0) {
      return {
        triggered: false,
        message: 'No rules triggered with the given overrides.',
        testPosition,
        rules: config.rules.filter((r) => r.enabled),
      };
    }

    const { rule } = triggered[0];
    const aiResult = await evaluateWithAI(testPosition, rule);

    let pendingExit: PendingExit | null = null;
    if (aiResult.confirm) {
      pendingExit = {
        positionId: testPosition.id,
        marketId: testPosition.marketId,
        marketQuestion: testPosition.marketQuestion,
        tokenId: testPosition.tokenId,
        side: testPosition.side,
        shares:
          rule.action === 'exit_half'
            ? (parseFloat(testPosition.shares) / 2).toString()
            : testPosition.shares,
        currentPrice: testPosition.currentPrice,
        triggeredRule: rule,
        aiReasoning: aiResult.reasoning,
        aiConfidence: aiResult.confidence,
        timestamp: new Date().toISOString(),
      };

      if (persist) {
        queuePendingExit(installId, pendingExit);
        console.log(`[TestExit] Queued pending exit for ${testPosition.marketQuestion}`);
      }
    }

    return {
      triggered: true,
      triggeredRule: rule,
      testPosition,
      aiResult,
      pendingExit,
      persisted: persist && aiResult.confirm,
    };
  });
}
