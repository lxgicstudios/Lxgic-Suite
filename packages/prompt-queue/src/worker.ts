import Queue, { Job, DoneCallback } from 'bull';
import { JobData, JobResult, WorkerConfig, parseRedisUrl, QUEUE_NAMES } from './core';
import { PromptQueue } from './queue';

export type ProcessorFunction = (job: Job<JobData>) => Promise<string>;

export interface WorkerEvents {
  onStart?: (job: Job<JobData>) => void;
  onComplete?: (job: Job<JobData>, result: JobResult) => void;
  onFailed?: (job: Job<JobData>, error: Error) => void;
  onProgress?: (job: Job<JobData>, progress: number) => void;
}

export class PromptWorker {
  private queue: Queue.Queue<JobData>;
  private config: WorkerConfig;
  private processor?: ProcessorFunction;
  private events: WorkerEvents;
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private failedCount: number = 0;
  private startTime?: Date;

  constructor(config: WorkerConfig, events: WorkerEvents = {}) {
    this.config = config;
    this.events = events;

    const redisOpts = parseRedisUrl(config.redis);

    this.queue = new Queue<JobData>(QUEUE_NAMES.MAIN, {
      redis: {
        host: redisOpts.host,
        port: redisOpts.port,
        password: redisOpts.password,
        db: redisOpts.db
      }
    });
  }

  setProcessor(processor: ProcessorFunction): void {
    this.processor = processor;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Worker is already running');
    }

    if (!this.processor) {
      // Use default processor (simulated AI call)
      this.processor = this.defaultProcessor.bind(this);
    }

    this.isRunning = true;
    this.startTime = new Date();

    // Set up event handlers
    this.queue.on('active', (job: Job<JobData>) => {
      this.events.onStart?.(job);
    });

    this.queue.on('completed', (job: Job<JobData>, result: string) => {
      this.processedCount++;
      const jobResult: JobResult = {
        id: job.data.id,
        output: result,
        success: true,
        duration: Date.now() - new Date(job.data.createdAt).getTime(),
        completedAt: new Date().toISOString()
      };
      this.events.onComplete?.(job, jobResult);
    });

    this.queue.on('failed', (job: Job<JobData>, error: Error) => {
      this.failedCount++;
      this.events.onFailed?.(job, error);
    });

    this.queue.on('progress', (job: Job<JobData>, progress: number) => {
      this.events.onProgress?.(job, progress);
    });

    // Start processing
    this.queue.process(this.config.concurrency, async (job: Job<JobData>) => {
      const startTime = Date.now();

      try {
        // Update job data with attempt count
        job.data.attempts = (job.attemptsMade || 0) + 1;

        // Check for timeout
        const timeout = this.config.timeout || 30000;

        const result = await Promise.race([
          this.processor!(job),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Job timeout')), timeout);
          })
        ]);

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Check if max retries exceeded
        const maxRetries = this.config.retries ?? job.data.maxAttempts ?? 3;
        if ((job.attemptsMade || 0) >= maxRetries) {
          // Move to dead letter queue
          const promptQueue = new PromptQueue({
            redis: this.config.redis
          });
          await promptQueue.moveToDeadLetter(job);
          await promptQueue.close();
        }

        throw err;
      }
    });
  }

  private async defaultProcessor(job: Job<JobData>): Promise<string> {
    // Simulate AI processing
    await job.progress(10);

    const processingTime = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, processingTime));

    await job.progress(50);

    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Simulated AI processing error');
    }

    await job.progress(100);

    return `[AI Response] Processed prompt: "${job.data.prompt.substring(0, 50)}..." - Job ID: ${job.data.id}`;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    await this.queue.close();
  }

  async pause(): Promise<void> {
    await this.queue.pause(true);
  }

  async resume(): Promise<void> {
    await this.queue.resume(true);
  }

  getStats(): {
    isRunning: boolean;
    processedCount: number;
    failedCount: number;
    uptime: number;
    concurrency: number;
  } {
    return {
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      concurrency: this.config.concurrency
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export async function createWorker(
  config: WorkerConfig,
  events: WorkerEvents = {}
): Promise<PromptWorker> {
  const worker = new PromptWorker(config, events);
  return worker;
}

export async function runWorker(
  config: WorkerConfig,
  processor?: ProcessorFunction,
  events?: WorkerEvents
): Promise<PromptWorker> {
  const worker = await createWorker(config, events);

  if (processor) {
    worker.setProcessor(processor);
  }

  await worker.start();
  return worker;
}
