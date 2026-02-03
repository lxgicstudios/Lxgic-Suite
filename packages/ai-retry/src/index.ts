#!/usr/bin/env node

/**
 * ai-retry - Smart retry with exponential backoff
 *
 * Wrap any command with intelligent retry logic including
 * exponential backoff, jitter, and configurable strategies.
 */

import { Command } from 'commander';
import { RetryExecutor, wrapScript } from './retry';
import { getConfig, RetryConfig, RetryStrategy, parseRetryCodes, formatDuration } from './core';
import { describeStrategy, getAvailableStrategies } from './strategies';

const program = new Command();

interface ExecOptions {
  maxAttempts?: string;
  backoff?: RetryStrategy;
  baseDelay?: string;
  maxDelay?: string;
  timeout?: string;
  jitter?: boolean;
  jitterFactor?: string;
  retryOn?: string;
  verbose?: boolean;
  json?: boolean;
}

interface ConfigOptions {
  backoff?: RetryStrategy;
  list?: boolean;
  json?: boolean;
}

program
  .name('ai-retry')
  .description('Smart retry with exponential backoff for commands and scripts')
  .version('1.0.0');

// exec command
program
  .command('exec <command> [args...]')
  .description('Execute a command with retry logic')
  .option('-n, --max-attempts <number>', 'Maximum retry attempts', '3')
  .option('-b, --backoff <strategy>', 'Backoff strategy: exponential, linear, constant, decorrelated-jitter', 'exponential')
  .option('--base-delay <ms>', 'Base delay in milliseconds', '1000')
  .option('--max-delay <ms>', 'Maximum delay in milliseconds', '30000')
  .option('-t, --timeout <ms>', 'Command timeout in milliseconds', '60000')
  .option('--jitter', 'Enable jitter', true)
  .option('--jitter-factor <factor>', 'Jitter factor (0-1)', '0.1')
  .option('--retry-on <codes>', 'Comma-separated exit codes to retry on (default: all non-zero)')
  .option('-v, --verbose', 'Show detailed retry information')
  .option('--json', 'Output result as JSON')
  .action(async (command: string, args: string[], options: ExecOptions) => {
    try {
      const config = buildConfig(options);
      const executor = new RetryExecutor(config, options.verbose || false);

      const result = await executor.execute(command, args);

      if (options.json) {
        console.log(JSON.stringify({
          success: result.success,
          command,
          args,
          result: {
            attempts: result.attempts,
            totalDuration: formatDuration(result.totalDurationMs),
            totalDurationMs: result.totalDurationMs,
            lastExitCode: result.lastExitCode,
            attemptHistory: result.attemptHistory.map(a => ({
              attempt: a.attempt,
              exitCode: a.exitCode,
              duration: formatDuration(a.durationMs),
              durationMs: a.durationMs,
              delayBefore: formatDuration(a.delayBeforeMs),
              delayBeforeMs: a.delayBeforeMs
            }))
          }
        }, null, 2));
      }

      process.exit(result.lastExitCode);
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2));
      } else {
        console.error('Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

// wrap command
program
  .command('wrap <script>')
  .description('Wrap a script file with retry logic')
  .option('-n, --max-attempts <number>', 'Maximum retry attempts', '3')
  .option('-b, --backoff <strategy>', 'Backoff strategy', 'exponential')
  .option('--base-delay <ms>', 'Base delay in milliseconds', '1000')
  .option('--max-delay <ms>', 'Maximum delay in milliseconds', '30000')
  .option('-t, --timeout <ms>', 'Command timeout in milliseconds', '60000')
  .option('--jitter', 'Enable jitter', true)
  .option('-v, --verbose', 'Show detailed retry information')
  .option('--json', 'Output result as JSON')
  .action(async (script: string, options: ExecOptions) => {
    try {
      const config = buildConfig(options);
      const result = await wrapScript(script, config, options.verbose || false);

      if (options.json) {
        console.log(JSON.stringify({
          success: result.success,
          script,
          result: {
            attempts: result.attempts,
            totalDuration: formatDuration(result.totalDurationMs),
            totalDurationMs: result.totalDurationMs,
            lastExitCode: result.lastExitCode
          }
        }, null, 2));
      }

      process.exit(result.lastExitCode);
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2));
      } else {
        console.error('Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

// config command
program
  .command('config')
  .description('Show or set retry configuration')
  .option('-b, --backoff <strategy>', 'Show details for a specific backoff strategy')
  .option('-l, --list', 'List all available strategies')
  .option('--json', 'Output as JSON')
  .action((options: ConfigOptions) => {
    if (options.list || (!options.backoff && !options.json)) {
      const strategies = getAvailableStrategies();

      if (options.json) {
        console.log(JSON.stringify({
          strategies: strategies.map(s => ({
            name: s,
            description: describeStrategy(s)
          }))
        }, null, 2));
      } else {
        console.log('Available retry strategies:\n');
        strategies.forEach(s => {
          console.log(`  ${s}`);
          console.log(`    ${describeStrategy(s)}\n`);
        });
      }
      return;
    }

    if (options.backoff) {
      const strategy = options.backoff as RetryStrategy;
      if (options.json) {
        console.log(JSON.stringify({
          strategy,
          description: describeStrategy(strategy)
        }, null, 2));
      } else {
        console.log(`Strategy: ${strategy}`);
        console.log(`Description: ${describeStrategy(strategy)}`);
      }
    }
  });

/**
 * Build RetryConfig from CLI options
 */
function buildConfig(options: ExecOptions): RetryConfig {
  return getConfig({
    maxAttempts: parseInt(options.maxAttempts || '3', 10),
    strategy: (options.backoff as RetryStrategy) || 'exponential',
    baseDelayMs: parseInt(options.baseDelay || '1000', 10),
    maxDelayMs: parseInt(options.maxDelay || '30000', 10),
    timeoutMs: parseInt(options.timeout || '60000', 10),
    jitterEnabled: options.jitter !== false,
    jitterFactor: parseFloat(options.jitterFactor || '0.1'),
    retryOn: options.retryOn ? parseRetryCodes(options.retryOn) : []
  });
}

// Parse and execute
program.parse();
