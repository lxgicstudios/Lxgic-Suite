#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { core } from './core';
import { formatVerificationReport } from './detector';

const program = new Command();

program
  .name('hallucination-check')
  .description('Detect factual hallucinations')
  .version('1.0.0');

program
  .command('verify <output>')
  .description('Verify claims against source documents')
  .option('-s, --sources <dir>', 'Source documents directory')
  .option('-m, --model <model>', 'Model to use for verification')
  .option('--strict', 'Enable strict verification mode')
  .option('--json', 'Output as JSON')
  .action(async (output: string, options) => {
    const spinner = ora('Verifying claims against sources...').start();

    try {
      if (!options.sources) {
        throw new Error('Sources directory is required for verification. Use --sources <dir>');
      }

      const result = await core.verify({
        output,
        sources: options.sources,
        model: options.model,
        strictMode: options.strict
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatVerificationReport(result));

        const risk = result.hallucinationScore;
        if (risk <= 0.1) {
          console.log(chalk.green(`\nLow hallucination risk: ${(risk * 100).toFixed(1)}%`));
        } else if (risk <= 0.3) {
          console.log(chalk.yellow(`\nModerate hallucination risk: ${(risk * 100).toFixed(1)}%`));
        } else {
          console.log(chalk.red(`\nHigh hallucination risk: ${(risk * 100).toFixed(1)}%`));
        }
      }
    } catch (error) {
      spinner.fail('Verification failed');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('check <output>')
  .description('Check for potential hallucinations without source documents')
  .option('-m, --model <model>', 'Model to use for checking')
  .option('--json', 'Output as JSON')
  .action(async (output: string, options) => {
    const spinner = ora('Analyzing for potential hallucinations...').start();

    try {
      const result = await core.check({
        output,
        model: options.model
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatVerificationReport(result));

        console.log(chalk.gray('\nNote: This analysis is performed without source documents.'));
        console.log(chalk.gray('For more accurate results, use "verify" with source documents.'));
      }
    } catch (error) {
      spinner.fail('Check failed');
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
  .description('Show the last verification report')
  .option('--json', 'Output as JSON')
  .action((options) => {
    try {
      const result = core.getLastResult();

      if (!result) {
        throw new Error('No previous verification result available. Run "verify" or "check" first.');
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatVerificationReport(result));
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
