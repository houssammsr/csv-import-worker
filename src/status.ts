import { Redis } from '@upstash/redis';
import { JobStatus } from './types';

// Redis Configuration
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Missing Redis configuration environment variables');
}

// Initialize Redis client
const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Get job status from Redis
 */
export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const statusString = await redis.get(`job:${jobId}`);

    if (!statusString) {
      return null;
    }

    return JSON.parse(statusString as string) as JobStatus;
  } catch (error) {
    console.error(`Failed to get job status for ${jobId}:`, error);
    return null;
  }
}

/**
 * Update job status in Redis
 */
export async function updateJobStatus(jobId: string, updates: Partial<JobStatus>): Promise<void> {
  try {
    // Get current status
    const currentStatus = await getJobStatus(jobId);

    if (!currentStatus) {
      console.warn(`Job ${jobId} not found in Redis, creating new status`);
    }

    // Merge updates with current status
    const updatedStatus: JobStatus = {
      jobId,
      state: 'queued',
      ...currentStatus,
      ...updates,
    };

    // Store with 24-hour TTL
    await redis.setex(`job:${jobId}`, 86400, JSON.stringify(updatedStatus));

    console.log(`Updated job status for ${jobId}:`, {
      state: updatedStatus.state,
      processedRows: updatedStatus.processedRows,
      listId: updatedStatus.listId,
      error: updatedStatus.error,
    });
  } catch (error) {
    console.error(`Failed to update job status for ${jobId}:`, error);
    throw error;
  }
}

/**
 * Mark job as running
 */
export async function markRunning(jobId: string): Promise<void> {
  return updateJobStatus(jobId, {
    state: 'running',
    startedAt: new Date().toISOString(),
  });
}

/**
 * Report progress (processed rows)
 */
export async function reportProgress(jobId: string, processedRows: number): Promise<void> {
  return updateJobStatus(jobId, {
    processedRows,
  });
}

/**
 * Mark job as succeeded
 */
export async function markSucceeded(jobId: string, listId: string): Promise<void> {
  return updateJobStatus(jobId, {
    state: 'succeeded',
    listId,
    finishedAt: new Date().toISOString(),
  });
}

/**
 * Mark job as failed
 */
export async function markFailed(jobId: string, error: string): Promise<void> {
  return updateJobStatus(jobId, {
    state: 'failed',
    error,
    finishedAt: new Date().toISOString(),
  });
}

/**
 * Check if job has already been processed (idempotency check)
 */
export async function isJobCompleted(jobId: string): Promise<boolean> {
  const status = await getJobStatus(jobId);
  return status?.state === 'succeeded' || status?.state === 'failed';
}
