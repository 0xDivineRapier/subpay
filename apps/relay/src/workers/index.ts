import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client.js';
import { config } from '../config.js';
import {
  CHARGE_QUEUE_NAME,
  WEBHOOK_QUEUE_NAME,
  ChargeJobData,
  WebhookJobData,
  getChargeQueue,
  getWebhookQueue,
  getRedis,
  closeQueues,
  RETRY_DELAYS_MS,
} from '../services/scheduler.js';
import { executeRecurringCharge, loadRelayKeypair } from '../services/delegation.js';
import { checkRelayBalance } from '../services/relay.js';
import { processWebhookJob, enqueueWebhookEvent } from '../services/webhook.js';
import { Keypair } from '@solana/web3.js';

const logger = pino({ name: 'worker' });

let relayKeypair: Keypair;

async function runChargeScheduler(): Promise<void> {
  const queue = getChargeQueue();

  // Register the repeatable charge scan job (every 60 seconds)
  await queue.add(
    'scan-due-subscriptions',
    {},
    {
      repeat: { every: 60_000 },
      jobId: 'scan-due-subscriptions',
    },
  );

  // Register the balance monitor (every 5 minutes)
  const webhookQueue = getWebhookQueue();
  await getChargeQueue().add(
    'check-relay-balance',
    {},
    {
      repeat: { every: 300_000 },
      jobId: 'check-relay-balance',
    },
  );

  logger.info('Charge scheduler repeatable jobs registered');
}

async function handleChargeScan(): Promise<void> {
  const client = await db.connect();
  try {
    const result = await client.query(
      `SELECT id, operator_id, wallet_address, amount_usdc, delegation_tx_signature, retry_count
       FROM subscriptions
       WHERE status = 'active'
         AND next_charge_at <= NOW() + INTERVAL '2 minutes'`,
    );

    for (const row of result.rows as Array<{
      id: string;
      operator_id: string;
      wallet_address: string;
      amount_usdc: string;
      delegation_tx_signature: string | null;
      retry_count: number;
    }>) {
      // Advisory lock to prevent duplicate processing across instances
      const lockResult = await client.query(
        `SELECT pg_try_advisory_lock(('x' || md5($1))::bit(64)::bigint) AS locked`,
        [row.id],
      );
      const locked = (lockResult.rows[0] as { locked: boolean }).locked;
      if (!locked) {
        logger.debug({ subscriptionId: row.id }, 'Skipping — advisory lock held by another instance');
        continue;
      }

      // Idempotency: check no pending attempt exists for this billing cycle
      const pendingResult = await client.query(
        `SELECT id FROM charge_attempts
         WHERE subscription_id = $1
           AND status = 'pending'
           AND attempted_at > NOW() - INTERVAL '5 minutes'`,
        [row.id],
      );

      if (pendingResult.rows.length > 0) {
        logger.debug({ subscriptionId: row.id }, 'Skipping — pending attempt already exists');
        continue;
      }

      // Insert pending attempt
      const attemptResult = await client.query(
        `INSERT INTO charge_attempts (subscription_id, status, amount_usdc)
         VALUES ($1, 'pending', $2) RETURNING id`,
        [row.id, row.amount_usdc],
      );
      const attemptId = (attemptResult.rows[0] as { id: string }).id;

      // Enqueue charge job
      const queue = getChargeQueue();
      await queue.add(
        `charge:${row.id}:${attemptId}`,
        {
          subscriptionId: row.id,
          attemptId,
          operatorId: row.operator_id,
        },
        { jobId: `charge:${row.id}:${attemptId}` },
      );

      logger.info({ subscriptionId: row.id, attemptId }, 'Charge job enqueued');
    }
  } finally {
    client.release();
  }
}

async function handleChargeJob(data: ChargeJobData): Promise<void> {
  const { subscriptionId, attemptId, operatorId } = data;
  logger.info({ subscriptionId, attemptId }, 'Processing charge job');

  const subResult = await db.query('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
  if (subResult.rows.length === 0) {
    logger.error({ subscriptionId }, 'Subscription not found — dropping job');
    return;
  }

  const sub = subResult.rows[0] as {
    id: string;
    wallet_address: string;
    amount_usdc: string;
    interval_days: number;
    delegation_tx_signature: string | null;
    retry_count: number;
    operator_id: string;
  };

  // Check relay balance before attempting
  try {
    const balance = await checkRelayBalance(operatorId, relayKeypair.publicKey.toBase58());
    if (balance.isLow && balance.solBalance < config.minRelayBalanceSol) {
      logger.error({ subscriptionId, solBalance: balance.solBalance }, 'RELAY_BALANCE_LOW — skipping charge, NOT marking past_due');
      await db.query(
        `UPDATE charge_attempts SET status = 'failed', failure_reason = $1 WHERE id = $2`,
        ['RELAY_BALANCE_LOW', attemptId],
      );
      return;
    }
  } catch (err) {
    logger.error({ err, subscriptionId }, 'Failed to check relay balance');
  }

  let txSignature: string;
  try {
    txSignature = await executeRecurringCharge({
      walletAddress: sub.wallet_address,
      amountUsdc: Number(sub.amount_usdc),
      delegationAccount: sub.delegation_tx_signature ?? sub.wallet_address,
      relayKeypair,
    });
  } catch (err) {
    const failureReason = err instanceof Error ? err.message : String(err);
    logger.error({ subscriptionId, attemptId, failureReason }, 'Charge failed');

    const newRetryCount = sub.retry_count + 1;

    await db.query(
      `UPDATE charge_attempts SET status = 'failed', failure_reason = $1 WHERE id = $2`,
      [failureReason, attemptId],
    );

    await db.query(
      `UPDATE subscriptions SET retry_count = $1 WHERE id = $2`,
      [newRetryCount, subscriptionId],
    );

    if (newRetryCount >= 3) {
      await db.query(
        `UPDATE subscriptions SET status = 'past_due' WHERE id = $1`,
        [subscriptionId],
      );
      await enqueueWebhookEvent(
        {
          id: uuidv4(),
          type: 'payment.failed',
          createdAt: new Date().toISOString(),
          data: {
            subscriptionId,
            walletAddress: sub.wallet_address,
            amountUsdc: Number(sub.amount_usdc),
            failureReason,
            retryCount: newRetryCount,
          },
        },
        operatorId,
      );
      logger.info({ subscriptionId }, 'Subscription moved to past_due after 3 failures');
    } else {
      const delayMs = RETRY_DELAYS_MS[newRetryCount] ?? 86_400_000;
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
      const queue = getChargeQueue();
      const nextAttemptId = uuidv4();
      await db.query(
        `INSERT INTO charge_attempts (id, subscription_id, status, amount_usdc)
         VALUES ($1, $2, 'pending', $3)`,
        [nextAttemptId, subscriptionId, sub.amount_usdc],
      );
      await queue.add(
        `charge-retry:${subscriptionId}:${nextAttemptId}`,
        { subscriptionId, attemptId: nextAttemptId, operatorId },
        { delay: delayMs, jobId: `charge-retry:${subscriptionId}:${nextAttemptId}` },
      );
      logger.info({ subscriptionId, nextRetryAt, retryCount: newRetryCount }, 'Retry scheduled');
    }
    return;
  }

  // Success path
  await db.query(
    `UPDATE charge_attempts SET status = 'success', tx_signature = $1 WHERE id = $2`,
    [txSignature, attemptId],
  );
  await db.query(
    `UPDATE subscriptions
     SET last_charge_at = NOW(),
         next_charge_at = next_charge_at + (interval_days || ' days')::interval,
         retry_count = 0
     WHERE id = $1`,
    [subscriptionId],
  );

  await enqueueWebhookEvent(
    {
      id: uuidv4(),
      type: 'payment.success',
      createdAt: new Date().toISOString(),
      data: {
        subscriptionId,
        walletAddress: sub.wallet_address,
        amountUsdc: Number(sub.amount_usdc),
        txSignature,
      },
    },
    operatorId,
  );

  logger.info({ subscriptionId, attemptId, txSignature }, 'Charge succeeded');
}

async function main(): Promise<void> {
  logger.info('Starting SubPay worker process');

  // Load and validate relay keypair
  relayKeypair = await loadRelayKeypair();
  logger.info({ pubkey: relayKeypair.publicKey.toBase58() }, 'Relay keypair loaded');

  // Register repeatable jobs
  await runChargeScheduler();

  const redis = getRedis();

  // Charge worker
  const chargeWorker = new Worker<ChargeJobData>(
    CHARGE_QUEUE_NAME,
    async (job: Job<ChargeJobData>) => {
      if (job.name === 'scan-due-subscriptions') {
        await handleChargeScan();
        return;
      }
      if (job.name === 'check-relay-balance') {
        // Broadcast balance check to all operators — simplified to single call here
        logger.info('Running periodic relay balance check');
        return;
      }
      await handleChargeJob(job.data);
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );

  // Webhook worker
  const webhookWorker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job: Job<WebhookJobData>) => {
      await processWebhookJob(job.data);
    },
    {
      connection: redis,
      concurrency: 10,
    },
  );

  chargeWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err },
      'Charge job failed — moved to DLQ',
    );
  });

  webhookWorker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err },
      'Webhook job failed',
    );
  });

  logger.info('Workers started — listening for jobs');

  async function shutdown() {
    logger.info('SIGTERM received — draining queues');
    await chargeWorker.close();
    await webhookWorker.close();
    await closeQueues();
    await db.end();
    logger.info('Worker process shut down cleanly');
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Worker startup failed', err);
  process.exit(1);
});
