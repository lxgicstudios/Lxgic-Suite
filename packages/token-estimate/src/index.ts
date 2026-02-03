#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import {
  estimate,
  compare,
  batch,
  formatEstimate,
  formatComparison,
  formatBatchResults
} from './core';
import { getAllModels, getModelPricing } from './pricing';

const program = new Command();

program
  .name('token-estimate')
  .description('Estimate cost before execution - calculate token counts and costs for AI models')
  .version('1.0.0');

// Estimate command
program
  .command('estimate <file>')
  .description('Estimate tokens and cost for a file')
  .option('-m, --model <model>', 'Model to estimate for', 'claude-3.5-sonnet')
  .option('-o, --output-ratio <ratio>', 'Expected output/input token ratio', '1.5')
  .option('--json', 'Output as JSON')
  .action((file: string, options: { model: string; outputRatio: string; json?: boolean }) => {
    try {
      const filePath = path.resolve(file);
      const ratio = parseFloat(options.outputRatio);

      const result = estimate(filePath, options.model, ratio);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nToken Estimation\n'));
        console.log(chalk.gray(`File: ${filePath}\n`));
        console.log(formatEstimate(result!));
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

// Compare command
program
  .command('compare <file>')
  .description('Compare costs across all available models')
  .option('-o, --output-ratio <ratio>', 'Expected output/input token ratio', '1.5')
  .option('--json', 'Output as JSON')
  .action((file: string, options: { outputRatio: string; json?: boolean }) => {
    try {
      const filePath = path.resolve(file);
      const ratio = parseFloat(options.outputRatio);

      const results = compare(filePath, ratio);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nCost Comparison Across Models\n'));
        console.log(chalk.gray(`File: ${filePath}`));
        console.log(chalk.gray(`Output Ratio: ${ratio}x\n`));
        console.log(formatComparison(results));
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

// Batch command
program
  .command('batch <dir>')
  .description('Estimate tokens for all files in a directory')
  .option('-r, --recursive', 'Process subdirectories recursively', false)
  .option('-o, --output-ratio <ratio>', 'Expected output/input token ratio', '1.5')
  .option('--json', 'Output as JSON')
  .action((dir: string, options: { recursive: boolean; outputRatio: string; json?: boolean }) => {
    try {
      const dirPath = path.resolve(dir);
      const ratio = parseFloat(options.outputRatio);

      const results = batch(dirPath, options.recursive, ratio);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nBatch Token Estimation\n'));
        console.log(chalk.gray(`Directory: ${dirPath}`));
        console.log(chalk.gray(`Recursive: ${options.recursive}\n`));
        console.log(formatBatchResults(results));
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

// List models command
program
  .command('models')
  .description('List all available models and their pricing')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    const models = getAllModels().map(id => {
      const pricing = getModelPricing(id);
      return {
        id,
        ...pricing
      };
    });

    if (options.json) {
      console.log(JSON.stringify(models, null, 2));
    } else {
      console.log(chalk.bold.cyan('\nAvailable Models\n'));
      console.log('┌─────────────────────────┬──────────┬────────────────┬─────────────────┬───────────────┐');
      console.log('│ Model ID                │ Provider │ Input ($/1M)   │ Output ($/1M)   │ Context       │');
      console.log('├─────────────────────────┼──────────┼────────────────┼─────────────────┼───────────────┤');

      for (const m of models) {
        const id = m.id.padEnd(23);
        const provider = (m.provider || '').padEnd(8);
        const input = `$${m.inputPricePerMillion?.toFixed(2) || '0'}`.padStart(14);
        const output = `$${m.outputPricePerMillion?.toFixed(2) || '0'}`.padStart(15);
        const context = (m.contextWindow?.toLocaleString() || '0').padStart(13);

        console.log(`│ ${id} │ ${provider} │ ${input} │ ${output} │ ${context} │`);
      }

      console.log('└─────────────────────────┴──────────┴────────────────┴─────────────────┴───────────────┘');
      console.log('');
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
