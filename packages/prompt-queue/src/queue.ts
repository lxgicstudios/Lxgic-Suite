import Queue, { Job, JobOptions } from 'bull';
import {
  JobData,
  QueueConfig,
  QueueStats,
  createJobData,
  parseRedisUrl,
  QUEUE_NAMES
} from './core';

export class PromptQueue {
  private queue: Queue.Queue<JobData>;
  private deadLetterQueue: Queue.Queue<JobData>;
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
    const redisOpts = parseRedisUrl(config.redis);

    this.queue = new Queue<JobData>(QUEUE_NAMES.MAIN, {
      redis: {
        host: redisOpts.host,
        port: redisOpts.port,
        password: redisOpts.password,
        db: redisOpts.db
      },
      prefix: config.prefix || 'pq'
    });

    this.deadLetterQueue = new Queue<JobData>(QUEUE_NAMES.DEAD_LETTER, {
      redis: {
        host: redisOpts.host,
        port: redisOpts.port,
        password: redisOpts.password,
        db: redisOpts.db
      },
      prefix: config.prefix || 'pq'
    });
  }

  async add(
    prompt: string,
    options: {
      priority?: number;
      delay?: number;
      metadata?: Record<string, any>;
      maxAttempts?: number;
    } = {}
  ): Promise<Job<JobData>> {
    const jobData = createJobData(prompt, {
      priority: options.priority ?? this.config.defaultPriority ?? 0,
      metadata: options.metadata,
      maxAttempts: options.maxAttempts ?? this.config.maxRetries ?? 3
    });

    const jobOptions: JobOptions = {
      priority: jobData.priority,
      attempts: jobData.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: 100,
      removeOnFail: 100
    };

    if (options.delay) {
      jobOptions.delay = options.delay;
    }

    return this.queue.add(jobData, jobOptions);
  }

  async addBulk(
    prompts: Array<{
      prompt: string;
      priority?: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<Job<JobData>[]> {
    const jobs = prompts.map(p => ({
      data: createJobData(p.prompt, {
        priority: p.priority ?? this.config.defaultPriority ?? 0,
        metadata: p.metadata
      }),
      opts: {
        priority: p.priority ?? 0,
        attempts: this.config.maxRetries ?? 3,
        backoff: {
          type: 'exponential' as const,
          delay: 1000
        }
      }
    }));

    return this.queue.addBulk(jobs);
  }

  async getJob(jobId: string): Promise<Job<JobData> | null> {
    return this.queue.getJob(jobId);
  }

  async getJobs(
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    start = 0,
    end = 100
  ): Promise<Job<JobData>[]> {
    return this.queue.getJobs([status], start, end);
  }

  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.getPausedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    };
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async clean(
    grace: number = 0,
    status: 'completed' | 'failed' | 'delayed' | 'wait' | 'active' = 'completed'
  ): Promise<Job<JobData>[]> {
    return this.queue.clean(grace, status);
  }

  async empty(): Promise<void> {
    await this.queue.empty();
  }

  async retryFailed(): Promise<number> {
    const failedJobs = await this.queue.getJobs(['failed']);
    let retried = 0;

    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }

    return retried;
  }

  async moveToDeadLetter(job: Job<JobData>): Promise<void> {
    await this.deadLetterQueue.add(job.data, {
      priority: job.data.priority
    });
  }

  async getDeadLetterJobs(start = 0, end = 100): Promise<Job<JobData>[]> {
    return this.deadLetterQueue.getJobs(['waiting', 'completed', 'failed'], start, end);
  }

  async getDeadLetterStats(): Promise<{ count: number }> {
    const count = await this.deadLetterQueue.count();
    return { count };
  }

  async reprocessDeadLetter(jobId: string): Promise<Job<JobData> | null> {
    const job = await this.deadLetterQueue.getJob(jobId);
    if (!job) return null;

    const newJob = await this.add(job.data.prompt, {
      priority: job.data.priority,
      metadata: {
        ...job.data.metadata,
        reprocessedFrom: jobId,
        reprocessedAt: new Date().toISOString()
      }
    });

    await job.remove();
    return newJob;
  }

  getQueue(): Queue.Queue<JobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.deadLetterQueue.close();
  }

  async isReady(): Promise<boolean> {
    try {
      await this.queue.isReady();
      return true;
    } catch {
      return false;
    }
  }
}

export async function createQueue(config: QueueConfig): Promise<PromptQueue> {
  const queue = new PromptQueue(config);

  // Wait for connection
  const ready = await queue.isReady();
  if (!ready) {
    throw new Error('Failed to connect to Redis');
  }

  return queue;
}
