import type { FastifyInstance } from 'fastify';
import type { AutoExitConfig, AutoSyncRequest, AutoSyncResponse, PendingExit } from '@taurus/types';
import {
  registerPositions,
  evaluateUser,
  getPendingExits,
  dismissExit,
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
}
