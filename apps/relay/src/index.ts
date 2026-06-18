import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pino from 'pino';
import { config } from './config.js';
import { errorHandler } from './middleware/error.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { analyticsRoutes } from './routes/analytics.js';
import { relayRoutes, healthRoutes } from './routes/relay.js';
import { webhookRoutes } from './routes/webhooks.js';

const logger = pino({ name: 'relay' });

const app = Fastify({
  logger: true,
  ajv: {
    customOptions: { strict: false },
  },
});

await app.register(cors, { origin: true });

app.setErrorHandler(errorHandler);

await app.register(healthRoutes);
await app.register(subscriptionRoutes);
await app.register(analyticsRoutes);
await app.register(relayRoutes);
await app.register(webhookRoutes);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ port: config.port }, 'SubPay relay listening');
} catch (err) {
  logger.error(err, 'Failed to start server');
  process.exit(1);
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await app.close();
  process.exit(0);
});
