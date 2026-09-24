import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/env';
import { AppError } from './utils/errors';
import { PrismaClient } from '@prisma/client';
import { registerAuthRoutes } from './domains/auth/auth.routes';
import { registerWalletRoutes } from './domains/auth/wallet.routes';
import { registerPaymentRoutes } from './domains/payments/payment.routes';
import { registerUserRoutes } from './domains/users/user.routes';
import { registerCreatorPayoutRoutes } from './domains/creators/payout.routes';
import { registerWebhookRoutes } from './domains/webhooks/webhook.routes';
import { registerAnalyticsRoutes } from './domains/analytics/analytics.routes';
import { registerAdminRoutes } from './domains/admin/admin.routes';
import { registerMetricsRoute } from './routes/metrics.routes';
import { registerHealthRoutes } from './routes/health.routes';
import { setServiceState } from './services/health.service';
import { redis } from './lib/queue';

const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
  },
});

// Initialize Prisma
const prisma = new PrismaClient();

// Register plugins
app.register(cors, {
  origin: true,
  credentials: true,
});

// TODO: Register Swagger documentation once @fastify/swagger is installed
// app.register(swagger, swaggerConfig.swagger);
// app.register(swaggerUi, swaggerConfig.uiConfig);

// Register routes
registerAuthRoutes(app, prisma);
registerWalletRoutes(app, prisma);
registerPaymentRoutes(app, prisma);
registerUserRoutes(app, prisma);
registerCreatorPayoutRoutes(app, prisma);
registerWebhookRoutes(app, prisma);
registerAnalyticsRoutes(app, prisma);
registerAdminRoutes(app, prisma);
registerMetricsRoute(app, prisma);

// Health check endpoints (liveness + readiness). Reuses the shared Redis
// client from lib/queue.ts rather than opening a new connection.
registerHealthRoutes(app, prisma, redis);

// Error handler
app.setErrorHandler(async (error, _request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
    });
    return;
  }

  app.log.error(error);
  reply.code(500).send({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

// Service becomes "ready" only once Fastify has finished booting (all
// plugins/routes registered) - readiness stays 503 until this fires, so
// load balancers don't route traffic before the process can serve it.
app.addHook('onReady', async () => {
  setServiceState('ready');
});

// Graceful shutdown: flip readiness to `shutting_down` first so the
// readiness probe starts failing immediately (giving the load balancer a
// chance to drain traffic away from this instance), then close the
// Fastify server and its dependencies before the process exits.
let shuttingDown = false;

const shutdown = async (signal: 'SIGTERM' | 'SIGINT'): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  app.log.info(`Received ${signal}, starting graceful shutdown`);
  setServiceState('shutting_down');

  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on http://0.0.0.0:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
