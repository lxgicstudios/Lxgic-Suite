#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { addJob, removeJob, listJobs, runJob, startScheduler, stopScheduler, getJobLogs, CronJob } from './core.js';
import * as fs from 'fs';

const program = new Command();

program
  .name('prompt-cron')
  .version('1.0.0')
  .description('Schedule prompt execution with cron')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('add <schedule> <prompt-file>')
  .description('Add a scheduled job (cron format: "0 9 * * *")')
  .option('--name <name>', 'Job name')
  .option('--output <file>', 'Output file for results')
  .option('--webhook <url>', 'Webhook URL to notify on completion')
  .action(async (schedule, promptFile, options) => {
    const spinner = ora('Adding scheduled job...').start();
    try {
      if (!fs.existsSync(promptFile)) {
        throw new Error(`Prompt file not found: ${promptFile}`);
      }

      const job = await addJob({
        schedule,
        promptFile,
        name: options.name,
        outputFile: options.output,
        webhookUrl: options.webhook,
      });

      spinner.succeed('Job added successfully');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, job }, null, 2));
      } else {
        console.log(chalk.green(`Job ID: ${job.id}`));
        console.log(chalk.blue(`Schedule: ${job.schedule}`));
        console.log(chalk.gray(`Next run: ${job.nextRun}`));
      }
    } catch (error) {
      spinner.fail('Failed to add job');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all scheduled jobs')
  .option('--active', 'Show only active jobs')
  .action(async (options) => {
    try {
      const jobs = await listJobs(options.active);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, jobs }, null, 2));
      } else {
        if (jobs.length === 0) {
          console.log(chalk.yellow('No scheduled jobs'));
          return;
        }

        console.log(chalk.bold('\nScheduled Jobs:'));
        console.log('─'.repeat(70));
        for (const job of jobs) {
          const status = job.enabled ? chalk.green('ACTIVE') : chalk.gray('PAUSED');
          console.log(`${status} ${chalk.blue(job.id)} | ${job.schedule} | ${job.name || job.promptFile}`);
          console.log(chalk.gray(`       Next: ${job.nextRun || 'N/A'} | Last: ${job.lastRun || 'Never'}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('remove <job-id>')
  .description('Remove a scheduled job')
  .action(async (jobId) => {
    const spinner = ora('Removing job...').start();
    try {
      await removeJob(jobId);
      spinner.succeed(`Job ${jobId} removed`);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, removed: jobId }, null, 2));
      }
    } catch (error) {
      spinner.fail('Failed to remove job');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('run [job-id]')
  .description('Run a job immediately (or all jobs)')
  .action(async (jobId) => {
    const spinner = ora('Running job...').start();
    try {
      const result = await runJob(jobId);
      spinner.succeed('Job executed');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, result }, null, 2));
      } else {
        console.log(chalk.green(`Output:`));
        console.log(result.output);
      }
    } catch (error) {
      spinner.fail('Job execution failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the scheduler daemon')
  .option('--foreground', 'Run in foreground')
  .action(async (options) => {
    const spinner = ora('Starting scheduler...').start();
    try {
      await startScheduler(options.foreground);
      spinner.succeed('Scheduler started');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, status: 'running' }, null, 2));
      } else {
        console.log(chalk.green('Scheduler is now running'));
        if (options.foreground) {
          console.log(chalk.gray('Press Ctrl+C to stop'));
        }
      }
    } catch (error) {
      spinner.fail('Failed to start scheduler');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop the scheduler daemon')
  .action(async () => {
    const spinner = ora('Stopping scheduler...').start();
    try {
      await stopScheduler();
      spinner.succeed('Scheduler stopped');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, status: 'stopped' }, null, 2));
      }
    } catch (error) {
      spinner.fail('Failed to stop scheduler');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('logs [job-id]')
  .description('View job execution logs')
  .option('--lines <n>', 'Number of lines to show', '50')
  .action(async (jobId, options) => {
    try {
      const logs = await getJobLogs(jobId, parseInt(options.lines));

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, logs }, null, 2));
      } else {
        if (logs.length === 0) {
          console.log(chalk.yellow('No logs found'));
          return;
        }

        for (const log of logs) {
          const status = log.success ? chalk.green('✓') : chalk.red('✗');
          console.log(`${status} ${chalk.gray(log.timestamp)} ${log.jobId}: ${log.message}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();
