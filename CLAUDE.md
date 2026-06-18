# SubPay — Developer Reference

## Overview

SubPay is a TypeScript-first SDK + backend for USDC-denominated recurring payments on Solana. It abstracts delegation setup, transaction scheduling, fee sponsorship, and retry logic for dApp operators.

## Architecture

```
┌─────────────────────────────────┐
│  @subpay/solana (SDK)           │  packages/sdk/
│  React components + server client│
└────────────┬────────────────────┘
             │ REST API (Bearer sk_live_...)
┌────────────▼────────────────────┐
│  SubPay Relay Backend           │  apps/relay/
│  Fastify + BullMQ + PostgreSQL  │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  SubPay Dashboard               │  apps/dashboard/
│  Next.js 14 operator UI         │
└─────────────────────────────────┘
```

## Monorepo Map

```
subpay/
├── packages/sdk/          @subpay/solana — TypeScript SDK
│   └── src/
│       ├── types.ts       Core type definitions
│       ├── client.ts      SubPayClient (server-side)
│       ├── provider.tsx   SubPayProvider (React context)
│       ├── hooks/
│       │   └── useSubscribe.ts
│       ├── components/
│       │   ├── SubscribeButton.tsx
│       │   └── SubscriptionManager.tsx
│       └── utils/
│           ├── validation.ts  validatePlan() — runs before any wallet interaction
│           └── delegation.ts  buildDelegationPayload()
├── apps/relay/            Fastify relay backend
│   └── src/
│       ├── config.ts      Env var config with hard limits
│       ├── db/
│       │   ├── schema.sql PostgreSQL schema
│       │   └── client.ts  pg Pool singleton
│       ├── routes/        REST API handlers
│       ├── services/      Business logic
│       ├── middleware/    Auth + error handling
│       └── workers/       BullMQ charge scheduler (Prompt 2)
├── apps/dashboard/        Next.js 14 operator dashboard (Prompt 3)
├── docker-compose.yml     PostgreSQL 16 + Redis 7
└── .env.example
```

## Local Dev Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL + Redis
docker-compose up -d

# 3. Copy and fill env vars
cp .env.example apps/relay/.env

# 4. Run schema migration
cd apps/relay && pnpm db:migrate

# 5. Start relay
pnpm --filter @subpay/relay dev

# 6. Start worker (separate terminal)
pnpm --filter @subpay/relay worker
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLANA_NETWORK` | No | `mainnet` or `devnet` (default: `devnet`) |
| `SOLANA_RPC_ENDPOINT` | No | Override RPC URL (Helius recommended) |
| `RELAY_HOT_WALLET_PRIVATE_KEY` | Yes (worker) | Base58-encoded keypair for fee payer |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Redis URL (default: `redis://localhost:6379`) |
| `PORT` | No | Relay API port (default: `3001`) |
| `API_BASE_URL` | No | Public URL of relay (for SDK config) |
| `WEBHOOK_SIGNING_SECRET_SALT` | No | Salt for HMAC webhook signatures |

## SDK Public API

```typescript
// Server-side
const client = new SubPayClient({ apiKey, network: 'mainnet' });
await client.subscriptions.list({ status: 'active', limit: 50 });
await client.subscriptions.cancel(id);
await client.analytics.getMrr();
await client.relay.getBalance();

// React
<SubPayProvider config={{ apiKey, network: 'mainnet' }}>
  <SubscribeButton plan={plan} onSuccess={handleSuccess} />
  <SubscriptionManager subscription={sub} />
</SubPayProvider>

const { subscribe, status, subscription, error } = useSubscribe();
```

## REST API Routes

All routes except `/health` require `Authorization: Bearer sk_live_...`

| Method | Path | Description |
|---|---|---|
| POST | /v1/subscriptions | Create subscription |
| GET | /v1/subscriptions | List subscriptions |
| GET | /v1/subscriptions/:id | Get subscription |
| POST | /v1/subscriptions/:id/cancel | Cancel |
| POST | /v1/subscriptions/:id/pause | Pause |
| POST | /v1/subscriptions/:id/resume | Resume |
| GET | /v1/analytics/mrr | MRR metrics |
| GET | /v1/analytics/churn | Churn metrics |
| GET | /v1/relay/balance | Hot wallet balance |
| POST | /v1/webhooks | Register webhook endpoint |
| GET | /v1/webhooks/:id/logs | Delivery log |
| GET | /health | Health check |

## Database Schema Summary

- **operators** — dApp operators with email login
- **api_keys** — hashed API keys (only prefix stored in plaintext)
- **subscriptions** — subscriber delegation records with charge schedule
- **charge_attempts** — every charge attempt with tx signature or failure reason
- **webhook_endpoints** — operator webhook URLs with HMAC secret
- **webhook_deliveries** — delivery log with retry state
- **relay_balance_log** — SOL balance history for hot wallet monitoring

## Webhook Event Catalog

| Type | Fired when |
|---|---|
| `subscription.created` | New subscription registered |
| `subscription.cancelled` | Subscription cancelled |
| `subscription.paused` | Subscription paused |
| `subscription.resumed` | Paused subscription resumed |
| `payment.success` | Charge succeeded on-chain |
| `payment.failed` | All 3 retries exhausted, subscription → `past_due` |

All webhook payloads are HMAC-SHA256 signed. Verify with `X-SubPay-Signature: sha256=<hmac>`.

## Hard Constraints (Never Violate)

1. **Relay hot wallet max 1 SOL** — enforced in code at startup and post-charge
2. **All delegations require maxAmountUsdc + expiryDate** — unbounded delegations are never allowed
3. **Never log private keys or full API key values** — use `key_prefix` only
4. **validatePlan() runs before any wallet interaction** — security invariant
5. **Relay balance checked before every charge** — reject if < 0.05 SOL

## Scheduler / Worker (Prompt 2)

- Queue: `subpay:charges` (charge scheduler, 60s poll)
- Queue: `subpay:webhooks` (async delivery, never blocks charges)
- Retry delays: 1h → 6h → 24h (3 attempts max, then `past_due`)
- Advisory locks (`pg_try_advisory_lock`) prevent duplicate processing
- Worker entry point: `apps/relay/src/workers/index.ts`

## Dashboard (Prompt 3)

- URL: http://localhost:3000
- Stack: Next.js 14 App Router, Tailwind, shadcn/ui, Recharts
- Auth: NextAuth.js email+password (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` env vars)
- All data via SubPayClient — zero direct DB queries from dashboard
- Dark navy theme: `background: #0D1117`, `surface: #161B22`, `primary: #2563EB`
- Sidebar collapses on mobile; tables scroll horizontally
- Relay balance auto-polls every 30s via `useEffect + setInterval`
- Destructive actions (cancel sub, revoke API key) require typing "confirm" in modal

### Dashboard env vars

| Variable | Description |
|---|---|
| `SUBPAY_API_KEY` | API key for SubPayClient |
| `SUBPAY_NETWORK` | `mainnet` or `devnet` |
| `SUBPAY_RELAY_URL` | URL of relay backend (default: http://localhost:3001) |
| `NEXTAUTH_SECRET` | NextAuth secret |
| `ADMIN_EMAIL` | Operator login email |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of operator password |
