import { Connection } from '@solana/web3.js';
import pino from 'pino';
import { db } from '../db/client.js';
import { config } from '../config.js';
import { enqueueWebhookEvent } from './webhook.js';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'relay-balance' });

export interface RelayBalanceResult {
  solBalance: number;
  estimatedChargesRemaining: number;
  isLow: boolean;
}

/**
 * Checks the relay hot wallet SOL balance via RPC, logs it to the DB,
 * and fires a low-balance alert webhook if below the threshold.
 */
export async function checkRelayBalance(
  operatorId: string,
  walletPublicKey: string,
): Promise<RelayBalanceResult> {
  const connection = new Connection(config.rpcEndpoint, 'confirmed');
  const { PublicKey } = await import('@solana/web3.js');

  const balanceLamports = await connection.getBalance(new PublicKey(walletPublicKey));
  const solBalance = balanceLamports / 1e9;
  const estimatedChargesRemaining = Math.floor(solBalance / 0.000005);
  const isLow = solBalance < config.lowBalanceThresholdSol;

  await db.query(
    'INSERT INTO relay_balance_log (operator_id, sol_balance) VALUES ($1, $2)',
    [operatorId, solBalance],
  );

  if (isLow) {
    logger.error({ operatorId, solBalance }, 'Relay balance below 0.1 SOL threshold — top up required');

    await enqueueWebhookEvent(
      {
        id: uuidv4(),
        type: 'relay.balance_low' as never,
        createdAt: new Date().toISOString(),
        data: {
          subscriptionId: '',
          walletAddress: walletPublicKey,
          amountUsdc: 0,
          failureReason: `Relay SOL balance is ${solBalance.toFixed(4)} SOL (threshold: ${config.lowBalanceThresholdSol} SOL)`,
        },
      },
      operatorId,
    );
  }

  if (solBalance > config.maxHotWalletSol) {
    logger.warn({ operatorId, solBalance }, 'Relay wallet balance exceeds 1 SOL maximum');
  }

  return { solBalance, estimatedChargesRemaining, isLow };
}
