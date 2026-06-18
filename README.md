# SubPay

USDC-denominated recurring payments on Solana. Gasless UX for end users — the relay sponsors all transaction fees.

```
dApp user pays $9.99/mo in USDC
  └─ signs delegation once (wallet popup)
  └─ never signs again — relay handles every charge
  └─ operator gets USDC, relay covers SOL fees
```

## Architecture

```
┌─────────────────────────────────────────┐
│  @subpay/solana (SDK)                   │
│  React components + server-side client  │
└─────────────────┬───────────────────────┘
                  │  REST  Bearer sk_live_...
┌─────────────────▼───────────────────────┐
│  SubPay Relay  (Fastify + BullMQ)       │
│  Sponsors SOL fees, executes charges,   │
│  retries failures, delivers webhooks    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  PostgreSQL + Redis                     │
│  Subscriptions, charge history,         │
│  webhook delivery log, balance log      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SubPay Dashboard  (Next.js 14)         │
│  Operator UI — MRR, subscribers,        │
│  relay health, webhooks, API keys       │
└─────────────────────────────────────────┘
```

## Packages

| Package | Path | Description |
|---|---|---|
| `@subpay/solana` | `packages/sdk/` | TypeScript SDK — React + server |
| `@subpay/relay` | `apps/relay/` | Fastify API + BullMQ worker |
| `@subpay/dashboard` | `apps/dashboard/` | Next.js 14 operator dashboard |

## Quickstart

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

### 1. Install

```bash
git clone https://github.com/0xDivineRapier/subpay
cd subpay
pnpm install
```

### 2. Start infrastructure

```bash
docker-compose up -d
```

### 3. Configure environment

```bash
cp .env.example apps/relay/.env
```

Fill in `apps/relay/.env`:

```env
SOLANA_NETWORK=devnet
SOLANA_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
RELAY_HOT_WALLET_PRIVATE_KEY=<base58 keypair>
DATABASE_URL=postgresql://subpay:subpay@localhost:5432/subpay
REDIS_URL=redis://localhost:6379
```

### 4. Run migrations

```bash
pnpm --filter @subpay/relay db:migrate
```

### 5. Start services

```bash
# Terminal 1 — relay API
pnpm --filter @subpay/relay dev

# Terminal 2 — charge scheduler + webhook worker
pnpm --filter @subpay/relay worker

# Terminal 3 — dashboard
pnpm --filter @subpay/dashboard dev
```

- Relay API: http://localhost:3001
- Dashboard: http://localhost:3000
- Health: http://localhost:3001/health

## SDK Usage

### React (subscriber-side)

```tsx
import { SubPayProvider, SubscribeButton } from '@subpay/solana';

const plan = {
  name: 'Pro',
  amountUsdc: 9.99,
  intervalDays: 30,
  maxAmountUsdc: 9.99,           // hard cap — no unbounded delegations
  expiryDate: new Date('2027-01-01'),
};

export default function App() {
  return (
    <SubPayProvider config={{ apiKey: 'sk_live_...', network: 'mainnet' }}>
      <SubscribeButton
        plan={plan}
        onSuccess={(sub) => console.log('Subscribed:', sub.id)}
        className="btn-primary"
      />
    </SubPayProvider>
  );
}
```

### Server-side (operator)

```ts
import { SubPayClient } from '@subpay/solana';

const subpay = new SubPayClient({ apiKey: 'sk_live_...', network: 'mainnet' });

// List active subscribers
const subs = await subpay.subscriptions.list({ status: 'active', limit: 50 });

// Cancel a subscription
await subpay.subscriptions.cancel(subscriptionId);

// MRR metrics
const { currentMrr, changePercent } = await subpay.analytics.getMrr();

// Relay health
const { solBalance, estimatedChargesRemaining } = await subpay.relay.getBalance();
```

### Webhook verification

```ts
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Express / Fastify handler
app.post('/webhooks/subpay', (req, res) => {
  const sig = req.headers['x-subpay-signature'] as string;
  if (!verifyWebhook(JSON.stringify(req.body), sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  switch (event.type) {
    case 'payment.success':
      // unlock premium feature
      break;
    case 'payment.failed':
      // downgrade user
      break;
    case 'subscription.cancelled':
      // clean up user state
      break;
  }

  res.status(200).send('ok');
});
```

## API Reference

All endpoints require `Authorization: Bearer sk_live_...` except `/health`.

### Subscriptions

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/subscriptions` | Register new subscription |
| `GET` | `/v1/subscriptions` | List subscriptions (`?status=active&wallet=...`) |
| `GET` | `/v1/subscriptions/:id` | Get subscription |
| `POST` | `/v1/subscriptions/:id/cancel` | Cancel |
| `POST` | `/v1/subscriptions/:id/pause` | Pause |
| `POST` | `/v1/subscriptions/:id/resume` | Resume |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/analytics/mrr` | MRR with month-over-month delta |
| `GET` | `/v1/analytics/churn` | Churn rate + cancelled count (30d) |

### Relay

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/relay/balance` | Hot wallet SOL balance |
| `GET` | `/health` | Queue depths + balance (no auth) |

### Webhooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/webhooks` | Register endpoint |
| `GET` | `/v1/webhooks/:id/logs` | Delivery log |

## Webhook Events

| Type | Fired when |
|---|---|
| `subscription.created` | New subscription registered |
| `subscription.cancelled` | Subscription cancelled |
| `subscription.paused` | Subscription paused |
| `subscription.resumed` | Paused subscription resumed |
| `payment.success` | Charge confirmed on-chain |
| `payment.failed` | All 3 retries exhausted → subscription `past_due` |

Payloads are signed with `X-SubPay-Signature: sha256=<hmac>`.

## Charge Lifecycle

```
next_charge_at reached
  └─ advisory lock acquired (prevents duplicate processing)
  └─ pending charge_attempt inserted (idempotency)
  └─ relay balance checked (reject if < 0.05 SOL)
  └─ on-chain USDC transfer executed (relay pays SOL fee)
     ├─ success → next_charge_at += interval_days, retry_count = 0
     │            → payment.success webhook
     └─ failure → retry schedule:
                   attempt 1 → retry in 1 hour
                   attempt 2 → retry in 6 hours
                   attempt 3 → retry in 24 hours
                   attempt 4 → status = past_due
                              → payment.failed webhook
```

## Security Constraints

These are hard-coded invariants, not configuration:

- **Relay hot wallet max: 1 SOL** — enforced at startup and post-charge
- **All delegations require `maxAmountUsdc` + `expiryDate`** — unbounded delegations are never created
- **Minimum relay balance: 0.05 SOL** — charges are skipped (not failed) when balance is below this; subscription status is unaffected
- **API keys** — only the prefix is stored in plaintext; full keys are bcrypt-hashed
- **Webhook payloads** — HMAC-SHA256 signed on every delivery

## Dashboard

The operator dashboard at `apps/dashboard/` provides:

- **Overview** — MRR, active subscribers, failed payments, relay balance
- **Subscribers** — filterable table, per-subscriber charge history, pause/cancel/resume
- **Analytics** — MRR trend chart, monthly churn, CSV export
- **Relay** — color-coded SOL balance (green/yellow/red), auto-refreshes every 30s
- **Webhooks** — endpoint management, delivery log with retry state
- **API Keys** — create with scoped permissions, full key shown once, type-to-confirm revocation

## Environment Variables

### Relay (`apps/relay/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SOLANA_NETWORK` | No | `devnet` | `mainnet` or `devnet` |
| `SOLANA_RPC_ENDPOINT` | No | Solana devnet | RPC URL (Helius recommended) |
| `RELAY_HOT_WALLET_PRIVATE_KEY` | Yes (worker) | — | Base58 keypair for fee payer |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis URL |
| `PORT` | No | `3001` | API port |
| `WEBHOOK_SIGNING_SECRET_SALT` | No | dev salt | HMAC signing salt |

### Dashboard (`apps/dashboard/.env.local`)

| Variable | Description |
|---|---|
| `SUBPAY_API_KEY` | API key for SubPayClient |
| `SUBPAY_RELAY_URL` | Relay URL (default: `http://localhost:3001`) |
| `NEXTAUTH_SECRET` | NextAuth secret (generate with `openssl rand -base64 32`) |
| `ADMIN_EMAIL` | Operator login email |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of operator password |

Generate a password hash:
```bash
node -e "const b=require('bcrypt');b.hash('yourpassword',10).then(console.log)"
```

## Local Development

```bash
# Run all services in watch mode
pnpm dev

# Lint
pnpm lint

# Format
pnpm format

# Type-check SDK
pnpm --filter @subpay/solana build
```

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| SDK | `@solana/web3.js` v1, React 18 |
| API | Fastify 4, `@sinclair/typebox` validation |
| Queue | BullMQ 5 + Redis 7 |
| Database | PostgreSQL 16 |
| Auth | bcrypt API keys, HMAC-SHA256 webhooks |
| Dashboard | Next.js 14 App Router, Tailwind CSS, Recharts, shadcn/ui |
| Monorepo | pnpm workspaces |
