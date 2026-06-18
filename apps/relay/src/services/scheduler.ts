import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';

export const CHARGE_QUEUE_NAME = 'subpay:charges';
export const WEBHOOK_QUEUE_NAME = 'subpay:webhooks';

/** Hardcoded retry delays — not configurable at MVP */
export const RETRY_DELAYS_MS: Record<number, number> = {
  1: 3_600_000,    // 1 hour
  2: 21_600_000,   // 6 hours
  3: 86_400_000,   // 24 hours
};

export interface ChargeJobData {
  subscriptionId: string;
  attemptId: string;
  operatorId: string;
}

export interface WebhookJobData {
  eventType: string;
  eventId: string;
  operatorId: string;
  subscriptionId: string;
  walletAddress: string;
  amountUsdc: number;
  txSignature?: string;
  failureReason?: string;
  retryCount?: number;
  nextRetryAt?: string;
}

let _redis: IORedis | null = null;
let _chargeQueue: Queue<ChargeJobData> | null = null;
let _webhookQueue: Queue<WebhookJobData> | null = null;

export function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _redis;
}

export function getChargeQueue(): Queue<ChargeJobData> {
  if (!_chargeQueue) {
    _chargeQueue = new Queue<ChargeJobData>(CHARGE_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return _chargeQueue;
}

export function getWebhookQueue(): Queue<WebhookJobData> {
  if (!_webhookQueue) {
    _webhookQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }
  return _webhookQueue;
}

export async function closeQueues(): Promise<void> {
  await _chargeQueue?.close();
  await _webhookQueue?.close();
  _redis?.disconnect();
}
