/**
 * Core types and configuration for ai-retry
 */

export type RetryStrategy = 'exponential' | 'linear' | 'constant' | 'decorrelated-jitter';

export interface RetryConfig {
  maxAttempts: number;
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  jitterEnabled: boolean;
  jitterFactor: number;
  retryOn: number[]; // Exit codes to retry on
}

export interface RetryResult {
  success: boolean;
  attempts: number;
  totalDurationMs: number;
  lastExitCode: number;
  lastOutput: string;
  lastError: string;
  attemptHistory: AttemptRecord[];
}

export interface AttemptRecord {
  attempt: number;
  exitCode: number;
  durationMs: number;
  delayBeforeMs: number;
  output: string;
  error: string;
}

export const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  strategy: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 60000,
  jitterEnabled: true,
  jitterFactor: 0.1,
  retryOn: [] // Empty means retry on any non-zero exit code
};

export function getConfig(overrides: Partial<RetryConfig> = {}): RetryConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Parse retry-on codes from string
 */
export function parseRetryCodes(codes: string): number[] {
  return codes
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Check if an exit code should trigger a retry
 */
export function shouldRetry(exitCode: number, config: RetryConfig): boolean {
  if (exitCode === 0) {
    return false;
  }

  if (config.retryOn.length === 0) {
    return true; // Retry on any non-zero exit code
  }

  return config.retryOn.includes(exitCode);
}
