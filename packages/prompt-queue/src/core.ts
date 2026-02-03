import { v4 as uuidv4 } from 'uuid';

export interface JobData {
  id: string;
  prompt: string;
  priority: number;
  metadata?: Record<string, any>;
  createdAt: string;
  attempts: number;
  maxAttempts: number;
}

export interface JobResult {
  id: string;
  output: string;
  success: boolean;
  error?: string;
  duration: number;
  completedAt: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface WorkerConfig {
  concurrency: number;
  redis: string;
  timeout?: number;
  retries?: number;
}

export interface QueueConfig {
  redis: string;
  prefix?: string;
  defaultPriority?: number;
  maxRetries?: number;
}

export function createJobData(
  prompt: string,
  options: {
    priority?: number;
    metadata?: Record<string, any>;
    maxAttempts?: number;
  } = {}
): JobData {
  return {
    id: uuidv4(),
    prompt,
    priority: options.priority ?? 0,
    metadata: options.metadata,
    createdAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: options.maxAttempts ?? 3
  };
}

export function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0
    };
  } catch {
    // Default connection
    return {
      host: 'localhost',
      port: 6379,
      db: 0
    };
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatOutput(data: any, json: boolean): string {
  if (json) {
    return JSON.stringify(data, null, 2);
  }
  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export const QUEUE_NAMES = {
  MAIN: 'prompt-queue:main',
  DEAD_LETTER: 'prompt-queue:dead-letter'
};

export const JOB_STATUSES = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed'
} as const;
