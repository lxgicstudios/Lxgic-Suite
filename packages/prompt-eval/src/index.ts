#!/usr/bin/env node

/**
 * prompt-eval CLI
 * Evaluate outputs with custom metrics
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { PromptEvaluator, EvalSummary, EvalResult } from './core';
import { MetricDefinition } from './metrics';

const program = new Command();

program
  .name('prompt-eval')
  .description('Evaluate outputs with custom metrics')
  .version('1.0.0');

// Global options
program.option('--json', 'Output results in JSON format');

/**
 * Run command - Execute evaluation against a config file
 */
program
  .command('run <config>')
  .description('Run evaluation against a configuration file')
  .option('-o, --output <file>', 'Output results to file')
  .option('--threshold <number>', 'Pass threshold (0-100)', '60')
  .action(async (configPath: string, options: { output?: string; threshold: string }) => {
    const jsonOutput = program.opts().json;

    try {
      const evaluator = new PromptEvaluator();
      const config = evaluator.loadConfig(configPath);

      // Override threshold if specified
      if (config.options) {
        config.options.passThreshold = parseInt(options.threshold, 10);
      }

      const summary = evaluator.runEvaluation(config);

      if (options.output) {
        evaluator.exportResults(options.output, summary);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printSummary(summary);
      }

      // Exit with error code if any tests failed
      process.exit(summary.failedTests > 0 ? 1 : 0);
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Score command - Score an output file
 */
program
  .command('score <output-file>')
  .description('Score outputs from a file')
  .option('-m, --metrics <metrics>', 'Comma-separated list of metrics', 'relevance,coherence,accuracy')
  .option('-o, --output <file>', 'Output results to file')
  .action(async (outputFile: string, options: { metrics: string; output?: string }) => {
    const jsonOutput = program.opts().json;

    try {
      const evaluator = new PromptEvaluator();
      const metrics = options.metrics.split(',').map(m => m.trim());
      const results = evaluator.scoreOutputFile(outputFile, metrics);

      if (options.output) {
        const fullPath = path.resolve(options.output);
        fs.writeFileSync(fullPath, JSON.stringify(results, null, 2));
      }

      if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        printScoreResults(results);
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Define command - Define a custom metric
 */
program
  .command('define <metric>')
  .description('Define a custom evaluation metric')
  .option('-d, --description <desc>', 'Metric description')
  .option('-t, --type <type>', 'Metric type (relevance, coherence, accuracy, custom)', 'custom')
  .option('-w, --weight <number>', 'Metric weight', '1.0')
  .option('--min <number>', 'Minimum score', '0')
  .option('--max <number>', 'Maximum score', '100')
  .option('-o, --output <file>', 'Save metric definition to file')
  .option('--init', 'Initialize a sample evaluation config')
  .action(async (metricName: string, options: {
    description?: string;
    type: string;
    weight: string;
    min: string;
    max: string;
    output?: string;
    init?: boolean;
  }) => {
    const jsonOutput = program.opts().json;

    try {
      if (options.init) {
        const outputPath = options.output || 'eval-config.yaml';
        PromptEvaluator.saveSampleConfig(outputPath);

        if (jsonOutput) {
          console.log(JSON.stringify({ success: true, path: outputPath }, null, 2));
        } else {
          console.log(chalk.green(`Sample evaluation config saved to: ${outputPath}`));
        }
        return;
      }

      const definition: MetricDefinition = {
        name: metricName,
        description: options.description || `Custom metric: ${metricName}`,
        type: options.type as any,
        weight: parseFloat(options.weight),
        minScore: parseInt(options.min, 10),
        maxScore: parseInt(options.max, 10)
      };

      const evaluator = new PromptEvaluator();
      evaluator.defineMetric(definition);

      if (options.output) {
        const metrics = evaluator.getAvailableMetrics();
        const metricsObj: Record<string, MetricDefinition> = {};
        metrics.forEach(m => { metricsObj[m.name] = m; });
        fs.writeFileSync(path.resolve(options.output), JSON.stringify(metricsObj, null, 2));
      }

      if (jsonOutput) {
        console.log(JSON.stringify(definition, null, 2));
      } else {
        console.log(chalk.green(`\nMetric defined: ${metricName}`));
        console.log(chalk.gray(`  Type: ${definition.type}`));
        console.log(chalk.gray(`  Weight: ${definition.weight}`));
        console.log(chalk.gray(`  Range: ${definition.minScore}-${definition.maxScore}`));
        if (definition.description) {
          console.log(chalk.gray(`  Description: ${definition.description}`));
        }
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * List command - List available metrics
 */
program
  .command('list')
  .description('List all available metrics')
  .action(() => {
    const jsonOutput = program.opts().json;

    try {
      const evaluator = new PromptEvaluator();
      const metrics = evaluator.getAvailableMetrics();

      if (jsonOutput) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log(chalk.bold('\nAvailable Metrics:\n'));
        metrics.forEach(metric => {
          console.log(chalk.cyan(`  ${metric.name}`));
          console.log(chalk.gray(`    Type: ${metric.type}`));
          console.log(chalk.gray(`    Description: ${metric.description}`));
          console.log(chalk.gray(`    Range: ${metric.minScore}-${metric.maxScore}`));
          console.log();
        });
      }
    } catch (error) {
      handleError(error, jsonOutput);
    }
  });

/**
 * Helper function to print evaluation summary
 */
function printSummary(summary: EvalSummary): void {
  console.log(chalk.bold(`\n${summary.name} - Evaluation Results\n`));
  console.log(chalk.gray(`Timestamp: ${summary.timestamp}\n`));

  // Overall stats
  const passRate = (summary.passedTests / summary.totalTests * 100).toFixed(1);
  console.log(chalk.bold('Summary:'));
  console.log(`  Total Tests: ${summary.totalTests}`);
  console.log(`  Passed: ${chalk.green(summary.passedTests.toString())}`);
  console.log(`  Failed: ${chalk.red(summary.failedTests.toString())}`);
  console.log(`  Pass Rate: ${parseFloat(passRate) >= 80 ? chalk.green(passRate + '%') : chalk.yellow(passRate + '%')}`);
  console.log();

  // Score stats
  console.log(chalk.bold('Scores:'));
  console.log(`  Average: ${formatScore(summary.averageScore)}`);
  console.log(`  Min: ${formatScore(summary.minScore)}`);
  console.log(`  Max: ${formatScore(summary.maxScore)}`);
  console.log();

  // Per-metric averages
  console.log(chalk.bold('Metric Averages:'));
  Object.entries(summary.metricAverages).forEach(([metric, avg]) => {
    console.log(`  ${metric}: ${formatScore(avg)}`);
  });
  console.log();

  // Individual results
  console.log(chalk.bold('Test Results:'));
  summary.results.forEach(result => {
    const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(`  [${status}] ${result.testCaseId}: ${formatScore(result.aggregateScore)}`);
  });
}

/**
 * Helper function to print score results
 */
function printScoreResults(results: EvalResult[]): void {
  console.log(chalk.bold('\nScoring Results:\n'));

  results.forEach(result => {
    console.log(chalk.cyan(`${result.testCaseId}:`));
    console.log(`  Aggregate Score: ${formatScore(result.aggregateScore)}`);
    console.log('  Metrics:');
    result.metricResults.forEach(mr => {
      console.log(`    ${mr.metric}: ${formatScore(mr.normalizedScore)}`);
    });
    console.log();
  });
}

/**
 * Format score with color
 */
function formatScore(score: number): string {
  const formatted = score.toFixed(1);
  if (score >= 80) return chalk.green(formatted);
  if (score >= 60) return chalk.yellow(formatted);
  return chalk.red(formatted);
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
