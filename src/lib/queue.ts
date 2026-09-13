import { Queue, Worker, QueueEvents } from 'bullmq';
import { createClient } from 'redis';
import { config } from '../config/env';
import { logger } from '../utils/logger';

// Redis connection for BullMQ (using redis client package)
export const redis = createClient({
  host: config.REDIS_HOST || 'localhost',
  port: config.REDIS_PORT || 6379,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

// Initialize Redis connection
redis.connect().catch((err) => {
  logger.error('Failed to connect to Redis:', err);
});

// Job queues
export const stellarConfirmationQueue = new Queue('stellar-confirmation', { connection: redis });
export const webhookDispatchQueue = new Queue('webhook-dispatch', { connection: redis });

// Queue event handlers
export const stellarConfirmationEvents = new QueueEvents('stellar-confirmation', {
  connection: redis,
});

export const webhookDispatchEvents = new QueueEvents('webhook-dispatch', {
  connection: redis,
});

// Initialize queue event listeners
stellarConfirmationEvents.on('completed', ({ jobId }) => {
  logger.info(`Stellar confirmation job ${jobId} completed`);
});

stellarConfirmationEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Stellar confirmation job ${jobId} failed: ${failedReason}`);
});

webhookDispatchEvents.on('completed', ({ jobId }) => {
  logger.info(`Webhook dispatch job ${jobId} completed`);
});

webhookDispatchEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Webhook dispatch job ${jobId} failed: ${failedReason}`);
});

export async function closeQueues() {
  await stellarConfirmationQueue.close();
  await webhookDispatchQueue.close();
  await stellarConfirmationEvents.close();
  await webhookDispatchEvents.close();
  await redis.quit();
}
