#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  enableCache,
  disableCache,
  getStatus,
  clearCache,
  getCacheStats,
  getSavingsReport,
  listEntries,
  setTTL,
  resetStats,
  checkCache,
  addToCache,
  formatStatus,
  formatStats,
  formatSavingsReport,
  formatEntries
} from './core';

const program = new Command();

program
  .name('prompt-cache')
  .description('Cache repeated prompts to save money - reduce API costs with intelligent caching')
  .version('1.0.0');

// Enable command
program
  .command('enable')
  .description('Enable prompt caching')
  .option('--ttl <seconds>', 'Time-to-live in seconds', '3600')
  .option('--json', 'Output as JSON')
  .action((options: { ttl: string; json?: boolean }) => {
    try {
      const ttl = parseInt(options.ttl);
      const status = enableCache(ttl);

      if (options.json) {
        console.log(JSON.stringify({ success: true, ...status }, null, 2));
      } else {
        console.log(chalk.green('\nCache enabled successfully!\n'));
        console.log(formatStatus(status));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Disable command
program
  .command('disable')
  .description('Disable prompt caching')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    try {
      const status = disableCache();

      if (options.json) {
        console.log(JSON.stringify({ success: true, ...status }, null, 2));
      } else {
        console.log(chalk.yellow('\nCache disabled.\n'));
        console.log(formatStatus(status));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show current cache status')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    try {
      const status = getStatus();

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nPrompt Cache Status\n'));
        console.log(formatStatus(status));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Clear command
program
  .command('clear')
  .description('Clear all cached entries')
  .option('-f, --force', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action((options: { force?: boolean; json?: boolean }) => {
    try {
      const result = clearCache();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(`\nCleared ${result.clearedEntries} cache entries.\n`));
        console.log(formatStatus(result.status));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show detailed cache statistics')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    try {
      const stats = getCacheStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nCache Statistics\n'));
        console.log(formatStats(stats));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Savings command
program
  .command('savings')
  .description('Show estimated savings from caching')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    try {
      const report = getSavingsReport();

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nCache Savings Report\n'));
        console.log(formatSavingsReport(report));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List cache entries')
  .option('-n, --limit <count>', 'Limit number of entries', '20')
  .option('--json', 'Output as JSON')
  .action((options: { limit: string; json?: boolean }) => {
    try {
      const limit = parseInt(options.limit);
      const entries = listEntries(limit);

      if (options.json) {
        console.log(JSON.stringify(entries, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nCache Entries\n'));
        console.log(formatEntries(entries));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Set TTL command
program
  .command('ttl <seconds>')
  .description('Set cache TTL in seconds')
  .option('--json', 'Output as JSON')
  .action((seconds: string, options: { json?: boolean }) => {
    try {
      const ttl = parseInt(seconds);
      const status = setTTL(ttl);

      if (options.json) {
        console.log(JSON.stringify({ success: true, ...status }, null, 2));
      } else {
        console.log(chalk.green(`\nTTL set to ${ttl} seconds.\n`));
        console.log(formatStatus(status));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Check command
program
  .command('check')
  .description('Check if a prompt is in cache')
  .requiredOption('-p, --prompt <prompt>', 'The prompt to check')
  .option('-m, --model <model>', 'Model name', 'claude-3.5-sonnet')
  .option('--json', 'Output as JSON')
  .action((options: { prompt: string; model: string; json?: boolean }) => {
    try {
      const result = checkCache(options.prompt, options.model);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.hit) {
          console.log(chalk.green('\nCache HIT!\n'));
          console.log(`Key: ${result.key}`);
          if (result.entry) {
            console.log(`Hits: ${result.entry.hitCount}`);
            console.log(`Response preview: ${result.entry.response.substring(0, 100)}...`);
          }
        } else {
          console.log(chalk.yellow('\nCache MISS\n'));
          console.log(`Key: ${result.key}`);
        }
        console.log('');
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Add command
program
  .command('add')
  .description('Add a prompt/response pair to cache')
  .requiredOption('-p, --prompt <prompt>', 'The prompt')
  .requiredOption('-r, --response <response>', 'The response')
  .option('-m, --model <model>', 'Model name', 'claude-3.5-sonnet')
  .option('--input-tokens <tokens>', 'Input token count', '100')
  .option('--output-tokens <tokens>', 'Output token count', '100')
  .option('--cost <cost>', 'Estimated cost', '0.01')
  .option('--json', 'Output as JSON')
  .action((options: {
    prompt: string;
    response: string;
    model: string;
    inputTokens: string;
    outputTokens: string;
    cost: string;
    json?: boolean;
  }) => {
    try {
      const result = addToCache(
        options.prompt,
        options.response,
        options.model,
        parseInt(options.inputTokens),
        parseInt(options.outputTokens),
        parseFloat(options.cost)
      );

      if (options.json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        console.log(chalk.green('\nAdded to cache!\n'));
        console.log(`Key: ${result.key}`);
        console.log(`Expires: ${new Date(result.expiresAt).toLocaleString()}`);
        console.log('');
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Reset stats command
program
  .command('reset-stats')
  .description('Reset cache statistics')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    try {
      const stats = resetStats();

      if (options.json) {
        console.log(JSON.stringify({ success: true, ...stats }, null, 2));
      } else {
        console.log(chalk.green('\nStatistics reset!\n'));
        console.log(formatStats(stats));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
