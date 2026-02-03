#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { core } from './core';
import { formatConsistencyReport } from './analyzer';

const program = new Command();

program
  .name('ai-consistency')
  .description('Check output consistency across runs')
  .version('1.0.0');

program
  .command('check <file>')
  .description('Run prompt multiple times and analyze consistency')
  .option('-r, --runs <number>', 'Number of runs', '5')
  .option('-t, --temperature <number>', 'Temperature for API calls')
  .option('-m, --model <model>', 'Model to use')
  .option('--json', 'Output as JSON')
  .action(async (file: string, options) => {
    const spinner = ora('Analyzing consistency across runs...').start();

    try {
      const runs = parseInt(options.runs, 10);

      if (isNaN(runs) || runs < 2) {
        throw new Error('Number of runs must be at least 2');
      }

      spinner.text = `Running prompt ${runs} times...`;

      const result = await core.check({
        file,
        runs,
        temperature: options.temperature ? parseFloat(options.temperature) : undefined,
        model: options.model
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatConsistencyReport(result));

        const score = result.consistencyScore;
        if (score >= 0.9) {
          console.log(chalk.green(`\nExcellent consistency: ${(score * 100).toFixed(1)}%`));
        } else if (score >= 0.7) {
          console.log(chalk.yellow(`\nGood consistency: ${(score * 100).toFixed(1)}%`));
        } else if (score >= 0.5) {
          console.log(chalk.yellow(`\nModerate consistency: ${(score * 100).toFixed(1)}%`));
        } else {
          console.log(chalk.red(`\nLow consistency: ${(score * 100).toFixed(1)}%. Consider lowering temperature.`));
        }
      }
    } catch (error) {
      spinner.fail('Failed to analyze consistency');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Show the last consistency check report')
  .option('--json', 'Output as JSON')
  .action((options) => {
    try {
      const result = core.getLastResult();

      if (!result) {
        throw new Error('No previous check result available. Run "check" first.');
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatConsistencyReport(result));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('threshold')
  .description('Check if consistency meets minimum threshold')
  .option('-m, --min <score>', 'Minimum consistency score (0-1)', '0.8')
  .option('-f, --file <file>', 'Prompt file to check')
  .option('-r, --runs <number>', 'Number of runs', '5')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Checking consistency threshold...').start();

    try {
      const minThreshold = parseFloat(options.min);

      if (isNaN(minThreshold) || minThreshold < 0 || minThreshold > 1) {
        throw new Error('Threshold must be a number between 0 and 1');
      }

      const result = await core.checkThreshold({
        min: minThreshold,
        file: options.file,
        runs: options.runs ? parseInt(options.runs, 10) : undefined
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.passed) {
          console.log(chalk.green(`\n  ${result.message}`));
        } else {
          console.log(chalk.red(`\n  ${result.message}`));
        }

        console.log(chalk.gray(`\n  Threshold: ${(result.threshold * 100).toFixed(1)}%`));
        console.log(chalk.gray(`  Actual:    ${(result.actual * 100).toFixed(1)}%`));
      }

      if (!result.passed) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Failed to check threshold');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('config')
  .description('View or modify configuration')
  .option('--get <key>', 'Get a configuration value')
  .option('--set <key=value>', 'Set a configuration value')
  .option('--json', 'Output as JSON')
  .action((options) => {
    try {
      if (options.get) {
        const config = core.getConfig();
        const value = (config as any)[options.get];
        if (options.json) {
          console.log(JSON.stringify({ [options.get]: value }, null, 2));
        } else {
          console.log(`${options.get}: ${JSON.stringify(value)}`);
        }
      } else if (options.set) {
        const [key, value] = options.set.split('=');
        let parsedValue: any = value;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Keep as string
        }
        core.setConfig(key as any, parsedValue);
        console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsedValue)}`));
      } else {
        const config = core.getConfig();
        if (options.json) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log(chalk.bold('Current Configuration:'));
          for (const [key, value] of Object.entries(config)) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program.parse();
