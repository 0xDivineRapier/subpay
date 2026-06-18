import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import pino from 'pino';
import { config } from '../config.js';

const logger = pino({ name: 'delegation' });

export interface ChargeParams {
  walletAddress: string;
  amountUsdc: number;
  delegationAccount: string;
  relayKeypair: Keypair;
}

/**
 * Executes a recurring USDC charge using Solana's delegated spending primitive.
 * The relay's hot wallet is the fee payer — the end user does NOT sign recurring charges.
 *
 * Steps:
 * 1. Build transaction with Solana recurring payments program instruction
 * 2. Set compute budget (200k units)
 * 3. Fetch priority fee from Helius and apply
 * 4. Sign with relayKeypair as fee payer
 * 5. Send with skipPreflight=false, maxRetries=3
 * 6. Confirm with 'confirmed' commitment
 */
export async function executeRecurringCharge(params: ChargeParams): Promise<string> {
  const { walletAddress, amountUsdc, delegationAccount, relayKeypair } = params;

  const connection = new Connection(config.rpcEndpoint, 'confirmed');

  // Check relay balance before attempting — reject if below minimum
  const balanceLamports = await connection.getBalance(relayKeypair.publicKey);
  const balanceSol = balanceLamports / 1e9;

  if (balanceSol < config.minRelayBalanceSol) {
    throw Object.assign(new Error(`Relay balance ${balanceSol} SOL below minimum`), {
      code: 'RELAY_BALANCE_LOW',
    });
  }

  if (balanceSol > config.maxHotWalletSol) {
    logger.warn({ balanceSol }, 'Relay hot wallet balance exceeds 1 SOL maximum');
  }

  // Fetch priority fee estimate from Helius (falls back to 1000 microlamports)
  let priorityFee = 1000;
  try {
    const feeResponse = await fetch(`${config.rpcEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getPriorityFeeEstimate',
        params: [{ options: { priorityLevel: 'Medium' } }],
      }),
    });
    const feeData = (await feeResponse.json()) as {
      result?: { priorityFeeEstimate?: number };
    };
    if (feeData.result?.priorityFeeEstimate) {
      priorityFee = feeData.result.priorityFeeEstimate;
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch priority fee estimate, using fallback');
  }

  const transaction = new Transaction();

  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
  );

  // Recurring payment program instruction
  // NOTE: Replace with actual Solana recurring payments program ID and instruction
  // once the mid-2026 primitive is available on-chain.
  // This is a placeholder that transfers USDC via the delegation account.
  const { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } =
    await import('@solana/spl-token').catch(() => {
      throw Object.assign(
        new Error('Install @solana/spl-token to enable on-chain charges'),
        { code: 'NETWORK_ERROR' },
      );
    });

  const USDC_MINT = new PublicKey(
    config.network === 'mainnet'
      ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  );

  const sourceAta = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(walletAddress));
  const destAta = await getAssociatedTokenAddress(USDC_MINT, relayKeypair.publicKey);

  transaction.add(
    createTransferInstruction(
      sourceAta,
      destAta,
      new PublicKey(delegationAccount),
      BigInt(Math.round(amountUsdc * 1_000_000)), // USDC has 6 decimals
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = relayKeypair.publicKey;

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [relayKeypair], {
      skipPreflight: false,
      maxRetries: 3,
      commitment: 'confirmed',
    });

    logger.info({ walletAddress, amountUsdc, signature }, 'Recurring charge executed');

    // Warn if post-charge balance still above max
    const postBalance = await connection.getBalance(relayKeypair.publicKey);
    if (postBalance / 1e9 > config.maxHotWalletSol) {
      logger.warn({ postBalance: postBalance / 1e9 }, 'Relay wallet still above 1 SOL after charge');
    }

    return signature;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
      throw Object.assign(new Error(`Insufficient USDC balance: ${message}`), {
        code: 'INSUFFICIENT_BALANCE',
      });
    }
    throw Object.assign(new Error(`On-chain charge failed: ${message}`), {
      code: 'NETWORK_ERROR',
    });
  }
}

/**
 * Loads and validates the relay hot wallet keypair from env.
 * Logs a WARNING if balance > 1 SOL at startup.
 */
export async function loadRelayKeypair(): Promise<Keypair> {
  const privateKeyB58 = config.relayHotWalletPrivateKey;
  if (!privateKeyB58) {
    throw new Error('RELAY_HOT_WALLET_PRIVATE_KEY is not set');
  }

  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));
  } catch {
    throw new Error('RELAY_HOT_WALLET_PRIVATE_KEY is not valid base58');
  }

  const connection = new Connection(config.rpcEndpoint, 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  const solBalance = balance / 1e9;

  logger.info({ pubkey: keypair.publicKey.toBase58(), solBalance }, 'Relay keypair loaded');

  if (solBalance === 0) {
    logger.error({ pubkey: keypair.publicKey.toBase58() }, 'Relay wallet has zero balance');
  }

  if (solBalance > config.maxHotWalletSol) {
    logger.warn({ solBalance }, 'WARNING: Relay wallet balance exceeds 1 SOL maximum at startup');
  }

  return keypair;
}
