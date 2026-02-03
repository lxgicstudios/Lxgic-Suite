#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import {
  PromptTestRunner,
  TestRunnerConfig,
  TestFileResult,
  formatTestFileResult,
  formatResultsJson,
  combineResults,
  createSampleTestFile,
} from './core.js';
import { getAssertionTypes, getAssertionTypeDescription } from './assertions.js';

const program = new Command();

// Package info
const VERSION = '1.0.0';

program
  .name('prompt-test')
  .description('Unit test prompts with assertions on outputs')
  .version(VERSION);

// Run command
program
  .command('run')
  .description('Run prompt tests from YAML files')
  .argument('<files...>', 'Test files or glob patterns (e.g., tests/*.yaml)')
  .option('-j, --json', 'Output results as JSON')
  .option('-v, --verbose', 'Show detailed output including passing assertions')
  .option('--parallel', 'Run tests in parallel')
  .option('--max-parallel <n>', 'Maximum parallel tests (default: 5)', '5')
  .option('--model <model>', 'Override default model')
  .option('--max-tokens <n>', 'Override default max tokens')
  .option('--temperature <n>', 'Override default temperature')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
  .option('--dry-run', 'Parse and validate tests without calling the API')
  .option('--no-color', 'Disable colored output')
  .addHelpText('after', `
Examples:
  $ prompt-test run tests/greeting.yaml
  $ prompt-test run "tests/**/*.yaml"
  $ prompt-test run tests/*.yaml --json
  $ prompt-test run tests/*.yaml --verbose
  $ prompt-test run tests/*.yaml --parallel --max-parallel 10
  $ prompt-test run tests/*.yaml --dry-run
  $ prompt-test run tests/*.yaml --model claude-opus-4-20250514

Environment Variables:
  ANTHROPIC_API_KEY    Required. Your Anthropic API key.

Test File Format (YAML):
  name: My Tests
  defaults:
    model: claude-sonnet-4-20250514
    maxTokens: 1024
  tests:
    - name: Test name
      prompt: Your prompt here
      assertions:
        - type: contains
          expected: "expected text"
        - type: length-min
          expected: 100
`)
  .action(async (files: string[], options) => {
    // Check for API key
    if (!options.dryRun && !process.env.ANTHROPIC_API_KEY) {
      console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable is required'));
      console.error(chalk.dim('Set it with: export ANTHROPIC_API_KEY=your-key'));
      process.exit(1);
    }

    const config: TestRunnerConfig = {
      parallel: options.parallel,
      maxParallel: parseInt(options.maxParallel, 10),
      verbose: options.verbose,
      dryRun: options.dryRun,
      defaultTimeout: parseInt(options.timeout, 10),
    };

    if (options.model) {
      config.defaultModel = options.model;
    }
    if (options.maxTokens) {
      config.defaultMaxTokens = parseInt(options.maxTokens, 10);
    }
    if (options.temperature) {
      config.defaultTemperature = parseFloat(options.temperature);
    }

    const runner = new PromptTestRunner(config);
    const results: TestFileResult[] = [];

    try {
      // Find all matching files
      const spinner = ora('Finding test files...').start();
      const allFiles: string[] = [];

      for (const pattern of files) {
        if (pattern.includes('*')) {
          const matches = await glob(pattern, { nodir: true });
          allFiles.push(...matches);
        } else {
          allFiles.push(pattern);
        }
      }

      if (allFiles.length === 0) {
        spinner.fail('No test files found matching the patterns');
        process.exit(1);
      }

      spinner.succeed(`Found ${allFiles.length} test file(s)`);

      // Run tests for each file
      for (const filePath of allFiles) {
        const testSpinner = ora(`Running tests in ${path.basename(filePath)}...`).start();

        try {
          const result = await runner.runTestFile(filePath);
          results.push(result);

          if (result.summary.failed > 0) {
            testSpinner.fail(`${path.basename(filePath)}: ${result.summary.passed} passed, ${result.summary.failed} failed`);
          } else {
            testSpinner.succeed(`${path.basename(filePath)}: ${result.summary.passed} passed`);
          }
        } catch (error) {
          testSpinner.fail(`${path.basename(filePath)}: Error - ${error instanceof Error ? error.message : String(error)}`);
          results.push({
            filePath,
            testFile: { tests: [] },
            results: [],
            summary: { total: 0, passed: 0, failed: 1, skipped: 0 },
            duration: 0,
          });
        }
      }

      // Output results
      if (options.json) {
        console.log(formatResultsJson(results));
      } else {
        for (const result of results) {
          console.log(formatTestFileResult(result, options.verbose));
        }

        // Overall summary
        if (results.length > 1) {
          const combined = combineResults(results);
          console.log('\n' + '═'.repeat(50));
          console.log(chalk.bold('Overall Summary'));
          console.log('═'.repeat(50));
          console.log(`Files: ${combined.summary.totalFiles}`);
          console.log(`Tests: ${combined.summary.passed} passed, ${combined.summary.failed} failed, ${combined.summary.skipped} skipped`);
          console.log(`Total duration: ${combined.summary.duration}ms`);

          if (combined.allPassed) {
            console.log(chalk.green('\n✓ All tests passed'));
          } else {
            console.log(chalk.red('\n✗ Some tests failed'));
          }
        }
      }

      // Exit with appropriate code
      const combined = combineResults(results);
      process.exit(combined.allPassed ? 0 : 1);

    } catch (error) {
      if (!options.json) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      } else {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      process.exit(1);
    }
  });

// Init command to create a sample test file
program
  .command('init')
  .description('Create a sample test file')
  .option('-o, --output <file>', 'Output file path', 'prompt-tests.yaml')
  .option('-f, --force', 'Overwrite existing file')
  .action(async (options) => {
    const outputPath = path.resolve(options.output);

    try {
      // Check if file exists
      try {
        await fs.access(outputPath);
        if (!options.force) {
          console.error(chalk.red(`Error: File already exists: ${outputPath}`));
          console.error(chalk.dim('Use --force to overwrite'));
          process.exit(1);
        }
      } catch {
        // File doesn't exist, which is fine
      }

      // Write sample file
      const sample = createSampleTestFile();
      await fs.writeFile(outputPath, sample, 'utf-8');
      console.log(chalk.green(`Created sample test file: ${outputPath}`));
      console.log(chalk.dim('Edit this file and run: prompt-test run ' + options.output));

    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Validate command to check test file syntax
program
  .command('validate')
  .description('Validate test file syntax without running tests')
  .argument('<files...>', 'Test files to validate')
  .option('-j, --json', 'Output as JSON')
  .action(async (files: string[], options) => {
    const runner = new PromptTestRunner({ dryRun: true });
    const results: { file: string; valid: boolean; error?: string }[] = [];

    for (const filePath of files) {
      try {
        await runner.loadTestFile(filePath);
        results.push({ file: filePath, valid: true });
        if (!options.json) {
          console.log(chalk.green(`✓ ${filePath}`));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ file: filePath, valid: false, error: errorMsg });
        if (!options.json) {
          console.log(chalk.red(`✗ ${filePath}`));
          console.log(chalk.dim(`  ${errorMsg}`));
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }

    const hasErrors = results.some(r => !r.valid);
    process.exit(hasErrors ? 1 : 0);
  });

// Assertions command to list available assertion types
program
  .command('assertions')
  .description('List all available assertion types')
  .option('-j, --json', 'Output as JSON')
  .action((options) => {
    const types = getAssertionTypes();

    if (options.json) {
      const data = types.map(type => ({
        type,
        description: getAssertionTypeDescription(type),
      }));
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(chalk.bold('\nAvailable Assertion Types:\n'));

      for (const type of types) {
        console.log(`  ${chalk.cyan(type)}`);
        console.log(`    ${chalk.dim(getAssertionTypeDescription(type))}\n`);
      }
    }
  });

// Parse and execute
program.parse();
