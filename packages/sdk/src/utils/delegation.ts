import { SubscriptionPlan } from '../types.js';

export interface DelegationParams {
  walletAddress: string;
  plan: SubscriptionPlan;
  relayAddress: string;
}

/**
 * Builds the delegation instruction payload to be signed by the user's wallet.
 * The delegation authorizes the relay to charge up to maxAmountUsdc until expiryDate.
 */
export function buildDelegationPayload(params: DelegationParams): Record<string, unknown> {
  return {
    type: 'recurring_delegation',
    walletAddress: params.walletAddress,
    relayAddress: params.relayAddress,
    amountUsdc: params.plan.amountUsdc,
    maxAmountUsdc: params.plan.maxAmountUsdc,
    intervalDays: params.plan.intervalDays,
    expiryDate: params.plan.expiryDate.toISOString(),
    planName: params.plan.name,
    metadata: params.plan.metadata ?? {},
  };
}
