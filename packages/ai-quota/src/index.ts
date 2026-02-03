#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { setQuota, getQuota, checkQuota, listQuotas, resetQuota, QuotaConfig } from './core.js';

const program = new Command();

program
  .name('ai-quota')
  .version('1.0.0')
  .description('Manage per-user/team AI quotas')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('set <user>')
  .description('Set quota for a user or team')
  .option('--daily <tokens>', 'Daily token limit')
  .option('--monthly <tokens>', 'Monthly token limit')
  .option('--requests <count>', 'Request limit per period')
  .option('--cost <amount>', 'Cost limit in dollars')
  .action(async (user, options) => {
    const spinner = ora('Setting quota...').start();
    try {
      const quotaConfig: QuotaConfig = {
        user,
        dailyTokens: options.daily ? parseInt(options.daily) : undefined,
        monthlyTokens: options.monthly ? parseInt(options.monthly) : undefined,
        requestLimit: options.requests ? parseInt(options.requests) : undefined,
        costLimit: options.cost ? parseFloat(options.cost) : undefined,
      };

      const result = await setQuota(quotaConfig);
      spinner.succeed('Quota set successfully');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, quota: result }, null, 2));
      } else {
        console.log(chalk.green(`Quota for ${chalk.bold(user)}:`));
        if (result.dailyTokens) console.log(`  Daily tokens: ${result.dailyTokens.toLocaleString()}`);
        if (result.monthlyTokens) console.log(`  Monthly tokens: ${result.monthlyTokens.toLocaleString()}`);
        if (result.requestLimit) console.log(`  Request limit: ${result.requestLimit}`);
        if (result.costLimit) console.log(`  Cost limit: $${result.costLimit}`);
      }
    } catch (error) {
      spinner.fail('Failed to set quota');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('get <user>')
  .description('Get quota for a user')
  .action(async (user) => {
    try {
      const quota = await getQuota(user);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, quota }, null, 2));
      } else {
        if (!quota) {
          console.log(chalk.yellow(`No quota set for ${user}`));
          return;
        }

        console.log(chalk.bold(`Quota for ${user}:`));
        console.log('─'.repeat(40));
        if (quota.dailyTokens) {
          const dailyPercent = ((quota.dailyUsed || 0) / quota.dailyTokens * 100).toFixed(1);
          console.log(`  Daily: ${(quota.dailyUsed || 0).toLocaleString()} / ${quota.dailyTokens.toLocaleString()} (${dailyPercent}%)`);
        }
        if (quota.monthlyTokens) {
          const monthlyPercent = ((quota.monthlyUsed || 0) / quota.monthlyTokens * 100).toFixed(1);
          console.log(`  Monthly: ${(quota.monthlyUsed || 0).toLocaleString()} / ${quota.monthlyTokens.toLocaleString()} (${monthlyPercent}%)`);
        }
        if (quota.costLimit) {
          console.log(`  Cost: $${(quota.costUsed || 0).toFixed(2)} / $${quota.costLimit.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('check <user>')
  .description('Check if user has remaining quota')
  .option('--tokens <count>', 'Tokens to check', '1000')
  .action(async (user, options) => {
    try {
      const result = await checkQuota(user, parseInt(options.tokens));

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        if (result.allowed) {
          console.log(chalk.green(`✓ ${user} has sufficient quota`));
          console.log(chalk.gray(`  Remaining: ${result.remaining.toLocaleString()} tokens`));
        } else {
          console.log(chalk.red(`✗ ${user} has exceeded quota`));
          console.log(chalk.yellow(`  Limit: ${result.limit.toLocaleString()}`));
          console.log(chalk.yellow(`  Used: ${result.used.toLocaleString()}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all quotas')
  .option('--exceeded', 'Show only exceeded quotas')
  .action(async (options) => {
    const spinner = ora('Loading quotas...').start();
    try {
      const quotas = await listQuotas(options.exceeded);
      spinner.stop();

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, quotas }, null, 2));
      } else {
        if (quotas.length === 0) {
          console.log(chalk.yellow('No quotas configured'));
          return;
        }

        console.log(chalk.bold('\nQuota Summary:'));
        console.log('─'.repeat(60));
        for (const q of quotas) {
          const status = q.exceeded ? chalk.red('EXCEEDED') : chalk.green('OK');
          console.log(`${q.user.padEnd(30)} ${status}`);
        }
      }
    } catch (error) {
      spinner.fail('Failed to load quotas');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('reset <user>')
  .description('Reset quota usage for a user')
  .option('--daily', 'Reset daily usage only')
  .option('--monthly', 'Reset monthly usage only')
  .action(async (user, options) => {
    const spinner = ora('Resetting quota...').start();
    try {
      await resetQuota(user, options.daily ? 'daily' : options.monthly ? 'monthly' : 'all');
      spinner.succeed(`Quota reset for ${user}`);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, user, reset: true }, null, 2));
      }
    } catch (error) {
      spinner.fail('Failed to reset quota');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();
