#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Job } from 'bull';
import {
  formatOutput,
  formatDuration,
  truncate,
  JobData,
  JobResult
} from './core';
import { createQueue, PromptQueue } from './queue';
import { createWorker, PromptWorker } from './worker';

const program = new Command();

program
  .name('prompt-queue')
  .description('Redis-backed queue for AI tasks')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

program
  .command('start')
  .description('Start the queue server')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .option('-p, --port <port>', 'HTTP API port', '3456')
  .action(async (options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Connecting to Redis...');

      const queue = await createQueue({
        redis: options.redis
      });

      spinner.succeed('Connected to Redis');

      if (jsonOutput) {
        console.log(formatOutput({
          success: true,
          message: 'Queue server started',
          redis: options.redis
        }, true));
      } else {
        console.log(chalk.green('\nQueue server is running'));
        console.log(`Redis: ${options.redis}`);
        console.log('\nPress Ctrl+C to stop\n');
      }

      // Keep process alive
      process.on('SIGINT', async () => {
        spinner.start('Shutting down...');
        await queue.close();
        spinner.succeed('Queue server stopped');
        process.exit(0);
      });

      // Periodic stats output
      if (!jsonOutput) {
        setInterval(async () => {
          const stats = await queue.getStats();
          console.log(chalk.dim(
            `[Stats] Waiting: ${stats.waiting} | Active: ${stats.active} | Completed: ${stats.completed} | Failed: ${stats.failed}`
          ));
        }, 30000);
      }

      // Keep alive
      await new Promise(() => {});
    } catch (error) {
      spinner.fail('Failed to start queue server');

      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }

      process.exit(1);
    }
  });

program
  .command('add <prompt>')
  .description('Add a prompt to the queue')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .option('-p, --priority <number>', 'Job priority (higher = more important)', '0')
  .option('-d, --delay <ms>', 'Delay before processing (ms)')
  .option('-m, --metadata <json>', 'Job metadata as JSON')
  .action(async (prompt: string, options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Adding job to queue...');

      const queue = await createQueue({
        redis: options.redis
      });

      const jobOptions: any = {
        priority: parseInt(options.priority, 10)
      };

      if (options.delay) {
        jobOptions.delay = parseInt(options.delay, 10);
      }

      if (options.metadata) {
        try {
          jobOptions.metadata = JSON.parse(options.metadata);
        } catch {
          throw new Error('Invalid metadata JSON');
        }
      }

      const job = await queue.add(prompt, jobOptions);
      await queue.close();

      spinner.succeed('Job added to queue');

      if (jsonOutput) {
        console.log(formatOutput({
          success: true,
          jobId: job.id,
          data: job.data
        }, true));
      } else {
        console.log('');
        console.log(`Job ID: ${chalk.cyan(job.id)}`);
        console.log(`Prompt: ${truncate(prompt, 60)}`);
        console.log(`Priority: ${job.data.priority}`);
        if (options.delay) {
          console.log(`Delay: ${options.delay}ms`);
        }
      }
    } catch (error) {
      spinner.fail('Failed to add job');

      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }

      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show queue status')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .option('-l, --list <status>', 'List jobs by status (waiting, active, completed, failed, delayed)')
  .option('-n, --limit <number>', 'Number of jobs to show', '10')
  .action(async (options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Fetching queue status...');

      const queue = await createQueue({
        redis: options.redis
      });

      const stats = await queue.getStats();
      const dlStats = await queue.getDeadLetterStats();

      spinner.stop();

      if (options.list) {
        const status = options.list as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
        const limit = parseInt(options.limit, 10);
        const jobs = await queue.getJobs(status, 0, limit);

        if (jsonOutput) {
          console.log(formatOutput({
            success: true,
            stats,
            deadLetter: dlStats,
            jobs: jobs.map(j => ({
              id: j.id,
              data: j.data,
              progress: j.progress(),
              attemptsMade: j.attemptsMade
            }))
          }, true));
        } else {
          console.log(chalk.bold(`\n${status.toUpperCase()} Jobs (${jobs.length}):\n`));

          for (const job of jobs) {
            console.log(`  ${chalk.cyan(String(job.id))} - ${truncate(job.data.prompt, 40)}`);
            console.log(`    Priority: ${job.data.priority} | Attempts: ${job.attemptsMade}`);
          }

          if (jobs.length === 0) {
            console.log(chalk.dim('  No jobs found'));
          }
        }
      } else {
        if (jsonOutput) {
          console.log(formatOutput({
            success: true,
            stats,
            deadLetter: dlStats
          }, true));
        } else {
          console.log(chalk.bold('\nQueue Status:\n'));
          console.log(`  Waiting:   ${chalk.yellow(stats.waiting)}`);
          console.log(`  Active:    ${chalk.blue(stats.active)}`);
          console.log(`  Completed: ${chalk.green(stats.completed)}`);
          console.log(`  Failed:    ${chalk.red(stats.failed)}`);
          console.log(`  Delayed:   ${chalk.magenta(stats.delayed)}`);
          console.log(`  Paused:    ${chalk.gray(stats.paused)}`);
          console.log('');
          console.log(`  Dead Letter: ${chalk.red(dlStats.count)}`);
        }
      }

      await queue.close();
    } catch (error) {
      spinner.fail('Failed to get status');

      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }

      process.exit(1);
    }
  });

program
  .command('worker')
  .description('Start a worker process')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .option('-c, --concurrency <number>', 'Number of concurrent jobs', '5')
  .option('-t, --timeout <ms>', 'Job timeout in milliseconds', '30000')
  .option('--retries <number>', 'Max retries per job', '3')
  .action(async (options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Starting worker...');

      const concurrency = parseInt(options.concurrency, 10);
      const timeout = parseInt(options.timeout, 10);
      const retries = parseInt(options.retries, 10);

      const worker = await createWorker(
        {
          redis: options.redis,
          concurrency,
          timeout,
          retries
        },
        {
          onStart: (job: Job<JobData>) => {
            if (!jsonOutput) {
              console.log(chalk.blue(`[START] Job ${job.id}: ${truncate(job.data.prompt, 40)}`));
            }
          },
          onComplete: (job: Job<JobData>, result: JobResult) => {
            if (jsonOutput) {
              console.log(formatOutput({
                event: 'complete',
                jobId: job.id,
                result
              }, true));
            } else {
              console.log(chalk.green(`[DONE] Job ${job.id} completed in ${formatDuration(result.duration)}`));
            }
          },
          onFailed: (job: Job<JobData>, error: Error) => {
            if (jsonOutput) {
              console.log(formatOutput({
                event: 'failed',
                jobId: job.id,
                error: error.message
              }, true));
            } else {
              console.log(chalk.red(`[FAIL] Job ${job.id}: ${error.message}`));
            }
          },
          onProgress: (job: Job<JobData>, progress: number) => {
            if (!jsonOutput) {
              console.log(chalk.dim(`[PROGRESS] Job ${job.id}: ${progress}%`));
            }
          }
        }
      );

      await worker.start();
      spinner.succeed(`Worker started with concurrency: ${concurrency}`);

      if (!jsonOutput) {
        console.log('');
        console.log('Press Ctrl+C to stop');
        console.log('');
      }

      // Handle shutdown
      process.on('SIGINT', async () => {
        spinner.start('Shutting down worker...');
        await worker.stop();
        const stats = worker.getStats();
        spinner.succeed('Worker stopped');

        if (!jsonOutput) {
          console.log('');
          console.log(`Processed: ${stats.processedCount}`);
          console.log(`Failed: ${stats.failedCount}`);
          console.log(`Uptime: ${formatDuration(stats.uptime)}`);
        }

        process.exit(0);
      });

      // Keep alive
      await new Promise(() => {});
    } catch (error) {
      spinner.fail('Failed to start worker');

      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }

      process.exit(1);
    }
  });

program
  .command('pause')
  .description('Pause the queue')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .action(async (options) => {
    const jsonOutput = program.opts().json;

    try {
      const queue = await createQueue({ redis: options.redis });
      await queue.pause();
      await queue.close();

      if (jsonOutput) {
        console.log(formatOutput({ success: true, message: 'Queue paused' }, true));
      } else {
        console.log(chalk.yellow('Queue paused'));
      }
    } catch (error) {
      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume the queue')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .action(async (options) => {
    const jsonOutput = program.opts().json;

    try {
      const queue = await createQueue({ redis: options.redis });
      await queue.resume();
      await queue.close();

      if (jsonOutput) {
        console.log(formatOutput({ success: true, message: 'Queue resumed' }, true));
      } else {
        console.log(chalk.green('Queue resumed'));
      }
    } catch (error) {
      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  });

program
  .command('retry')
  .description('Retry all failed jobs')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .action(async (options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Retrying failed jobs...');

      const queue = await createQueue({ redis: options.redis });
      const count = await queue.retryFailed();
      await queue.close();

      spinner.succeed(`Retried ${count} jobs`);

      if (jsonOutput) {
        console.log(formatOutput({ success: true, retriedCount: count }, true));
      }
    } catch (error) {
      spinner.fail('Failed to retry jobs');

      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean completed/failed jobs')
  .option('-r, --redis <url>', 'Redis URL', 'redis://localhost:6379')
  .option('-s, --status <status>', 'Job status to clean (completed, failed)', 'completed')
  .option('-g, --grace <ms>', 'Grace period in ms', '0')
  .action(async (options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Cleaning jobs...');

      const queue = await createQueue({ redis: options.redis });
      const grace = parseInt(options.grace, 10);
      const cleaned = await queue.clean(grace, options.status);
      await queue.close();

      spinner.succeed(`Cleaned ${cleaned.length} jobs`);

      if (jsonOutput) {
        console.log(formatOutput({ success: true, cleanedCount: cleaned.length }, true));
      }
    } catch (error) {
      spinner.fail('Failed to clean jobs');

      if (jsonOutput) {
        console.log(formatOutput({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, true));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  });

program.parse();
