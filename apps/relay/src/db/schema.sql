CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount_usdc NUMERIC(12,2) NOT NULL,
  interval_days INTEGER NOT NULL,
  max_amount_usdc NUMERIC(12,2) NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  delegation_tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','paused','cancelled')),
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_charge_at TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS charge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success','failed','pending')),
  tx_signature TEXT,
  failure_reason TEXT,
  amount_usdc NUMERIC(12,2) NOT NULL,
  fee_sol NUMERIC(18,9)
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('delivered','failed','pending','retrying')),
  attempt_count INTEGER DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  response_status INTEGER
);

CREATE TABLE IF NOT EXISTS relay_balance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
  sol_balance NUMERIC(18,9) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_operator ON subscriptions(operator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_wallet ON subscriptions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_charge ON subscriptions(next_charge_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_charge_attempts_subscription ON charge_attempts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
