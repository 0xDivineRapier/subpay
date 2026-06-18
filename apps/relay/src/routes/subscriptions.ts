import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const PlanSchema = Type.Object({
  name: Type.String(),
  amountUsdc: Type.Number({ minimum: 0.01, maximum: 10000 }),
  intervalDays: Type.Integer({ minimum: 1, maximum: 365 }),
  maxAmountUsdc: Type.Number({ minimum: 0.01 }),
  expiryDate: Type.String({ format: 'date-time' }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
});

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/subscriptions',
    {
      schema: {
        body: Type.Object({
          walletAddress: Type.String(),
          plan: PlanSchema,
          delegationTxSignature: Type.Optional(Type.String()),
        }),
      },
    },
    async (request, reply) => {
      const { walletAddress, plan, delegationTxSignature } = request.body as {
        walletAddress: string;
        plan: {
          name: string;
          amountUsdc: number;
          intervalDays: number;
          maxAmountUsdc: number;
          expiryDate: string;
          metadata?: Record<string, string>;
        };
        delegationTxSignature?: string;
      };

      if (plan.maxAmountUsdc < plan.amountUsdc) {
        return reply.status(400).send({
          code: 'INVALID_PLAN',
          message: 'maxAmountUsdc must be >= amountUsdc',
        });
      }

      const nextChargeAt = new Date();
      const result = await db.query(
        `INSERT INTO subscriptions
          (operator_id, wallet_address, plan_name, amount_usdc, interval_days,
           max_amount_usdc, expiry_date, delegation_tx_signature, next_charge_at, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          request.operatorId,
          walletAddress,
          plan.name,
          plan.amountUsdc,
          plan.intervalDays,
          plan.maxAmountUsdc,
          plan.expiryDate,
          delegationTxSignature ?? null,
          nextChargeAt,
          JSON.stringify(plan.metadata ?? {}),
        ],
      );

      return reply.status(201).send(toSubscription(result.rows[0]));
    },
  );

  app.get('/v1/subscriptions', async (request, reply) => {
    const query = request.query as {
      status?: string;
      wallet?: string;
      limit?: string;
      offset?: string;
    };

    const conditions: string[] = ['operator_id = $1'];
    const params: unknown[] = [request.operatorId];
    let i = 2;

    if (query.status) {
      conditions.push(`status = $${i++}`);
      params.push(query.status);
    }
    if (query.wallet) {
      conditions.push(`wallet_address = $${i++}`);
      params.push(query.wallet);
    }

    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);
    const offset = parseInt(query.offset ?? '0', 10);
    params.push(limit, offset);

    const result = await db.query(
      `SELECT * FROM subscriptions WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      params,
    );

    return reply.send(result.rows.map(toSubscription));
  });

  app.get('/v1/subscriptions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await db.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND operator_id = $2',
      [id, request.operatorId],
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Not found' });
    }
    return reply.send(toSubscription(result.rows[0]));
  });

  for (const action of ['cancel', 'pause', 'resume'] as const) {
    const statusMap = { cancel: 'cancelled', pause: 'paused', resume: 'active' } as const;

    app.post(`/v1/subscriptions/:id/${action}`, async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await db.query(
        `UPDATE subscriptions SET status = $1
         WHERE id = $2 AND operator_id = $3
         RETURNING *`,
        [statusMap[action], id, request.operatorId],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Not found' });
      }
      return reply.send(toSubscription(result.rows[0]));
    });
  }
}

function toSubscription(row: Record<string, unknown>) {
  return {
    id: row['id'],
    walletAddress: row['wallet_address'],
    plan: {
      name: row['plan_name'],
      amountUsdc: Number(row['amount_usdc']),
      intervalDays: row['interval_days'],
      maxAmountUsdc: Number(row['max_amount_usdc']),
      expiryDate: row['expiry_date'],
    },
    status: row['status'],
    delegationTxSignature: row['delegation_tx_signature'] ?? '',
    createdAt: row['created_at'],
    lastChargeAt: row['last_charge_at'] ?? null,
    nextChargeAt: row['next_charge_at'],
    retryCount: row['retry_count'],
    metadata: row['metadata'],
  };
}
