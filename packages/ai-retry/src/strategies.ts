/**
 * Retry delay calculation strategies
 */

import { RetryConfig, RetryStrategy } from './core';

/**
 * Calculate delay for the next retry attempt
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig,
  previousDelay?: number
): number {
  let delay: number;

  switch (config.strategy) {
    case 'exponential':
      delay = exponentialBackoff(attempt, config);
      break;
    case 'linear':
      delay = linearBackoff(attempt, config);
      break;
    case 'constant':
      delay = constantBackoff(config);
      break;
    case 'decorrelated-jitter':
      delay = decorrelatedJitter(attempt, config, previousDelay);
      break;
    default:
      delay = exponentialBackoff(attempt, config);
  }

  // Apply jitter if enabled (except for decorrelated-jitter which has its own)
  if (config.jitterEnabled && config.strategy !== 'decorrelated-jitter') {
    delay = applyJitter(delay, config.jitterFactor);
  }

  // Ensure delay doesn't exceed maximum
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Exponential backoff: delay = baseDelay * 2^attempt
 */
function exponentialBackoff(attempt: number, config: RetryConfig): number {
  return config.baseDelayMs * Math.pow(2, attempt - 1);
}

/**
 * Linear backoff: delay = baseDelay * attempt
 */
function linearBackoff(attempt: number, config: RetryConfig): number {
  return config.baseDelayMs * attempt;
}

/**
 * Constant backoff: always returns baseDelay
 */
function constantBackoff(config: RetryConfig): number {
  return config.baseDelayMs;
}

/**
 * Decorrelated jitter (AWS style)
 * delay = random_between(baseDelay, previousDelay * 3)
 */
function decorrelatedJitter(
  attempt: number,
  config: RetryConfig,
  previousDelay?: number
): number {
  if (attempt === 1 || !previousDelay) {
    return config.baseDelayMs;
  }

  const min = config.baseDelayMs;
  const max = previousDelay * 3;
  return randomBetween(min, Math.min(max, config.maxDelayMs));
}

/**
 * Apply jitter to a delay value
 */
function applyJitter(delay: number, jitterFactor: number): number {
  const jitterRange = delay * jitterFactor;
  const jitter = randomBetween(-jitterRange, jitterRange);
  return Math.max(0, delay + jitter);
}

/**
 * Generate random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get human-readable description of strategy
 */
export function describeStrategy(strategy: RetryStrategy): string {
  const descriptions: Record<RetryStrategy, string> = {
    exponential: 'Exponential backoff (delay doubles each attempt)',
    linear: 'Linear backoff (delay increases by base amount each attempt)',
    constant: 'Constant delay between attempts',
    'decorrelated-jitter': 'Decorrelated jitter (AWS-style randomized backoff)'
  };
  return descriptions[strategy] || strategy;
}

/**
 * Get all available strategies
 */
export function getAvailableStrategies(): RetryStrategy[] {
  return ['exponential', 'linear', 'constant', 'decorrelated-jitter'];
}
