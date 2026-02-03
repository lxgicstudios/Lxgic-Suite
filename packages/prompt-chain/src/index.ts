#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  runPipelineFile,
  validatePipelineFile,
  createPipelineFile,
  getPipelineSummary,
  runPipelineWithProgress,
} from './core.js';

const program = new Command();

interface GlobalOptions {
  json?: boolean;
}

/**
 * Output helper for JSON or formatted output
 */
function output(data: unknown, options: GlobalOptions): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(data);
  }
}

/**
 * Error output helper
 */
function outputError(message: string, options: GlobalOptions, exitCode = 1): never {
  if (options.json) {
    console.log(JSON.stringify({ success: false, error: message }));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(exitCode);
}

/**
 * Parse variable arguments (key=value pairs)
 */
function parseVariables(vars: string[] | undefined): Record<string, string> {
  if (!vars) return {};

  const result: Record<string, string> = {};
  for (const pair of vars) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      throw new Error(`Invalid variable format: "${pair}". Expected key=value`);
    }
    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}

program
  .name('prompt-chain')
  .description('Chain multiple prompts with data flow')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

/**
 * Run command - Execute a pipeline
 */
program
  .command('run <pipeline>')
  .description('Run a pipeline from a YAML file')
  .option('--var <pairs...>', 'Variable key=value pairs')
  .option('--dry-run', 'Show what would be executed without actually running')
  .option('--verbose', 'Show detailed execution progress')
  .option('--output <file>', 'Write final output to file')
  .action(async (pipelineFile, cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;

    try {
      const variables = parseVariables(cmdOptions.var);

      if (globalOptions.json || !cmdOptions.verbose) {
        // Non-interactive mode
        const spinner = globalOptions.json ? null : ora('Running pipeline...').start();

        const result = await runPipelineFile(pipelineFile, {
          variables,
          dryRun: cmdOptions.dryRun,
          verbose: cmdOptions.verbose,
        });

        if (!result.success) {
          spinner?.fail('Pipeline failed');
          outputError(result.error || 'Unknown error', globalOptions);
        }

        spinner?.succeed(`Pipeline completed in ${result.result!.duration}ms`);

        // Write output to file if requested
        if (cmdOptions.output && result.result) {
          const fs = await import('fs/promises');
          const outputData = JSON.stringify(result.result.finalOutput, null, 2);
          await fs.writeFile(cmdOptions.output, outputData, 'utf-8');

          if (!globalOptions.json) {
            console.log(chalk.green(`Output written to: ${cmdOptions.output}`));
          }
        }

        if (globalOptions.json) {
          output({
            success: true,
            pipeline: result.result!.pipelineName,
            duration: result.result!.duration,
            steps: result.result!.stepResults.map(s => ({
              name: s.stepName,
              success: s.success,
              skipped: s.skipped,
              duration: s.duration,
              error: s.error,
            })),
            outputs: result.result!.finalOutput,
          }, globalOptions);
        } else {
          // Display results
          console.log();
          console.log(chalk.bold('Pipeline Results:'));
          console.log(chalk.gray('─'.repeat(50)));

          for (const step of result.result!.stepResults) {
            const icon = step.success ? chalk.green('OK') : chalk.red('FAIL');
            const status = step.skipped ? chalk.yellow('(skipped)') : '';
            console.log(`  ${icon} ${step.stepName} ${status}`);

            if (step.error) {
              console.log(chalk.red(`     Error: ${step.error}`));
            }
          }

          console.log(chalk.gray('─'.repeat(50)));

          // Show final outputs
          console.log();
          console.log(chalk.bold('Final Outputs:'));
          for (const [key, value] of Object.entries(result.result!.finalOutput)) {
            const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
            console.log(chalk.cyan(`  ${key}:`), displayValue);
          }
        }
      } else {
        // Verbose interactive mode with progress
        console.log(chalk.bold(`Running pipeline: ${pipelineFile}\n`));

        let currentSpinner: ReturnType<typeof ora> | null = null;

        const result = await runPipelineWithProgress(pipelineFile, {
          variables,
          dryRun: cmdOptions.dryRun,
          verbose: true,
          onProgress: (step, status, message) => {
            if (status === 'start') {
              currentSpinner = ora(`Executing: ${step}`).start();
            } else if (status === 'complete') {
              currentSpinner?.succeed(`Completed: ${step}`);
              currentSpinner = null;
            } else if (status === 'error') {
              currentSpinner?.fail(`Failed: ${step} - ${message}`);
              currentSpinner = null;
            }
          },
        });

        if (!result.success) {
          console.log();
          outputError(result.error || 'Pipeline execution failed', globalOptions);
        }

        console.log();
        console.log(chalk.green(`Pipeline completed successfully in ${result.result!.duration}ms`));

        // Write output to file if requested
        if (cmdOptions.output && result.result) {
          const fs = await import('fs/promises');
          const outputData = JSON.stringify(result.result.finalOutput, null, 2);
          await fs.writeFile(cmdOptions.output, outputData, 'utf-8');
          console.log(chalk.green(`Output written to: ${cmdOptions.output}`));
        }

        // Show final outputs
        console.log();
        console.log(chalk.bold('Final Outputs:'));
        for (const [key, value] of Object.entries(result.result!.finalOutput)) {
          const displayValue = value.length > 200 ? value.substring(0, 200) + '...' : value;
          console.log(chalk.cyan(`${key}:`));
          console.log(chalk.gray(displayValue));
          console.log();
        }
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error), globalOptions);
    }
  });

/**
 * Validate command - Validate a pipeline without running
 */
program
  .command('validate <pipeline>')
  .description('Validate a pipeline YAML file without running it')
  .action(async (pipelineFile) => {
    const globalOptions = program.opts() as GlobalOptions;
    const spinner = globalOptions.json ? null : ora('Validating pipeline...').start();

    const result = await validatePipelineFile(pipelineFile);

    if (!result.success) {
      spinner?.fail('Validation failed');
      outputError(result.error || 'Unknown error', globalOptions);
    }

    const validation = result.validation!;
    const hasErrors = validation.errors.some(e => e.severity === 'error');
    const hasWarnings = validation.warnings.length > 0;

    if (hasErrors) {
      spinner?.fail('Pipeline has validation errors');
    } else if (hasWarnings) {
      spinner?.warn('Pipeline valid with warnings');
    } else {
      spinner?.succeed('Pipeline is valid');
    }

    if (globalOptions.json) {
      output({
        success: !hasErrors,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        pipeline: {
          name: result.pipeline!.name,
          stepCount: result.pipeline!.steps.length,
        },
      }, globalOptions);
      return;
    }

    // Show errors
    if (validation.errors.length > 0) {
      console.log();
      console.log(chalk.bold('Errors:'));
      for (const error of validation.errors) {
        const icon = error.severity === 'error' ? chalk.red('X') : chalk.yellow('!');
        console.log(`  ${icon} ${error.path}: ${error.message}`);
      }
    }

    // Show warnings
    if (validation.warnings.length > 0) {
      console.log();
      console.log(chalk.bold('Warnings:'));
      for (const warning of validation.warnings) {
        console.log(chalk.yellow(`  ! ${warning}`));
      }
    }

    // Show pipeline info
    console.log();
    console.log(chalk.bold('Pipeline Info:'));
    console.log(chalk.gray('  Name:'), result.pipeline!.name);
    console.log(chalk.gray('  Steps:'), result.pipeline!.steps.length);
    console.log(chalk.gray('  Steps:'), result.pipeline!.steps.map(s => s.name).join(' -> '));

    if (hasErrors) {
      process.exit(1);
    }
  });

/**
 * Info command - Show pipeline information
 */
program
  .command('info <pipeline>')
  .description('Show detailed information about a pipeline')
  .action(async (pipelineFile) => {
    const globalOptions = program.opts() as GlobalOptions;

    const result = await getPipelineSummary(pipelineFile);

    if (!result.success) {
      outputError(result.error || 'Unknown error', globalOptions);
    }

    const summary = result.summary!;

    if (globalOptions.json) {
      output({ success: true, ...summary }, globalOptions);
      return;
    }

    console.log();
    console.log(chalk.bold.cyan(summary.name));
    if (summary.description) {
      console.log(chalk.gray(summary.description));
    }
    console.log();

    console.log(chalk.bold('Version:'), summary.version || '1.0.0');
    console.log(chalk.bold('Steps:'), summary.stepCount);
    console.log(chalk.bold('Has Conditions:'), summary.hasConditions ? chalk.yellow('Yes') : 'No');
    console.log(chalk.bold('Has Loops:'), summary.hasLoops ? chalk.yellow('Yes') : 'No');

    console.log();
    console.log(chalk.bold('Step Flow:'));
    for (let i = 0; i < summary.steps.length; i++) {
      const step = summary.steps[i];
      const arrow = i < summary.steps.length - 1 ? ' ->' : '';
      console.log(chalk.cyan(`  ${i + 1}. ${step.name}`), chalk.gray(`(output: ${step.output})${arrow}`));
    }

    console.log();
    console.log(chalk.bold('Variables Used:'));
    if (summary.variables.length === 0) {
      console.log(chalk.gray('  No variables'));
    } else {
      for (const variable of summary.variables) {
        console.log(chalk.cyan(`  {{${variable}}}`));
      }
    }
  });

/**
 * Init command - Create a new pipeline template
 */
program
  .command('init <name>')
  .description('Create a new pipeline YAML file from template')
  .option('--output <file>', 'Output file path (default: <name>.yaml)')
  .option('--force', 'Overwrite existing file')
  .action(async (name, cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;
    const outputPath = cmdOptions.output || `${name}.yaml`;

    const result = await createPipelineFile(outputPath, name, {
      force: cmdOptions.force,
    });

    if (!result.success) {
      outputError(result.error || 'Unknown error', globalOptions);
    }

    if (globalOptions.json) {
      output({ success: true, file: outputPath }, globalOptions);
    } else {
      console.log(chalk.green(`Created pipeline: ${outputPath}`));
      console.log();
      console.log('Edit the file to define your pipeline steps, then run:');
      console.log(chalk.cyan(`  prompt-chain validate ${outputPath}`));
      console.log(chalk.cyan(`  prompt-chain run ${outputPath}`));
    }
  });

// Parse and execute
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
