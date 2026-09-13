import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { checkTransactionConfirmation } from '../stellar';

const redis = new Redis({
  host: config.REDIS_HOST || 'localhost',
  port: config.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

export const stellarConfirmationWorker = new Worker(
  'stellar-confirmation',
  async (job: Job) => {
    const { transactionId, maxAttempts = 60 } = job.data;

    logger.info(`Processing Stellar confirmation for transaction ${transactionId} (attempt ${job.attemptsMade + 1})`);

    try {
      const confirmed = await checkTransactionConfirmation(transactionId);

      if (confirmed) {
        // Update transaction status in database
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'confirmed' },
        });

        logger.info(`Transaction ${transactionId} confirmed on Stellar`);
        return { confirmed: true, transactionId };
      } else {
        // Retry if not confirmed yet and under max attempts
        if (job.attemptsMade < maxAttempts) {
          throw new Error(`Transaction ${transactionId} not yet confirmed, retrying...`);
        } else {
          // Mark as failed after max attempts
          await prisma.transaction.update({
            where: { id: transactionId },
            data: { status: 'failed' },
          });

          logger.error(`Transaction ${transactionId} confirmation timeout after ${maxAttempts} attempts`);
          return { confirmed: false, transactionId, reason: 'timeout' };
        }
      }
    } catch (error) {
      logger.error(`Error checking Stellar confirmation for ${transactionId}:`, error);
      throw error;
    }
  },
  { connection: redis, defaultJobOptions: { attempts: 60, backoff: { type: 'exponential', delay: 1000 } } }
);

stellarConfirmationWorker.on('completed', (job) => {
  logger.info(`Stellar confirmation worker completed job ${job.id}`);
});

stellarConfirmationWorker.on('failed', (job, err) => {
  logger.error(`Stellar confirmation worker failed job ${job?.id}:`, err);
});
