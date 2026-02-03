#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { core } from './core';
import { formatValidationResult, formatBatchResult } from './validator';

const program = new Command();

program
  .name('prompt-validate')
  .description('JSON schema validation for outputs')
  .version('1.0.0');

program
  .command('validate <output>')
  .description('Validate JSON output against a schema')
  .requiredOption('-s, --schema <schema>', 'Path to JSON schema file')
  .option('--json', 'Output as JSON')
  .action(async (output: string, options) => {
    const spinner = ora('Validating output against schema...').start();

    try {
      const result = await core.validate({
        output,
        schema: options.schema
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatValidationResult(result));

        if (result.valid) {
          console.log(chalk.green('\nValidation passed!'));
        } else {
          console.log(chalk.red(`\nValidation failed with ${result.errors.length} error(s)`));
        }
      }

      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Validation failed');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('generate-schema <sample>')
  .description('Generate JSON schema from sample data')
  .option('-o, --output <file>', 'Output file for the schema')
  .option('--json', 'Output as JSON (always JSON, this flag is for consistency)')
  .action(async (sample: string, options) => {
    const spinner = ora('Generating schema from sample...').start();

    try {
      const schema = await core.generateSchema({
        sample,
        output: options.output
      });

      spinner.stop();

      console.log(JSON.stringify(schema, null, 2));

      if (options.output) {
        console.log(chalk.green(`\nSchema saved to: ${options.output}`));
      }
    } catch (error) {
      spinner.fail('Schema generation failed');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

program
  .command('batch <dir>')
  .description('Validate multiple JSON files against a schema')
  .requiredOption('-s, --schema <schema>', 'Path to JSON schema file')
  .option('--json', 'Output as JSON')
  .action(async (dir: string, options) => {
    const spinner = ora('Validating files...').start();

    try {
      const result = await core.batch({
        dir,
        schema: options.schema
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatBatchResult(result));

        if (result.invalidFiles === 0) {
          console.log(chalk.green(`\nAll ${result.validFiles} file(s) passed validation!`));
        } else {
          console.log(chalk.red(`\n${result.invalidFiles} of ${result.totalFiles} file(s) failed validation`));
        }
      }

      if (result.invalidFiles > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Batch validation failed');
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
