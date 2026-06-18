import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { getChargeQueue, getWebhookQueue } from '../services/scheduler.js';

export async function relayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/v1/relay/balance', async (request, reply) => {
    const logResult = await db.query(
      `SELECT sol_balance, recorded_at FROM relay_balance_log
       WHERE operator_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [request.operatorId],
    );

    const solBalance = logResult.rows.length > 0
      ? Number((logResult.rows[0] as { sol_balance: string }).sol_balance)
      : 0;

    return reply.send({
      solBalance,
      estimatedChargesRemaining: Math.floor(solBalance / 0.000005),
      lastRecorded: logResult.rows.length > 0
        ? (logResult.rows[0] as { recorded_at: string }).recorded_at
        : null,
    });
  });
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let chargeQueueDepth = 0;
    let webhookQueueDepth = 0;
    let relayBalance = 0;

    try {
      chargeQueueDepth = await getChargeQueue().count();
      webhookQueueDepth = await getWebhookQueue().count();

      const logResult = await db.query(
        `SELECT sol_balance FROM relay_balance_log ORDER BY recorded_at DESC LIMIT 1`,
      );
      if (logResult.rows.length > 0) {
        relayBalance = Number((logResult.rows[0] as { sol_balance: string }).sol_balance);
      }
    } catch {
      // Non-fatal — health check still returns ok
    }

    return reply.send({
      status: 'ok',
      relayBalance,
      chargeQueueDepth,
      webhookQueueDepth,
      timestamp: new Date().toISOString(),
    });
  });
}
