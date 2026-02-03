#!/usr/bin/env node

/**
 * prompt-ab CLI
 * A/B test prompt variations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ABTester, ABTestConfig } from './core';
import { ExperimentSummary, StatisticalResult } from './experiment';

const program = new Command();

program
  .name('prompt-ab')
  .description('A/B test prompt variations')
  .version('1.0.0');

// Global options
program.option('--json', 'Output results in JSON format');

/**
 * Run command - Execute A/B test
 */
program
  .command('run <prompt-a> <prompt-b>')
  .description('Run A/B test with two prompt variants')
  .option('-s, --samples <number>', 'Number of samples to test', '100')
  .option('-i, --inputs <file>', 'Input file with test cases')
  .option('-o, --output <file>', 'Output results to file')
  .option('-c, --confidence <number>', 'Confidence level (0-1)', '0.95')
  .option('-m, --metrics <metrics>', 'Comma-separated metrics to measure', 'quality,relevance,coherence')
  .option('-n, --name <name>', 'Experiment name', 'A/B Experiment')
  .action(async (promptA: string, promptB: string, options: {
    samples: string;
    inputs?: string;
    output?: string;
    confidence: string;
    metrics: string;
    name: string;
  }) => {
    const jsonOutput = program.opts().json;

    try {
      const tester = new ABTester();

      // Load prompts
      const promptAContent = tester.loadPrompt(promptA);
      const promptBContent = tester.loadPrompt(promptB);

      // Load inputs if provided
      const inputs = options.inputs ? tester.loadInputs(options.inputs) : undefined;

      const config: ABTestConfig = {
        name: options.name,
        promptA: promptAContent,
        promptB: promptBContent,
        samples: parseInt(options.samples, 10),
        confidenceLevel: parseFloat(options.confidence),
        metrics: options.metrics.split(',').map(m => m.trim())
      };

      if (!jsonOutput) {
        console.log(chalk.cyan('\nRunning A/B Test...'));
        console.log(chalk.gray(`  Variant A: ${promptA}`));
        console.log(chalk.gray(`  Variant B: ${promptB}`));
        console.log(chalk.gray(`  Samples: ${config.samples}`));
        console.log();
      }

      // Run experiment
      const results = tester.runExperiment(config, inputs);

      // Analyze results
      const summary = tester.analyzeResults(results);
      results.summary = summary;

      // Export if requested
      if (options.output) {
        tester.exportResults(options.output, results);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        printSummary(summary);
      }

      // Exit with code based on significance
      const hasSignificant = summary.statisticalResults.some(r => r.isSignificant);
      process.exit(hasSignificant ? 0 : 0); // Always 0 for successful run
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Analyze command - Analyze existing results
 */
program
  .command('analyze <results-file>')
  .description('Analyze results from a previous experiment')
  .option('-o, --output <file>', 'Output analysis to file')
  .action(async (resultsFile: string, options: { output?: string }) => {
    const jsonOutput = program.opts().json;

    try {
      const tester = new ABTester();
      const results = tester.loadResults(resultsFile);
      const summary = tester.analyzeResults(results);

      if (options.output) {
        fs.writeFileSync(
          path.resolve(options.output),
          JSON.stringify(summary, null, 2)
        );
      }

      if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printSummary(summary);
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Report command - Generate human-readable report
 */
program
  .command('report')
  .description('Generate a detailed report from results')
  .option('-i, --input <file>', 'Input results file')
  .option('-o, --output <file>', 'Output report to file')
  .action(async (options: { input?: string; output?: string }) => {
    const jsonOutput = program.opts().json;

    try {
      if (!options.input) {
        throw new Error('--input file is required');
      }

      const tester = new ABTester();
      const results = tester.loadResults(options.input);

      // Ensure we have a summary
      const summary = results.summary || tester.analyzeResults(results);
      const report = tester.generateReport(summary);

      if (options.output) {
        fs.writeFileSync(path.resolve(options.output), report);
        if (!jsonOutput) {
          console.log(chalk.green(`Report saved to: ${options.output}`));
        }
      } else {
        console.log(report);
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Sample-size command - Calculate required sample size
 */
program
  .command('sample-size')
  .description('Calculate required sample size for desired effect')
  .option('-e, --effect <number>', 'Expected effect size (Cohen\'s d)', '0.5')
  .option('-p, --power <number>', 'Desired statistical power', '0.8')
  .option('-a, --alpha <number>', 'Significance level', '0.05')
  .action((options: { effect: string; power: string; alpha: string }) => {
    const jsonOutput = program.opts().json;

    try {
      const tester = new ABTester();
      const effect = parseFloat(options.effect);
      const sampleSize = tester.calculateSampleSize(effect);

      if (jsonOutput) {
        console.log(JSON.stringify({
          expectedEffect: effect,
          power: parseFloat(options.power),
          alpha: parseFloat(options.alpha),
          recommendedSampleSize: sampleSize
        }, null, 2));
      } else {
        console.log(chalk.bold('\nSample Size Calculation\n'));
        console.log(`  Expected Effect Size: ${effect} (${interpretEffectSize(effect)})`);
        console.log(`  Power: ${options.power}`);
        console.log(`  Alpha: ${options.alpha}`);
        console.log();
        console.log(chalk.green(`  Recommended Sample Size: ${sampleSize} per variant`));
        console.log(chalk.gray(`  Total samples needed: ${sampleSize * 2}`));
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Helper to print experiment summary
 */
function printSummary(summary: ExperimentSummary): void {
  console.log(chalk.bold('\nA/B Test Results\n'));
  console.log(chalk.gray(`Experiment: ${summary.name}`));
  console.log(chalk.gray(`Timestamp: ${summary.timestamp}`));
  console.log(chalk.gray(`Confidence Level: ${(summary.confidence * 100).toFixed(0)}%`));
  console.log();

  // Variants info
  console.log(chalk.bold('Variants:'));
  console.log(`  A: ${summary.variantA}`);
  console.log(`  B: ${summary.variantB}`);
  console.log(`  Samples: ${summary.sampleSize} per variant (${summary.totalSamples} total)`);
  console.log();

  // Metric results
  console.log(chalk.bold('Metric Results:'));
  console.log();

  for (const result of summary.statisticalResults) {
    printMetricResult(result);
  }

  // Overall winner
  console.log(chalk.bold('Conclusion:'));
  const winnerText = summary.overallWinner === 'tie'
    ? chalk.yellow('TIE - No Clear Winner')
    : chalk.green(`Variant ${summary.overallWinner} Wins`);
  console.log(`  Overall Winner: ${winnerText}`);
  console.log();
  console.log(chalk.gray(`  ${summary.recommendation}`));
  console.log();
}

/**
 * Print single metric result
 */
function printMetricResult(result: StatisticalResult): void {
  const significantBadge = result.isSignificant
    ? chalk.green(' [SIGNIFICANT]')
    : chalk.gray(' [NOT SIGNIFICANT]');

  console.log(chalk.cyan(`  ${result.metric.toUpperCase()}${significantBadge}`));
  console.log(`    Variant A: ${result.variantAMean.toFixed(2)} (SD: ${result.variantAStdDev.toFixed(2)})`);
  console.log(`    Variant B: ${result.variantBMean.toFixed(2)} (SD: ${result.variantBStdDev.toFixed(2)})`);

  const diffColor = result.difference > 0 ? chalk.green : result.difference < 0 ? chalk.red : chalk.gray;
  console.log(`    Difference: ${diffColor(result.difference.toFixed(2))} (${result.percentChange.toFixed(1)}%)`);
  console.log(chalk.gray(`    p-value: ${result.pValue.toFixed(4)}`));

  if (result.isSignificant) {
    const winner = result.winner === 'tie' ? 'Tie' : `Variant ${result.winner}`;
    console.log(chalk.green(`    Winner: ${winner}`));
  }
  console.log();
}

/**
 * Interpret effect size
 */
function interpretEffectSize(d: number): string {
  const absD = Math.abs(d);
  if (absD < 0.2) return 'negligible';
  if (absD < 0.5) return 'small';
  if (absD < 0.8) return 'medium';
  return 'large';
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
