import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

const redis = new Redis({
  host: config.REDIS_HOST || 'localhost',
  port: config.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

export const webhookDispatchWorker = new Worker(
  'webhook-dispatch',
  async (job: Job) => {
    const { webhookId, transactionId, eventType, payload } = job.data;

    logger.info(`Dispatching webhook ${webhookId} for ${eventType} event on transaction ${transactionId}`);

    try {
      const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });

      if (!webhook) {
        throw new Error(`Webhook ${webhookId} not found`);
      }

      // Create signature for webhook verification
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Dorisio-Signature': `sha256=${signature}`,
          'X-Dorisio-Event': eventType,
          'X-Dorisio-Delivery-Id': job.id,
        },
        timeout: 30000,
      });

      // Track successful dispatch
      await prisma.webhookEvent.create({
        data: {
          webhookId,
          transactionId,
          eventType,
          status: 'success',
          statusCode: response.status,
          deliveryId: job.id!,
        },
      });

      logger.info(`Webhook ${webhookId} dispatched successfully (status ${response.status})`);
      return { success: true, webhookId, statusCode: response.status };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Webhook dispatch failed for ${webhookId}:`, error);

      // Track failed dispatch
      await prisma.webhookEvent.create({
        data: {
          webhookId,
          transactionId,
          eventType,
          status: 'failed',
          error: errorMsg,
          deliveryId: job.id!,
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600 }, // Remove after 1 hour
      removeOnFail: { age: 86400 }, // Keep failures for 24 hours
    },
  }
);

webhookDispatchWorker.on('completed', (job) => {
  logger.info(`Webhook dispatch worker completed job ${job.id}`);
});

webhookDispatchWorker.on('failed', (job, err) => {
  logger.error(`Webhook dispatch worker failed job ${job?.id}:`, err);
});
