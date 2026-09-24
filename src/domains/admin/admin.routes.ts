import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { AdminService, FlagWalletRequest, FreezeAccountRequest } from './admin.service';
import { formatSuccess, formatError } from '../../types/response';
import { authMiddleware } from '../../middleware/auth';
import { ValidationError, AppError, UnauthorizedError } from '../../utils/errors';

export const registerAdminRoutes = (app: FastifyInstance, prisma: PrismaClient): void => {
  const adminService = new AdminService(prisma);

  // POST /api/v1/admin/wallets/:address/flag - Flag wallet
  app.post<{ Params: { address: string }; Body: FlagWalletRequest }>(
    '/api/v1/admin/wallets/:address/flag',
    {
      preHandler: authMiddleware,
      schema: {
        
        

        
        params: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Wallet address' },
          },
        },
        body: {
          type: 'object',
          required: ['reason', 'severity'],
          properties: {
            reason: { type: 'string', description: 'Reason for flagging' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            notes: { type: 'string', description: 'Additional notes' },
          },
        },
        response: {
          201: { description: 'Wallet flagged' },
          401: { description: 'Unauthorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const { address } = request.params as { address: string };
        const body = request.body as FlagWalletRequest;
        const result = await adminService.flagWallet(user.userId, address, body);
        reply.code(201).send(formatSuccess(result));
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          reply.code(403).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // POST /api/v1/admin/wallets/flags/:flagId/resolve - Unflag wallet
  app.post<{ Params: { flagId: string } }>(
    '/api/v1/admin/wallets/flags/:flagId/resolve',
    {
      preHandler: authMiddleware,
      schema: {
        
        

        
        params: {
          type: 'object',
          properties: {
            flagId: { type: 'string', description: 'Flag ID' },
          },
        },
        response: {
          200: { description: 'Flag resolved' },
          401: { description: 'Unauthorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const { flagId } = request.params as { flagId: string };
        await adminService.unflagWallet(user.userId, flagId);
        reply.send(formatSuccess({ message: 'Flag resolved' }));
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          reply.code(403).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // POST /api/v1/admin/creators/:creatorId/freeze - Freeze account
  app.post<{ Params: { creatorId: string }; Body: FreezeAccountRequest }>(
    '/api/v1/admin/creators/:creatorId/freeze',
    {
      preHandler: authMiddleware,
      schema: {
        
        

        
        params: {
          type: 'object',
          properties: {
            creatorId: { type: 'string', description: 'Creator ID' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', description: 'Reason for freeze' },
            duration: { type: 'number', description: 'Duration in hours (null = indefinite)' },
            notes: { type: 'string', description: 'Additional notes' },
          },
        },
        response: {
          201: { description: 'Account frozen' },
          401: { description: 'Unauthorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const { creatorId } = request.params as { creatorId: string };
        const body = request.body as FreezeAccountRequest;
        const result = await adminService.freezeAccount(user.userId, creatorId, body);
        reply.code(201).send(formatSuccess(result));
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          reply.code(403).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // POST /api/v1/admin/creators/freezes/:freezeId/resolve - Unfreeze account
  app.post<{ Params: { freezeId: string } }>(
    '/api/v1/admin/creators/freezes/:freezeId/resolve',
    {
      preHandler: authMiddleware,
      schema: {
        
        

        
        params: {
          type: 'object',
          properties: {
            freezeId: { type: 'string', description: 'Freeze ID' },
          },
        },
        response: {
          200: { description: 'Account unfrozen' },
          401: { description: 'Unauthorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const { freezeId } = request.params as { freezeId: string };
        await adminService.unfreezeAccount(user.userId, freezeId);
        reply.send(formatSuccess({ message: 'Account unfrozen' }));
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          reply.code(403).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );

  // GET /api/v1/admin/moderation - Moderation queue
  app.get(
    '/api/v1/admin/moderation',
    {
      preHandler: authMiddleware,
      schema: {
        
        

        
        response: {
          200: { description: 'Moderation queue' },
          401: { description: 'Unauthorized' },
          403: { description: 'Admin only' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) throw new Error('User not found');

        const query = request.query as { page?: string; pageSize?: string; limit?: string };
        const page = query?.page ? parseInt(query.page) : 1;
        const pageSize = query?.pageSize ? parseInt(query.pageSize) : query?.limit ? parseInt(query.limit) : 20;

        const result = await adminService.getModerationQueue(page, pageSize);
        reply.send(formatSuccess(result));
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          reply.code(403).send(formatError(error.message, error.code));
        } else if (error instanceof AppError) {
          reply.code(error.statusCode).send(formatError(error.message, error.code));
        } else {
          throw error;
        }
      }
    }
  );
};
