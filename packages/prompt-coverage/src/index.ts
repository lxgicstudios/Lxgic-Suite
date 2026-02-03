#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { core } from './core.js';
import { formatCoverageReport } from './coverage.js';

const program = new Command();

program
  .name('prompt-coverage')
  .description('Test coverage reporting for prompts')
  .version('1.0.0');

program
  .command('report <tests-dir>')
  .description('Generate coverage report for prompt tests')
  .option('-p, --prompts-dir <dir>', 'Directory containing prompt files')
  .option('-o, --output <file>', 'Output file for the report')
  .option('--json', 'Output as JSON')
  .action(async (testsDir: string, options) => {
    const spinner = ora('Analyzing prompt coverage...').start();

    try {
      const result = await core.generateReport({
        testsDir,
        promptsDir: options.promptsDir,
        json: options.json,
        outputFile: options.output
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatCoverageReport(result));

        if (result.coveragePercentage >= 80) {
          console.log(chalk.green(`\nExcellent! Coverage is ${result.coveragePercentage}%`));
        } else if (result.coveragePercentage >= 60) {
          console.log(chalk.yellow(`\nGood coverage at ${result.coveragePercentage}%, but could be improved`));
        } else {
          console.log(chalk.red(`\nLow coverage at ${result.coveragePercentage}%. Consider adding more tests.`));
        }
      }

      if (options.output) {
        console.log(chalk.gray(`\nReport saved to: ${options.output}`));
      }
    } catch (error) {
      spinner.fail('Failed to generate coverage report');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('badge')
  .description('Generate coverage badge')
  .option('-d, --tests-dir <dir>', 'Tests directory', process.cwd())
  .option('-o, --output <file>', 'Output SVG file')
  .option('-s, --style <style>', 'Badge style (flat, flat-square, plastic)', 'flat')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Generating coverage badge...').start();

    try {
      const result = await core.generateBadge({
        testsDir: options.testsDir,
        output: options.output,
        style: options.style
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold('Coverage Badge'));
        console.log(chalk.gray('URL:'), result.url);

        if (options.output) {
          console.log(chalk.green(`\nSVG saved to: ${options.output}`));
        } else {
          console.log(chalk.gray('\nSVG:'));
          console.log(result.svg);
        }
      }
    } catch (error) {
      spinner.fail('Failed to generate badge');
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
  .description('Check if coverage meets minimum threshold')
  .option('-m, --min <percent>', 'Minimum coverage percentage', '80')
  .option('-d, --tests-dir <dir>', 'Tests directory', process.cwd())
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Checking coverage threshold...').start();

    try {
      const minThreshold = parseInt(options.min, 10);

      if (isNaN(minThreshold) || minThreshold < 0 || minThreshold > 100) {
        throw new Error('Threshold must be a number between 0 and 100');
      }

      const result = await core.checkThreshold({
        min: minThreshold,
        testsDir: options.testsDir
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.passed) {
          console.log(chalk.green(`✓ ${result.message}`));
        } else {
          console.log(chalk.red(`✗ ${result.message}`));
        }

        console.log(chalk.gray(`\n  Threshold: ${result.threshold}%`));
        console.log(chalk.gray(`  Actual:    ${result.actual}%`));
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
