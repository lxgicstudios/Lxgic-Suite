#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  loadPipeline,
  validatePipeline,
  formatOutput,
  PipelineStep,
  StepResult
} from './core';
import { runPipeline, visualizePipeline } from './pipeline';

const program = new Command();

program
  .name('ai-pipeline')
  .description('Build and run multi-step AI pipelines')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

program
  .command('run <pipeline>')
  .description('Run an AI pipeline from a YAML file')
  .option('-i, --input <value>', 'Input value for the pipeline')
  .option('-v, --var <vars...>', 'Variables in key=value format')
  .option('--dry-run', 'Validate and show pipeline without executing')
  .option('--verbose', 'Show detailed execution output')
  .action(async (pipelinePath: string, options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      spinner.start('Loading pipeline...');
      const config = loadPipeline(pipelinePath);
      spinner.succeed(`Loaded pipeline: ${config.name}`);

      // Validate pipeline
      spinner.start('Validating pipeline...');
      const validation = validatePipeline(config);

      if (!validation.valid) {
        spinner.fail('Pipeline validation failed');
        if (jsonOutput) {
          console.log(formatOutput({ success: false, errors: validation.errors }, true));
        } else {
          for (const error of validation.errors) {
            console.log(chalk.red(`  - ${error}`));
          }
        }
        process.exit(1);
      }

      if (validation.warnings.length > 0 && !jsonOutput) {
        spinner.warn('Pipeline validated with warnings');
        for (const warning of validation.warnings) {
          console.log(chalk.yellow(`  - ${warning}`));
        }
      } else {
        spinner.succeed('Pipeline validated');
      }

      if (options.dryRun) {
        if (jsonOutput) {
          console.log(formatOutput({ success: true, config, validation }, true));
        } else {
          console.log(chalk.cyan('\nDry run - pipeline not executed'));
          console.log(visualizePipeline(config));
        }
        return;
      }

      // Parse variables
      const variables: Record<string, any> = {};
      if (options.var) {
        for (const v of options.var) {
          const [key, ...valueParts] = v.split('=');
          variables[key] = valueParts.join('=');
        }
      }

      // Run pipeline
      spinner.start('Running pipeline...');

      const result = await runPipeline(config, {
        input: options.input || '',
        variables,
        onStepStart: (step: PipelineStep) => {
          if (options.verbose && !jsonOutput) {
            spinner.text = `Running step: ${step.id} (${step.type})`;
          }
        },
        onStepComplete: (step: PipelineStep, stepResult: StepResult) => {
          if (options.verbose && !jsonOutput) {
            if (stepResult.success) {
              console.log(chalk.green(`  [OK] ${step.id} (${stepResult.duration}ms)`));
            } else {
              console.log(chalk.red(`  [FAIL] ${step.id}: ${stepResult.error}`));
            }
          }
        },
        onStepError: (step: PipelineStep, error: Error) => {
          if (options.verbose && !jsonOutput) {
            console.log(chalk.red(`  [ERROR] ${step.id}: ${error.message}`));
          }
        }
      });

      if (result.success) {
        spinner.succeed(`Pipeline completed in ${result.totalDuration}ms`);
      } else {
        spinner.fail('Pipeline failed');
      }

      if (jsonOutput) {
        console.log(formatOutput(result, true));
      } else {
        console.log('');
        console.log(chalk.bold('Results:'));

        for (const stepResult of result.results) {
          const status = stepResult.success
            ? chalk.green('[OK]')
            : chalk.red('[FAIL]');
          console.log(`  ${status} ${stepResult.id} (${stepResult.duration}ms)`);

          if (stepResult.retries > 0) {
            console.log(chalk.yellow(`       Retries: ${stepResult.retries}`));
          }

          if (!stepResult.success && stepResult.error) {
            console.log(chalk.red(`       Error: ${stepResult.error}`));
          }
        }

        console.log('');
        console.log(chalk.bold('Output:'));
        console.log(formatOutput(result.output, false));
      }

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      spinner.fail('Error');

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
  .command('validate <pipeline>')
  .description('Validate a pipeline YAML file')
  .action(async (pipelinePath: string) => {
    const jsonOutput = program.opts().json;

    try {
      const config = loadPipeline(pipelinePath);
      const validation = validatePipeline(config);

      if (jsonOutput) {
        console.log(formatOutput({
          success: validation.valid,
          name: config.name,
          steps: config.steps.length,
          errors: validation.errors,
          warnings: validation.warnings
        }, true));
      } else {
        if (validation.valid) {
          console.log(chalk.green(`Pipeline "${config.name}" is valid`));
          console.log(`  Steps: ${config.steps.length}`);

          if (validation.warnings.length > 0) {
            console.log(chalk.yellow('\nWarnings:'));
            for (const warning of validation.warnings) {
              console.log(chalk.yellow(`  - ${warning}`));
            }
          }
        } else {
          console.log(chalk.red(`Pipeline "${config.name}" has errors`));
          console.log('\nErrors:');
          for (const error of validation.errors) {
            console.log(chalk.red(`  - ${error}`));
          }

          if (validation.warnings.length > 0) {
            console.log('\nWarnings:');
            for (const warning of validation.warnings) {
              console.log(chalk.yellow(`  - ${warning}`));
            }
          }
        }
      }

      process.exit(validation.valid ? 0 : 1);
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
  .command('visualize <pipeline>')
  .description('Display ASCII visualization of a pipeline')
  .action(async (pipelinePath: string) => {
    const jsonOutput = program.opts().json;

    try {
      const config = loadPipeline(pipelinePath);
      const validation = validatePipeline(config);

      if (!validation.valid) {
        if (jsonOutput) {
          console.log(formatOutput({
            success: false,
            errors: validation.errors
          }, true));
        } else {
          console.error(chalk.red('Pipeline has validation errors:'));
          for (const error of validation.errors) {
            console.error(chalk.red(`  - ${error}`));
          }
        }
        process.exit(1);
      }

      const visualization = visualizePipeline(config);

      if (jsonOutput) {
        console.log(formatOutput({
          success: true,
          name: config.name,
          visualization,
          steps: config.steps.map(s => ({
            id: s.id,
            type: s.type,
            parallel: s.parallel || false
          }))
        }, true));
      } else {
        console.log(visualization);
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

program.parse();
