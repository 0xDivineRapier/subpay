import { SubPayConfig, SubPayError, SubPaySDKError, Subscription } from './types.js';
import { SUBPAY_DEVNET_PUBLIC_KEY, DEVNET_RELAY_URL, MAINNET_RELAY_URL } from './config.js';
import { validateApiKey } from './utils/validation.js';

type SubscriptionStatus = Subscription['status'];

interface ListFilters {
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
}

interface MrrResult {
  currentMrr: number;
  previousMrr: number;
  changePercent: number;
}

interface ChurnResult {
  churnRate: number;
  cancelledLast30Days: number;
  totalActive: number;
}

interface RelayBalance {
  solBalance: number;
  estimatedChargesRemaining: number;
}

const BACKOFF_BASE_MS = 500;
const MAX_RETRIES = 3;

export class SubPayClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  readonly subscriptions: {
    list(filters?: ListFilters): Promise<Subscription[]>;
    get(subscriptionId: string): Promise<Subscription>;
    cancel(subscriptionId: string): Promise<Subscription>;
    pause(subscriptionId: string): Promise<Subscription>;
    resume(subscriptionId: string): Promise<Subscription>;
  };

  readonly relay: {
    getBalance(): Promise<RelayBalance>;
  };

  readonly analytics: {
    getMrr(): Promise<MrrResult>;
    getChurn(): Promise<ChurnResult>;
  };

  constructor(config: SubPayConfig) {
    // Validate API key before any initialization — devnet key is rejected on Mainnet
    validateApiKey(config.apiKey, config.network);

    const isDevnetKey = config.apiKey === SUBPAY_DEVNET_PUBLIC_KEY;
    if (isDevnetKey) {
      console.warn(
        '[SubPay] Using public devnet key. For production, generate a key at app.subpay.xyz',
      );
    }

    // Devnet key forces devnet regardless of config.network
    const effectiveNetwork = isDevnetKey ? 'devnet' : config.network;

    this.apiKey = config.apiKey;
    this.baseUrl =
      config.rpcEndpoint ??
      (effectiveNetwork === 'mainnet' ? MAINNET_RELAY_URL : DEVNET_RELAY_URL);

    const fetch = this.fetch.bind(this);

    this.subscriptions = {
      list: (filters?: ListFilters) => {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.limit != null) params.set('limit', String(filters.limit));
        if (filters?.offset != null) params.set('offset', String(filters.offset));
        const qs = params.toString();
        return fetch<Subscription[]>(`/v1/subscriptions${qs ? `?${qs}` : ''}`);
      },
      get: (id: string) => fetch<Subscription>(`/v1/subscriptions/${id}`),
      cancel: (id: string) =>
        fetch<Subscription>(`/v1/subscriptions/${id}/cancel`, { method: 'POST' }),
      pause: (id: string) =>
        fetch<Subscription>(`/v1/subscriptions/${id}/pause`, { method: 'POST' }),
      resume: (id: string) =>
        fetch<Subscription>(`/v1/subscriptions/${id}/resume`, { method: 'POST' }),
    };

    this.relay = {
      getBalance: () => fetch<RelayBalance>('/v1/relay/balance'),
    };

    this.analytics = {
      getMrr: () => fetch<MrrResult>('/v1/analytics/mrr'),
      getChurn: () => fetch<ChurnResult>('/v1/analytics/churn'),
    };
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {},
    attempt = 1,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    };

    let response: Response;
    try {
      response = await globalThis.fetch(url, { ...options, headers });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
        return this.fetch<T>(path, options, attempt + 1);
      }
      throw new SubPaySDKError({
        code: 'NETWORK_ERROR',
        message: `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    if (!response.ok) {
      let errorBody: SubPayError;
      try {
        errorBody = (await response.json()) as SubPayError;
      } catch {
        errorBody = {
          code: response.status === 401 ? 'UNAUTHORIZED' : 'NETWORK_ERROR',
          message: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      if (response.status === 404) {
        throw new SubPaySDKError({ ...errorBody, code: 'SUBSCRIPTION_NOT_FOUND' });
      }
      if (response.status === 401) {
        throw new SubPaySDKError({ ...errorBody, code: 'UNAUTHORIZED' });
      }
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
        return this.fetch<T>(path, options, attempt + 1);
      }
      throw new SubPaySDKError(errorBody);
    }

    return response.json() as Promise<T>;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
