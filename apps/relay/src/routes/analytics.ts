import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/v1/analytics/mrr', async (request, reply) => {
    const operatorId = request.operatorId;

    const currentResult = await db.query(
      `SELECT COALESCE(SUM(amount_usdc * 30.0 / interval_days), 0) AS mrr
       FROM subscriptions
       WHERE operator_id = $1 AND status = 'active'`,
      [operatorId],
    );

    // Approximate previous MRR by looking at subscriptions active 30 days ago
    const previousResult = await db.query(
      `SELECT COALESCE(SUM(amount_usdc * 30.0 / interval_days), 0) AS mrr
       FROM subscriptions
       WHERE operator_id = $1
         AND status IN ('active','past_due')
         AND created_at <= NOW() - INTERVAL '30 days'`,
      [operatorId],
    );

    const current = Number(currentResult.rows[0]?.['mrr'] ?? 0);
    const previous = Number(previousResult.rows[0]?.['mrr'] ?? 0);
    const changePercent = previous === 0 ? 0 : ((current - previous) / previous) * 100;

    return reply.send({
      currentMrr: current,
      previousMrr: previous,
      changePercent: Math.round(changePercent * 100) / 100,
    });
  });

  app.get('/v1/analytics/churn', async (request, reply) => {
    const operatorId = request.operatorId;

    const cancelledResult = await db.query(
      `SELECT COUNT(*) AS cancelled
       FROM subscriptions
       WHERE operator_id = $1
         AND status = 'cancelled'
         AND created_at >= NOW() - INTERVAL '30 days'`,
      [operatorId],
    );

    const activeResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM subscriptions
       WHERE operator_id = $1 AND status = 'active'`,
      [operatorId],
    );

    const cancelled = Number(cancelledResult.rows[0]?.['cancelled'] ?? 0);
    const total = Number(activeResult.rows[0]?.['total'] ?? 0);
    const churnRate = total === 0 ? 0 : (cancelled / (total + cancelled)) * 100;

    return reply.send({
      churnRate: Math.round(churnRate * 100) / 100,
      cancelledLast30Days: cancelled,
      totalActive: total,
    });
  });
}
