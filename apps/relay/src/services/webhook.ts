import crypto from 'node:crypto';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client.js';
import { getWebhookQueue, WebhookJobData } from './scheduler.js';

const logger = pino({ name: 'webhook' });

export interface WebhookEventPayload {
  id: string;
  type: string;
  createdAt: string;
  data: {
    subscriptionId: string;
    walletAddress: string;
    amountUsdc: number;
    txSignature?: string;
    failureReason?: string;
    retryCount?: number;
    nextRetryAt?: string;
  };
}

/** Maximum delivery attempts before permanent failure */
const MAX_WEBHOOK_ATTEMPTS = 5;

const WEBHOOK_RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];

/**
 * Enqueues a webhook event for async delivery to all active endpoints.
 * Never blocks charge execution — always enqueue, never await delivery.
 */
export async function enqueueWebhookEvent(
  event: WebhookEventPayload,
  operatorId: string,
): Promise<void> {
  const queue = getWebhookQueue();

  const jobData: WebhookJobData = {
    eventType: event.type,
    eventId: event.id,
    operatorId,
    subscriptionId: event.data.subscriptionId,
    walletAddress: event.data.walletAddress,
    amountUsdc: event.data.amountUsdc,
    txSignature: event.data.txSignature,
    failureReason: event.data.failureReason,
    retryCount: event.data.retryCount,
    nextRetryAt: event.data.nextRetryAt,
  };

  await queue.add(`webhook:${event.type}:${event.id}`, jobData, {
    jobId: `webhook:${event.id}`,
  });

  logger.info({ eventType: event.type, eventId: event.id, operatorId }, 'Webhook event enqueued');
}

/**
 * Processes a webhook job: finds active endpoints, signs and delivers payload.
 * Retry state is managed per delivery record in webhook_deliveries.
 */
export async function processWebhookJob(data: WebhookJobData): Promise<void> {
  const endpointsResult = await db.query(
    `SELECT id, url, secret, events FROM webhook_endpoints
     WHERE operator_id = $1 AND is_active = TRUE`,
    [data.operatorId],
  );

  const payload: WebhookEventPayload = {
    id: data.eventId,
    type: data.eventType,
    createdAt: new Date().toISOString(),
    data: {
      subscriptionId: data.subscriptionId,
      walletAddress: data.walletAddress,
      amountUsdc: data.amountUsdc,
      ...(data.txSignature ? { txSignature: data.txSignature } : {}),
      ...(data.failureReason ? { failureReason: data.failureReason } : {}),
      ...(data.retryCount !== undefined ? { retryCount: data.retryCount } : {}),
      ...(data.nextRetryAt ? { nextRetryAt: data.nextRetryAt } : {}),
    },
  };

  for (const endpoint of endpointsResult.rows as Array<{
    id: string;
    url: string;
    secret: string;
    events: string[];
  }>) {
    if (!endpoint.events.includes(data.eventType) && !endpoint.events.includes('*')) {
      continue;
    }

    await deliverToEndpoint(endpoint, payload, data.eventType);
  }
}

async function deliverToEndpoint(
  endpoint: { id: string; url: string; secret: string },
  payload: WebhookEventPayload,
  eventType: string,
): Promise<void> {
  // Find or create delivery record
  const existingResult = await db.query(
    `SELECT id, attempt_count FROM webhook_deliveries
     WHERE endpoint_id = $1 AND payload->>'id' = $2`,
    [endpoint.id, payload.id],
  );

  let deliveryId: string;
  let attemptCount: number;

  if (existingResult.rows.length > 0) {
    const row = existingResult.rows[0] as { id: string; attempt_count: number };
    deliveryId = row.id;
    attemptCount = row.attempt_count;
  } else {
    const insertResult = await db.query(
      `INSERT INTO webhook_deliveries
         (endpoint_id, event_type, payload, status, attempt_count)
       VALUES ($1, $2, $3, 'pending', 0) RETURNING id`,
      [endpoint.id, eventType, JSON.stringify(payload)],
    );
    deliveryId = (insertResult.rows[0] as { id: string }).id;
    attemptCount = 0;
  }

  if (attemptCount >= MAX_WEBHOOK_ATTEMPTS) {
    logger.error({ deliveryId, endpoint: endpoint.url }, 'Webhook delivery permanently failed');
    await db.query(
      `UPDATE webhook_deliveries SET status = 'failed' WHERE id = $1`,
      [deliveryId],
    );
    return;
  }

  const bodyStr = JSON.stringify(payload);
  const hmac = crypto
    .createHmac('sha256', endpoint.secret)
    .update(bodyStr)
    .digest('hex');

  await db.query(
    `UPDATE webhook_deliveries
     SET status = 'retrying', attempt_count = attempt_count + 1, last_attempted_at = NOW()
     WHERE id = $1`,
    [deliveryId],
  );

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SubPay-Signature': `sha256=${hmac}`,
        'X-SubPay-Event': eventType,
      },
      body: bodyStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      await db.query(
        `UPDATE webhook_deliveries
         SET status = 'delivered', delivered_at = NOW(), response_status = $1
         WHERE id = $2`,
        [response.status, deliveryId],
      );
      logger.info({ deliveryId, endpoint: endpoint.url, status: response.status }, 'Webhook delivered');
      return;
    }

    logger.warn(
      { deliveryId, endpoint: endpoint.url, status: response.status, attempt: attemptCount + 1 },
      'Webhook delivery non-200',
    );
    await db.query(
      `UPDATE webhook_deliveries SET status = 'failed', response_status = $1 WHERE id = $2`,
      [response.status, deliveryId],
    );
  } catch (err) {
    logger.warn({ deliveryId, endpoint: endpoint.url, err }, 'Webhook delivery failed');
    await db.query(
      `UPDATE webhook_deliveries SET status = 'failed' WHERE id = $1`,
      [deliveryId],
    );
  }

  // Schedule retry if attempts remain
  if (attemptCount + 1 < MAX_WEBHOOK_ATTEMPTS) {
    const delayMs = WEBHOOK_RETRY_DELAYS_MS[attemptCount] ?? 7_200_000;
    const queue = getWebhookQueue();
    await queue.add(
      `webhook-retry:${payload.id}:${endpoint.id}:${attemptCount + 1}`,
      {
        eventType,
        eventId: payload.id,
        operatorId: '',
        subscriptionId: payload.data.subscriptionId,
        walletAddress: payload.data.walletAddress,
        amountUsdc: payload.data.amountUsdc,
      },
      { delay: delayMs },
    );
  }
}
