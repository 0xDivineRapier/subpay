import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  network: (process.env['SOLANA_NETWORK'] ?? 'devnet') as 'mainnet' | 'devnet',
  rpcEndpoint: process.env['SOLANA_RPC_ENDPOINT'] ?? 'https://api.devnet.solana.com',
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  relayHotWalletPrivateKey: process.env['RELAY_HOT_WALLET_PRIVATE_KEY'] ?? '',
  apiBaseUrl: process.env['API_BASE_URL'] ?? 'http://localhost:3001',
  webhookSigningSecretSalt: process.env['WEBHOOK_SIGNING_SECRET_SALT'] ?? 'subpay-dev-salt',
  /** Hard cap: relay wallet must never operate above 1 SOL */
  maxHotWalletSol: 1.0,
  /** Minimum SOL balance before charges are rejected */
  minRelayBalanceSol: 0.05,
  /** Balance below which alerts fire */
  lowBalanceThresholdSol: 0.1,
} as const;
