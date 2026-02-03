#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  setBudget,
  recordUsage,
  getBudgetStatus,
  resetBudget,
  getBudgetHistory,
  isBudgetExceeded,
  getRemainingBudget,
  formatCurrency,
  getDataPath,
  BudgetStatus,
  HistoryEntry,
} from './core';

const program = new Command();

program
  .name('ai-budget')
  .description('Set and track AI spending limits with alerts and usage history')
  .version('1.0.0');

/**
 * Parse percentage string (e.g., "80%" -> 80)
 */
function parsePercentage(value: string): number {
  return parseInt(value.replace('%', ''), 10);
}

/**
 * Display budget status
 */
function displayStatus(status: BudgetStatus, options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(chalk.bold('\n AI Budget Status'));
  console.log(chalk.gray('─'.repeat(50)));

  // Limits
  console.log(chalk.bold('\nBudget Limits:'));
  if (status.limits.daily !== undefined) {
    console.log(`  Daily:   ${formatCurrency(status.limits.daily, status.currency)}`);
  }
  if (status.limits.weekly !== undefined) {
    console.log(`  Weekly:  ${formatCurrency(status.limits.weekly, status.currency)}`);
  }
  if (status.limits.monthly !== undefined) {
    console.log(`  Monthly: ${formatCurrency(status.limits.monthly, status.currency)}`);
  }

  if (!status.limits.daily && !status.limits.weekly && !status.limits.monthly) {
    console.log(chalk.gray('  No limits set'));
  }

  // Current usage
  console.log(chalk.bold('\nCurrent Usage:'));

  const displayUsage = (label: string, usage: number, limit: number | undefined, percent: number) => {
    const usageStr = formatCurrency(usage, status.currency);
    const limitStr = limit ? formatCurrency(limit, status.currency) : 'No limit';

    let color = chalk.green;
    if (percent >= 100) color = chalk.red;
    else if (percent >= 80) color = chalk.yellow;

    const bar = limit ? createProgressBar(percent) : '';

    console.log(`  ${label}:`);
    console.log(`    ${color(usageStr)} / ${limitStr}`);
    if (bar) {
      console.log(`    ${bar} ${color(percent.toFixed(1) + '%')}`);
    }
  };

  displayUsage('Daily', status.currentUsage.daily, status.limits.daily, status.percentUsed.daily);
  displayUsage('Weekly', status.currentUsage.weekly, status.limits.weekly, status.percentUsed.weekly);
  displayUsage('Monthly', status.currentUsage.monthly, status.limits.monthly, status.percentUsed.monthly);

  // Alerts
  if (status.alerts.length > 0) {
    console.log(chalk.bold('\nAlert Thresholds:'));
    for (const alert of status.alerts) {
      const icon = alert.triggered ? chalk.yellow('!') : chalk.gray('-');
      const status_text = alert.triggered ? chalk.yellow('triggered') : chalk.gray('pending');
      console.log(`  ${icon} ${alert.percentage}% - ${status_text}`);
    }
  }

  // Check if exceeded
  const exceeded = isBudgetExceeded();
  if (exceeded.exceeded) {
    console.log(chalk.bold.red('\n! Budget Exceeded:'));
    for (const detail of exceeded.details) {
      console.log(chalk.red(`  ${detail}`));
    }
  }

  console.log('');
}

/**
 * Create a progress bar
 */
function createProgressBar(percent: number, width: number = 20): string {
  const filled = Math.min(width, Math.round((percent / 100) * width));
  const empty = width - filled;

  let color = chalk.green;
  if (percent >= 100) color = chalk.red;
  else if (percent >= 80) color = chalk.yellow;

  return color('[' + '='.repeat(filled) + ' '.repeat(empty) + ']');
}

/**
 * Display history
 */
function displayHistory(history: HistoryEntry[], options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(history, null, 2));
    return;
  }

  console.log(chalk.bold('\n Budget History'));
  console.log(chalk.gray('─'.repeat(60)));

  for (const entry of history) {
    const spent = formatCurrency(entry.totalSpent, 'USD');
    const limit = entry.limit ? formatCurrency(entry.limit, 'USD') : 'No limit';
    const percent = entry.percentUsed !== undefined ? `${entry.percentUsed.toFixed(1)}%` : '-';

    let color = chalk.green;
    if (entry.percentUsed && entry.percentUsed >= 100) color = chalk.red;
    else if (entry.percentUsed && entry.percentUsed >= 80) color = chalk.yellow;

    console.log(`${chalk.cyan(entry.period.padEnd(20))} ${color(spent.padStart(10))} / ${limit.padStart(10)} (${percent})`);
  }

  console.log('');
}

// Set command
program
  .command('set')
  .description('Set budget limits and alert thresholds')
  .option('-d, --daily <amount>', 'Daily spending limit', parseFloat)
  .option('-w, --weekly <amount>', 'Weekly spending limit', parseFloat)
  .option('-m, --monthly <amount>', 'Monthly spending limit', parseFloat)
  .option('-a, --alert <percentages...>', 'Alert thresholds (e.g., 50% 80% 100%)')
  .option('-c, --currency <code>', 'Currency code (USD, EUR, GBP, JPY)')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const alerts = options.alert?.map(parsePercentage);

      const config = setBudget({
        daily: options.daily,
        weekly: options.weekly,
        monthly: options.monthly,
        alert: alerts,
        currency: options.currency,
      });

      if (options.json) {
        console.log(JSON.stringify({ success: true, config }, null, 2));
      } else {
        console.log(chalk.green('\nBudget settings updated successfully!'));
        displayStatus(getBudgetStatus(), { json: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show current budget status')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const status = getBudgetStatus();
      displayStatus(status, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Add usage command
program
  .command('add <amount>')
  .description('Record AI usage')
  .option('-m, --model <model>', 'Model name (e.g., claude-3-opus)')
  .option('-p, --project <project>', 'Project name')
  .option('-d, --description <desc>', 'Description of usage')
  .option('--json', 'Output in JSON format')
  .action((amount: string, options) => {
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        throw new Error('Invalid amount. Please provide a positive number.');
      }

      const result = recordUsage({
        amount: parsedAmount,
        model: options.model,
        project: options.project,
        description: options.description,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(`\nRecorded: ${formatCurrency(parsedAmount, 'USD')}`));
        if (options.model) console.log(`  Model: ${options.model}`);
        if (options.project) console.log(`  Project: ${options.project}`);

        // Show warnings if approaching limits
        const exceeded = isBudgetExceeded();
        if (exceeded.exceeded) {
          console.log(chalk.bold.red('\n! Warning: Budget exceeded!'));
          for (const detail of exceeded.details) {
            console.log(chalk.red(`  ${detail}`));
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Reset command
program
  .command('reset')
  .description('Reset usage data')
  .option('-p, --period <period>', 'Period to reset (daily, weekly, monthly, all)', 'all')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const period = options.period as 'daily' | 'weekly' | 'monthly' | 'all';
      resetBudget(period);

      if (options.json) {
        console.log(JSON.stringify({ success: true, period }, null, 2));
      } else {
        console.log(chalk.green(`\nUsage data reset for: ${period}`));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// History command
program
  .command('history')
  .description('Show usage history')
  .option('-n, --periods <number>', 'Number of periods to show', '6')
  .option('-t, --type <type>', 'Period type (daily, weekly, monthly)', 'monthly')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const periods = parseInt(options.periods, 10);
      const periodType = options.type as 'daily' | 'weekly' | 'monthly';
      const history = getBudgetHistory(periods, periodType);

      displayHistory(history, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Remaining command
program
  .command('remaining')
  .description('Show remaining budget')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const remaining = getRemainingBudget();
      const status = getBudgetStatus();

      if (options.json) {
        console.log(JSON.stringify(remaining, null, 2));
      } else {
        console.log(chalk.bold('\n Remaining Budget'));
        console.log(chalk.gray('─'.repeat(30)));

        if (remaining.daily !== undefined) {
          console.log(`  Daily:   ${chalk.green(formatCurrency(remaining.daily, status.currency))}`);
        }
        if (remaining.weekly !== undefined) {
          console.log(`  Weekly:  ${chalk.green(formatCurrency(remaining.weekly, status.currency))}`);
        }
        if (remaining.monthly !== undefined) {
          console.log(`  Monthly: ${chalk.green(formatCurrency(remaining.monthly, status.currency))}`);
        }

        if (remaining.daily === undefined && remaining.weekly === undefined && remaining.monthly === undefined) {
          console.log(chalk.gray('  No limits set'));
        }

        console.log('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Config path command
program
  .command('config-path')
  .description('Show configuration file path')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    const configPath = getDataPath();

    if (options.json) {
      console.log(JSON.stringify({ path: configPath }, null, 2));
    } else {
      console.log(`Configuration directory: ${configPath}`);
    }
  });

// Default action - show status
program.action(() => {
  const status = getBudgetStatus();
  displayStatus(status, { json: false });
});

program.parse();
