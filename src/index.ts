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

// Health check endpoint
app.get('/health', async (_request, _reply) => {
  let dbStatus = 'unavailable';
  let dbLatency = -1;

  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - startTime;
    dbStatus = 'healthy';
  } catch (error) {
    app.log.error({ error }, 'Database health check failed');
    dbStatus = 'unhealthy';
  }

  const checks = {
    status: dbStatus === 'healthy' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    dependencies: {
      database: {
        status: dbStatus,
        latency: dbLatency > 0 ? `${dbLatency}ms` : 'unknown',
      },
      memory: {
        status: 'healthy',
        usage: `${Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)}%`,
      },
      nodejs: {
        version: process.version,
        status: 'healthy',
      },
    },
  };

  return checks;
});

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
