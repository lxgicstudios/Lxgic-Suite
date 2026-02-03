#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { diffPrompts, runComparison, DiffOptions, DiffResult, ComparisonResult } from './core.js';
import { formatDiffOutput, formatComparisonOutput, formatTokenDiff } from './diff-utils.js';

const program = new Command();

program
  .name('prompt-diff')
  .description('Compare prompt versions and their outputs side-by-side')
  .version('1.0.0');

program
  .command('diff')
  .description('Compare two prompt files')
  .argument('<file1>', 'First prompt file')
  .argument('<file2>', 'Second prompt file')
  .option('-m, --model <model>', 'Claude model to use for comparison', 'claude-sonnet-4-20250514')
  .option('-i, --sample-input <input>', 'Sample input to test prompts with')
  .option('-r, --run', 'Run both prompts through Claude and compare outputs')
  .option('-j, --json', 'Output results as JSON')
  .option('-c, --context <lines>', 'Number of context lines in diff', '3')
  .action(async (file1: string, file2: string, options: {
    model: string;
    sampleInput?: string;
    run?: boolean;
    json?: boolean;
    context: string;
  }) => {
    const spinner = ora('Comparing prompts...').start();

    try {
      const diffOptions: DiffOptions = {
        model: options.model,
        sampleInput: options.sampleInput,
        contextLines: parseInt(options.context, 10),
      };

      // First, get the text diff
      const diffResult = await diffPrompts(file1, file2, diffOptions);

      let comparisonResult: ComparisonResult | undefined;

      // If --run flag is provided, run both prompts through Claude
      if (options.run) {
        if (!options.sampleInput) {
          spinner.warn('Running prompts without sample input - using empty input');
        }
        spinner.text = 'Running prompts through Claude...';
        comparisonResult = await runComparison(file1, file2, diffOptions);
      }

      spinner.stop();

      if (options.json) {
        const output = {
          diff: diffResult,
          comparison: comparisonResult,
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n=== Prompt Diff ===\n'));
        console.log(formatDiffOutput(diffResult));
        console.log(formatTokenDiff(diffResult));

        if (comparisonResult) {
          console.log(chalk.bold.cyan('\n=== Output Comparison ===\n'));
          console.log(formatComparisonOutput(comparisonResult));
        }
      }
    } catch (error) {
      spinner.fail('Failed to compare prompts');
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show statistics for a prompt file')
  .argument('<file>', 'Prompt file to analyze')
  .option('-j, --json', 'Output results as JSON')
  .action(async (file: string, options: { json?: boolean }) => {
    const spinner = ora('Analyzing prompt...').start();

    try {
      const { getPromptStats } = await import('./core.js');
      const stats = await getPromptStats(file);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n=== Prompt Statistics ===\n'));
        console.log(`${chalk.bold('File:')} ${file}`);
        console.log(`${chalk.bold('Characters:')} ${stats.characters}`);
        console.log(`${chalk.bold('Words:')} ${stats.words}`);
        console.log(`${chalk.bold('Lines:')} ${stats.lines}`);
        console.log(`${chalk.bold('Estimated Tokens:')} ${stats.estimatedTokens}`);
        console.log(`${chalk.bold('Has Variables:')} ${stats.hasVariables ? 'Yes' : 'No'}`);
        if (stats.variables.length > 0) {
          console.log(`${chalk.bold('Variables:')} ${stats.variables.join(', ')}`);
        }
      }
    } catch (error) {
      spinner.fail('Failed to analyze prompt');
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program.parse();
