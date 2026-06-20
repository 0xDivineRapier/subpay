import { SubPaySDKError, SubscriptionPlan } from '../types.js';
import { SUBPAY_DEVNET_PUBLIC_KEY } from '../config.js';

/**
 * Validates a SubscriptionPlan before any wallet interaction.
 * Security invariant: unbounded delegations are never allowed —
 * maxAmountUsdc and expiryDate are always required and always bounded.
 */
export function validatePlan(plan: SubscriptionPlan): void {
  const errors: string[] = [];

  if (!plan.name || plan.name.trim() === '') {
    errors.push('name is required');
  }

  if (typeof plan.amountUsdc !== 'number' || plan.amountUsdc <= 0) {
    errors.push('amountUsdc must be > 0');
  } else if (plan.amountUsdc > 10_000) {
    errors.push('amountUsdc must be <= 10,000');
  }

  if (typeof plan.intervalDays !== 'number' || plan.intervalDays < 1) {
    errors.push('intervalDays must be >= 1');
  } else if (plan.intervalDays > 365) {
    errors.push('intervalDays must be <= 365');
  }

  if (typeof plan.maxAmountUsdc !== 'number') {
    errors.push('maxAmountUsdc is required');
  } else if (plan.maxAmountUsdc < plan.amountUsdc) {
    errors.push('maxAmountUsdc must be >= amountUsdc');
  }

  if (!(plan.expiryDate instanceof Date) || isNaN(plan.expiryDate.getTime())) {
    errors.push('expiryDate must be a valid Date');
  } else {
    const minExpiry = new Date(Date.now() + plan.intervalDays * 24 * 60 * 60 * 1000);
    if (plan.expiryDate <= new Date()) {
      errors.push('expiryDate must be in the future');
    } else if (plan.expiryDate < minExpiry) {
      errors.push('expiryDate must be at least intervalDays from now');
    }
  }

  if (errors.length > 0) {
    throw new SubPaySDKError({
      code: 'INVALID_PLAN',
      message: `Invalid subscription plan: ${errors.join('; ')}`,
      details: { errors },
    });
  }
}


/**
 * Guards against using the public devnet key on Mainnet.
 * Must be called before any RPC call or wallet interaction.
 */
export function validateApiKey(apiKey: string, network: 'mainnet' | 'devnet'): void {
  if (apiKey === SUBPAY_DEVNET_PUBLIC_KEY && network === 'mainnet') {
    throw new SubPaySDKError({
      code: 'DEVNET_KEY_ON_MAINNET',
      message:
        'The public devnet key cannot be used on Mainnet. Generate a production key at app.subpay.xyz',
    });
  }
}
