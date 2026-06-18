import { SubPayClient } from '@subpay/solana';

const apiKey = process.env['SUBPAY_API_KEY'] ?? '';
const network = (process.env['SUBPAY_NETWORK'] ?? 'devnet') as 'mainnet' | 'devnet';
const rpcEndpoint = process.env['SUBPAY_RELAY_URL'] ?? 'http://localhost:3001';

export const subpay = new SubPayClient({ apiKey, network, rpcEndpoint });
