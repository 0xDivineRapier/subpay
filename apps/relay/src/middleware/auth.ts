import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { db } from '../db/client.js';

declare module 'fastify' {
  interface FastifyRequest {
    operatorId: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (!token.startsWith('sk_')) {
    reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid API key format' });
    return;
  }

  const prefix = token.slice(0, 12);

  const result = await db.query(
    `SELECT id, operator_id, key_hash FROM api_keys
     WHERE key_prefix = $1 AND is_active = TRUE AND revoked_at IS NULL`,
    [prefix],
  );

  if (result.rows.length === 0) {
    reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid API key' });
    return;
  }

  const row = result.rows[0] as { id: string; operator_id: string; key_hash: string };
  const valid = await bcrypt.compare(token, row.key_hash);

  if (!valid) {
    reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid API key' });
    return;
  }

  request.operatorId = row.operator_id;
}
