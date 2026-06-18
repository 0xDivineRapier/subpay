import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import crypto from 'node:crypto';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/webhooks',
    {
      schema: {
        body: Type.Object({
          url: Type.String({ format: 'uri' }),
          events: Type.Array(Type.String()),
        }),
      },
    },
    async (request, reply) => {
      const { url, events } = request.body as { url: string; events: string[] };
      const secret = crypto.randomBytes(32).toString('hex');

      const result = await db.query(
        `INSERT INTO webhook_endpoints (operator_id, url, secret, events)
         VALUES ($1, $2, $3, $4) RETURNING id, url, events, is_active, created_at`,
        [request.operatorId, url, secret, events],
      );

      return reply.status(201).send({
        ...result.rows[0],
        secret,
        note: 'Store this secret securely — it will not be shown again',
      });
    },
  );

  app.get('/v1/webhooks', async (request, reply) => {
    const result = await db.query(
      `SELECT id, url, events, is_active, created_at
       FROM webhook_endpoints WHERE operator_id = $1`,
      [request.operatorId],
    );
    return reply.send(result.rows);
  });

  app.get('/v1/webhooks/:id/logs', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify endpoint belongs to operator
    const ep = await db.query(
      'SELECT id FROM webhook_endpoints WHERE id = $1 AND operator_id = $2',
      [id, request.operatorId],
    );
    if (ep.rows.length === 0) {
      return reply.status(404).send({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Not found' });
    }

    const result = await db.query(
      `SELECT * FROM webhook_deliveries WHERE endpoint_id = $1
       ORDER BY last_attempted_at DESC LIMIT 100`,
      [id],
    );

    return reply.send(result.rows);
  });
}
