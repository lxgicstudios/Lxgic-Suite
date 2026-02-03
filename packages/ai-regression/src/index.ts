#!/usr/bin/env node

/**
 * ai-regression CLI
 * Regression test suite for AI outputs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { RegressionTester, TestSummary, BaselineEntry } from './core';

const program = new Command();

program
  .name('ai-regression')
  .description('Regression test suite for AI outputs')
  .version('1.0.0');

// Global options
program.option('--json', 'Output results in JSON format');

/**
 * Test command - Run regression tests
 */
program
  .command('test <baseline-dir>')
  .description('Run regression tests against baselines')
  .option('-c, --current <path>', 'Path to current outputs (file or directory)')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.85')
  .option('-o, --output <file>', 'Output results to file')
  .option('--ci', 'CI/CD friendly output (exit code only)')
  .action(async (baselineDir: string, options: {
    current?: string;
    threshold: string;
    output?: string;
    ci?: boolean;
  }) => {
    const jsonOutput = program.opts().json;

    try {
      const tester = new RegressionTester({
        similarityThreshold: parseFloat(options.threshold)
      });

      // Load baselines
      const baselines = tester.loadBaseline(baselineDir);

      if (baselines.length === 0) {
        throw new Error('No baselines found in directory');
      }

      // Load current outputs
      let currentOutputs: Array<{ id: string; output: string }>;

      if (options.current) {
        currentOutputs = tester.loadCurrentOutputs(options.current);
      } else {
        throw new Error('--current option is required. Specify path to current outputs.');
      }

      // Run tests
      const summary = tester.runTests(currentOutputs, parseFloat(options.threshold));

      // Export if requested
      if (options.output) {
        tester.exportSummary(summary, options.output);
      }

      // Output
      if (options.ci) {
        // CI mode: minimal output
        console.log(`Tests: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
      } else if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printTestSummary(summary);
      }

      // Exit with appropriate code
      process.exit(summary.failed > 0 ? 1 : 0);
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Baseline command - Create or update baselines
 */
program
  .command('baseline <dir>')
  .description('Create or update baseline outputs')
  .option('-i, --input <file>', 'Input file with outputs to baseline')
  .option('--init', 'Initialize with sample baselines')
  .option('-f, --force', 'Overwrite existing baselines')
  .action(async (dir: string, options: {
    input?: string;
    init?: boolean;
    force?: boolean;
  }) => {
    const jsonOutput = program.opts().json;

    try {
      const fullDir = path.resolve(dir);
      const tester = new RegressionTester();

      // Check if baselines exist
      const manifestPath = path.join(fullDir, 'manifest.json');
      if (fs.existsSync(manifestPath) && !options.force) {
        throw new Error(`Baselines already exist at ${fullDir}. Use --force to overwrite.`);
      }

      let entries: BaselineEntry[];

      if (options.init) {
        // Create sample baselines
        entries = RegressionTester.createSampleBaselines();
      } else if (options.input) {
        // Load from input file
        const inputPath = path.resolve(options.input);
        if (!fs.existsSync(inputPath)) {
          throw new Error(`Input file not found: ${inputPath}`);
        }

        const content = fs.readFileSync(inputPath, 'utf-8');
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
          entries = data.map((item, index) => ({
            id: item.id || `baseline-${index + 1}`,
            input: item.input || '',
            output: item.output,
            timestamp: new Date().toISOString(),
            metadata: item.metadata
          }));
        } else {
          entries = [{
            id: data.id || 'baseline-1',
            input: data.input || '',
            output: data.output,
            timestamp: new Date().toISOString(),
            metadata: data.metadata
          }];
        }
      } else {
        throw new Error('Specify --input file or use --init for sample baselines');
      }

      // Save baselines
      tester.saveBaseline(dir, entries);

      if (jsonOutput) {
        console.log(JSON.stringify({
          success: true,
          path: fullDir,
          count: entries.length
        }, null, 2));
      } else {
        console.log(chalk.green(`\nBaselines saved to: ${fullDir}`));
        console.log(chalk.gray(`  Entries: ${entries.length}`));
        entries.forEach(e => {
          console.log(chalk.gray(`  - ${e.id}`));
        });
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Compare command - Compare two sets of outputs
 */
program
  .command('compare')
  .description('Compare two sets of outputs directly')
  .option('-b, --baseline <path>', 'Path to baseline outputs')
  .option('-c, --current <path>', 'Path to current outputs')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.85')
  .option('-o, --output <file>', 'Output results to file')
  .action(async (options: {
    baseline?: string;
    current?: string;
    threshold: string;
    output?: string;
  }) => {
    const jsonOutput = program.opts().json;

    try {
      if (!options.baseline || !options.current) {
        throw new Error('Both --baseline and --current are required');
      }

      const tester = new RegressionTester({
        similarityThreshold: parseFloat(options.threshold)
      });

      const summary = tester.compareDirectories(
        options.baseline,
        options.current,
        parseFloat(options.threshold)
      );

      if (options.output) {
        tester.exportSummary(summary, options.output);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printTestSummary(summary);
      }

      process.exit(summary.failed > 0 ? 1 : 0);
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Report command - Generate human-readable report
 */
program
  .command('report')
  .description('Generate a human-readable report from test results')
  .option('-i, --input <file>', 'Input results JSON file')
  .option('-o, --output <file>', 'Output report to file')
  .action(async (options: { input?: string; output?: string }) => {
    const jsonOutput = program.opts().json;

    try {
      if (!options.input) {
        throw new Error('--input file is required');
      }

      const inputPath = path.resolve(options.input);
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const content = fs.readFileSync(inputPath, 'utf-8');
      const summary: TestSummary = JSON.parse(content);

      const tester = new RegressionTester();
      const report = tester.generateReport(summary);

      if (options.output) {
        fs.writeFileSync(path.resolve(options.output), report);
        if (!jsonOutput) {
          console.log(chalk.green(`Report saved to: ${options.output}`));
        }
      } else {
        console.log(report);
      }

      if (jsonOutput && !options.output) {
        // Already printed report above
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Helper function to print test summary
 */
function printTestSummary(summary: TestSummary): void {
  console.log(chalk.bold('\nAI Regression Test Results\n'));
  console.log(chalk.gray(`Timestamp: ${summary.timestamp}`));
  console.log(chalk.gray(`Threshold: ${(summary.config.similarityThreshold * 100).toFixed(0)}%`));
  console.log();

  // Summary stats
  const passRateColor = summary.passRate >= 90 ? chalk.green :
    summary.passRate >= 70 ? chalk.yellow : chalk.red;

  console.log(chalk.bold('Summary:'));
  console.log(`  Total: ${summary.total}`);
  console.log(`  Passed: ${chalk.green(summary.passed.toString())}`);
  console.log(`  Failed: ${chalk.red(summary.failed.toString())}`);
  console.log(`  Pass Rate: ${passRateColor(summary.passRate.toFixed(1) + '%')}`);
  console.log();

  // Regressions
  if (summary.regressions > 0) {
    console.log(chalk.bold.red(`Regressions Detected: ${summary.regressions}`));
    console.log();

    const regressions = summary.results.filter(r => !r.passed);
    regressions.forEach(r => {
      console.log(chalk.red(`  [REGRESSION] ${r.id}`));
      console.log(chalk.gray(`    Similarity: ${(r.comparison.similarity.score * 100).toFixed(1)}%`));
      console.log(chalk.gray(`    Expected: >=${(r.comparison.threshold * 100).toFixed(0)}%`));
    });
    console.log();
  }

  // All results
  console.log(chalk.bold('All Results:'));
  summary.results.forEach(r => {
    const status = r.passed ? chalk.green('PASS') : chalk.red('FAIL');
    const similarity = (r.comparison.similarity.score * 100).toFixed(1);
    console.log(`  [${status}] ${r.id}: ${similarity}% similarity`);
  });
}

/**
 * Handle errors consistently
 */
function handleError(error: unknown, jsonOutput: boolean): void {
  const message = error instanceof Error ? error.message : String(error);

  if (jsonOutput) {
    console.log(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }

  process.exit(1);
}

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
