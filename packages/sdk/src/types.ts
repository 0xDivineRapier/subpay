/**
 * A recurring payment plan configuration.
 * maxAmountUsdc enforces a hard cap on the delegation — unbounded delegations are never allowed.
 */
export interface SubscriptionPlan {
  /** Display name for the plan */
  name: string;
  /** Amount in USDC to charge per interval */
  amountUsdc: number;
  /** Billing interval in days (1–365) */
  intervalDays: number;
  /** Maximum USDC the delegation may ever transfer; must be >= amountUsdc */
  maxAmountUsdc: number;
  /** When the delegation expires; must be > now + intervalDays */
  expiryDate: Date;
  /** Arbitrary key-value metadata stored alongside the subscription */
  metadata?: Record<string, string>;
}

/** A subscriber's active or historical subscription record */
export interface Subscription {
  id: string;
  walletAddress: string;
  plan: SubscriptionPlan;
  status: 'active' | 'past_due' | 'paused' | 'cancelled';
  /** On-chain signature of the delegation setup transaction */
  delegationTxSignature: string;
  createdAt: Date;
  lastChargeAt: Date | null;
  nextChargeAt: Date;
  /** Consecutive failed charge attempts since last success */
  retryCount: number;
}

/** SDK constructor configuration */
export interface SubPayConfig {
  apiKey: string;
  network: 'mainnet' | 'devnet';
  /** Override default RPC endpoint */
  rpcEndpoint?: string;
}

/** Webhook delivery payload envelope */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: {
    subscriptionId: string;
    walletAddress: string;
    amountUsdc: number;
    txSignature?: string;
    failureReason?: string;
    retryCount?: number;
    nextRetryAt?: string;
    /** Short user-facing message for payment.failed events */
    suggested_user_message?: string;
    /** Long user-facing message with recovery steps for payment.failed events */
    suggested_user_message_long?: string;
  };
}

export type WebhookEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.paused'
  | 'subscription.resumed';

export type SubPayErrorCode =
  | 'INVALID_PLAN'
  | 'DELEGATION_FAILED'
  | 'WALLET_REJECTED'
  | 'INSUFFICIENT_BALANCE'
  | 'UNAUTHORIZED'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'RELAY_BALANCE_LOW'
  | 'NETWORK_ERROR'
  | 'DEVNET_KEY_ON_MAINNET';

export type SubPayAnalyticsEvent =
  | 'subpay:auth_view'
  | 'subpay:auth_cancel'
  | 'subpay:auth_success';

export interface SubPayError {
  code: SubPayErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class SubPaySDKError extends Error {
  readonly code: SubPayErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(error: SubPayError) {
    super(error.message);
    this.name = 'SubPaySDKError';
    this.code = error.code;
    this.details = error.details;
  }
}
