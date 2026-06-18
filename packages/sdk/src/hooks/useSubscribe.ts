import { useCallback, useState } from 'react';
import { useSubPay } from '../provider.js';
import { SubPaySDKError, Subscription, SubscriptionPlan } from '../types.js';
import { validatePlan } from '../utils/validation.js';

type SubscribeStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseSubscribeResult {
  subscribe: (plan: SubscriptionPlan) => Promise<Subscription>;
  status: SubscribeStatus;
  subscription: Subscription | null;
  error: SubPaySDKError | null;
}

export function useSubscribe(): UseSubscribeResult {
  const { client, config } = useSubPay();
  const [status, setStatus] = useState<SubscribeStatus>('idle');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<SubPaySDKError | null>(null);

  const subscribe = useCallback(
    async (plan: SubscriptionPlan): Promise<Subscription> => {
      setStatus('loading');
      setError(null);

      try {
        // Step 1: validate before any wallet interaction — security invariant
        validatePlan(plan);

        // Step 2: register intent with relay
        const intent = await globalThis.fetch(
          `${config.rpcEndpoint ?? (config.network === 'mainnet' ? 'https://relay.subpay.so' : 'https://relay-devnet.subpay.so')}/v1/subscriptions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ plan }),
          },
        );

        if (!intent.ok) {
          const body = (await intent.json()) as { code: string; message: string };
          throw new SubPaySDKError({
            code: 'DELEGATION_FAILED',
            message: body.message ?? 'Failed to register subscription intent',
          });
        }

        const created = (await intent.json()) as Subscription;

        // Steps 3–4: wallet adapter signing happens in consuming app via delegationTxSignature
        // The relay returns the created subscription once the delegation is accepted.

        setSubscription(created);
        setStatus('success');
        return created;
      } catch (err) {
        const sdkErr =
          err instanceof SubPaySDKError
            ? err
            : new SubPaySDKError({
                code: 'DELEGATION_FAILED',
                message: err instanceof Error ? err.message : 'Unknown error',
              });
        setError(sdkErr);
        setStatus('error');
        throw sdkErr;
      }
    },
    [client, config],
  );

  return { subscribe, status, subscription, error };
}
