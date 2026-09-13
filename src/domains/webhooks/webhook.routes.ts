import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { WebhookService, CreateWebhookRequest } from './webhook.service';
import { formatSuccess, formatError } from '../../types/response';
import { authMiddleware } from '../../middleware/auth';
import { ValidationError, AppError } from '../../utils/errors';

export const registerWebhookRoutes = (app: FastifyInstance, prisma: PrismaClient): void => {
  const webhookService = new WebhookService(prisma);

  // POST /api/v1/webhooks - Register a webhook
  app.post<{ Body: CreateWebhookRequest }>(
    '/api/v1/webhooks',
    {
      preHandler: authMiddleware,
      schema: {
        tags: ['Webhooks'],
        summary: 'Register a webhook',
        description: 'Register a webhook to receive events when tips are created and confirmed.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['url', 'events'],
          properties: {
            url: { type: 'string', format: 'uri', description: 'Webhook URL' },
            events: {
              type: 'array',
              items: { type: 'string' },
              description: 'Events to subscribe to (tip.created, tip.confirmed, tip.failed, payout.completed)',
            },
          },
        },
        response: {
          201: { description: 'Webhook registered' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        // Get creator for this user
        const creator = await prisma.creator.findUnique({
          where: { userId: user.userId },
        });

        if (!creator) {
          reply.code(404).send(formatError('Creator not found', 'CREATOR_NOT_FOUND'));
          return;
        }

        const body = request.body as CreateWebhookRequest;
        const result = await webhookService.registerWebhook(creator.id, body);
        reply.code(201).send(formatSuccess(result));
      } catch (error) {
        if (error instanceof ValidationError) {
          reply.code(400).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // GET /api/v1/webhooks - List webhooks
  app.get(
    '/api/v1/webhooks',
    {
      preHandler: authMiddleware,
      schema: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        description: 'Get all webhooks registered for the creator.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { description: 'List of webhooks' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const creator = await prisma.creator.findUnique({
          where: { userId: user.userId },
        });

        if (!creator) {
          reply.code(404).send(formatError('Creator not found', 'CREATOR_NOT_FOUND'));
          return;
        }

        const result = await webhookService.listWebhooks(creator.id);
        reply.send(formatSuccess(result));
      } catch (error) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // DELETE /api/v1/webhooks/:id - Delete webhook
  app.delete<{ Params: { id: string } }>(
    '/api/v1/webhooks/:id',
    {
      preHandler: authMiddleware,
      schema: {
        tags: ['Webhooks'],
        summary: 'Delete webhook',
        description: 'Delete a registered webhook.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Webhook ID' },
          },
        },
        response: {
          200: { description: 'Webhook deleted' },
          401: { description: 'Unauthorized' },
          404: { description: 'Webhook not found' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const creator = await prisma.creator.findUnique({
          where: { userId: user.userId },
        });

        if (!creator) {
          reply.code(404).send(formatError('Creator not found', 'CREATOR_NOT_FOUND'));
          return;
        }

        const { id } = request.params as { id: string };
        await webhookService.deleteWebhook(id, creator.id);
        reply.send(formatSuccess({ message: 'Webhook deleted' }));
      } catch (error) {
        if (error instanceof ValidationError) {
          reply.code(400).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // GET /api/v1/webhooks/:id/history - Get delivery history
  app.get<{ Params: { id: string } }>(
    '/api/v1/webhooks/:id/history',
    {
      preHandler: authMiddleware,
      schema: {
        tags: ['Webhooks'],
        summary: 'Get webhook delivery history',
        description: 'Get recent webhook delivery attempts and their status.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Webhook ID' },
          },
        },
        response: {
          200: { description: 'Delivery history' },
          401: { description: 'Unauthorized' },
          404: { description: 'Webhook not found' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const creator = await prisma.creator.findUnique({
          where: { userId: user.userId },
        });

        if (!creator) {
          reply.code(404).send(formatError('Creator not found', 'CREATOR_NOT_FOUND'));
          return;
        }

        const { id } = request.params as { id: string };
        const result = await webhookService.getDeliveryHistory(id, creator.id);
        reply.send(formatSuccess(result));
      } catch (error) {
        if (error instanceof ValidationError) {
          reply.code(400).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );
};
