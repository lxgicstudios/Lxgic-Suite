#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  analyzePrompt,
  getSuggestions,
  rewritePrompt,
  OptimizeOptions
} from './core.js';
import { formatAnalysisReport, formatSuggestions, formatRewrite } from './analyzers.js';

const program = new Command();

program
  .name('prompt-optimize')
  .description('Analyze and suggest prompt improvements')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a prompt file for optimization opportunities')
  .argument('<file>', 'Prompt file to analyze')
  .option('-m, --model <model>', 'Claude model to use for analysis', 'claude-sonnet-4-20250514')
  .option('-j, --json', 'Output results as JSON')
  .option('-d, --detailed', 'Include detailed analysis')
  .action(async (file: string, options: {
    model: string;
    json?: boolean;
    detailed?: boolean;
  }) => {
    const spinner = ora('Analyzing prompt...').start();

    try {
      const optimizeOptions: OptimizeOptions = {
        model: options.model,
        detailed: options.detailed,
        numSuggestions: 5,
      };

      const analysis = await analyzePrompt(file, optimizeOptions);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n=== Prompt Analysis ===\n'));
        console.log(formatAnalysisReport(analysis));
      }
    } catch (error) {
      spinner.fail('Failed to analyze prompt');
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('suggest')
  .description('Get AI-powered suggestions to improve a prompt')
  .argument('<file>', 'Prompt file to get suggestions for')
  .option('-m, --model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .option('-g, --goal <goal>', 'Specific optimization goal (clarity, tokens, performance)')
  .option('-j, --json', 'Output results as JSON')
  .option('-n, --num <count>', 'Number of suggestions to generate', '5')
  .action(async (file: string, options: {
    model: string;
    goal?: string;
    json?: boolean;
    num: string;
  }) => {
    const spinner = ora('Generating suggestions...').start();

    try {
      const optimizeOptions: OptimizeOptions = {
        model: options.model,
        goal: options.goal as 'clarity' | 'tokens' | 'performance' | undefined,
        numSuggestions: parseInt(options.num, 10),
      };

      const suggestions = await getSuggestions(file, optimizeOptions);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(suggestions, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n=== Prompt Suggestions ===\n'));
        console.log(formatSuggestions(suggestions));
      }
    } catch (error) {
      spinner.fail('Failed to generate suggestions');
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('rewrite')
  .description('Auto-rewrite a prompt for better performance')
  .argument('<file>', 'Prompt file to rewrite')
  .option('-m, --model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .option('-g, --goal <goal>', 'Optimization goal (clarity, tokens, performance)', 'performance')
  .option('-o, --output <file>', 'Output file for rewritten prompt')
  .option('-j, --json', 'Output results as JSON')
  .option('--preserve-variables', 'Preserve existing variable placeholders')
  .option('--aggressive', 'Apply more aggressive optimizations')
  .action(async (file: string, options: {
    model: string;
    goal: string;
    output?: string;
    json?: boolean;
    preserveVariables?: boolean;
    aggressive?: boolean;
  }) => {
    const spinner = ora('Rewriting prompt...').start();

    try {
      const optimizeOptions: OptimizeOptions = {
        model: options.model,
        goal: options.goal as 'clarity' | 'tokens' | 'performance',
        preserveVariables: options.preserveVariables,
        aggressive: options.aggressive,
        outputFile: options.output,
        numSuggestions: 5,
      };

      const result = await rewritePrompt(file, optimizeOptions);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n=== Prompt Rewrite ===\n'));
        console.log(formatRewrite(result));

        if (result.savedTo) {
          console.log(chalk.green(`\nSaved to: ${result.savedTo}`));
        }
      }
    } catch (error) {
      spinner.fail('Failed to rewrite prompt');
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare original and optimized prompt performance')
  .argument('<file>', 'Prompt file to optimize and compare')
  .option('-m, --model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .option('-i, --input <input>', 'Sample input to test with')
  .option('-j, --json', 'Output results as JSON')
  .action(async (file: string, options: {
    model: string;
    input?: string;
    json?: boolean;
  }) => {
    const spinner = ora('Comparing prompts...').start();

    try {
      const { compareOptimized } = await import('./core.js');

      const result = await compareOptimized(file, {
        model: options.model,
        sampleInput: options.input,
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n=== Optimization Comparison ===\n'));

        console.log(chalk.bold('Token Savings:'));
        console.log(`  Original: ${result.originalTokens} tokens`);
        console.log(`  Optimized: ${result.optimizedTokens} tokens`);
        console.log(`  Savings: ${chalk.green(`${result.tokenSavings} tokens (${result.savingsPercent}%)`)}`);
        console.log('');

        if (result.testResults) {
          console.log(chalk.bold('Test Results:'));
          console.log(`  Original time: ${result.testResults.originalTime}ms`);
          console.log(`  Optimized time: ${result.testResults.optimizedTime}ms`);
          console.log('');
        }

        console.log(chalk.bold('Original Prompt:'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(result.original);
        console.log(chalk.dim('─'.repeat(50)));
        console.log('');

        console.log(chalk.bold('Optimized Prompt:'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(result.optimized);
        console.log(chalk.dim('─'.repeat(50)));
      }
    } catch (error) {
      spinner.fail('Failed to compare prompts');
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program.parse();
