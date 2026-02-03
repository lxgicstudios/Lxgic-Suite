#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import {
  runLoadTest,
  generateLoadReport,
  analyzeLoadResults,
  loadResults,
  createSampleConfig,
} from './core.js';
import { LoadTestProgress, LoadTestResults } from './loadtester.js';

const program = new Command();

program
  .name('prompt-stress')
  .description('Load test prompts at scale')
  .version('1.0.0');

// Run command
program
  .command('run <file>')
  .description('Run a load test with prompts from a file')
  .option('--rps <number>', 'Requests per second', '1')
  .option('--duration <seconds>', 'Test duration in seconds', '10')
  .option('--output <path>', 'Output path for results JSON')
  .option('--json', 'Output results as JSON')
  .option('--verbose', 'Show detailed progress')
  .action(async (file: string, options) => {
    const rps = parseFloat(options.rps);
    const duration = parseInt(options.duration, 10);

    if (isNaN(rps) || rps <= 0) {
      console.error(chalk.red('Error: --rps must be a positive number'));
      process.exit(1);
    }

    if (isNaN(duration) || duration <= 0) {
      console.error(chalk.red('Error: --duration must be a positive integer'));
      process.exit(1);
    }

    const spinner = ora({
      text: 'Starting load test...',
      color: 'cyan',
    });

    if (!options.json) {
      spinner.start();
    }

    let lastProgress: LoadTestProgress | null = null;

    try {
      const results = await runLoadTest(file, {
        rps,
        duration,
        output: options.output,
        json: options.json,
        verbose: options.verbose,
        onProgress: (progress: LoadTestProgress) => {
          lastProgress = progress;
          if (!options.json) {
            const successRate = progress.completedRequests > 0
              ? ((progress.successCount / progress.completedRequests) * 100).toFixed(1)
              : '0.0';

            spinner.text = `Running... ${progress.elapsed.toFixed(1)}s | ` +
              `${progress.completedRequests} requests | ` +
              `${progress.currentRps.toFixed(1)} RPS | ` +
              `${successRate}% success`;
          }
        },
      });

      spinner.succeed('Load test completed');

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        // Display summary
        console.log('');
        printSummary(results);

        if (options.output) {
          console.log(chalk.green(`\nResults saved to: ${options.output}`));
        }
      }
    } catch (error) {
      spinner.fail('Load test failed');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate a formatted report from load test results')
  .option('--input <path>', 'Path to results JSON', 'stress-results.json')
  .option('--format <type>', 'Report format (text, json, html)', 'text')
  .option('--output <path>', 'Output path for report')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Generating report...').start();

    try {
      const results = loadResults(options.input);
      const report = generateLoadReport(results, {
        format: options.format,
        verbose: true,
      });

      spinner.succeed('Report generated');

      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, report, 'utf-8');

        if (options.json) {
          console.log(JSON.stringify({ path: outputPath, format: options.format }, null, 2));
        } else {
          console.log(chalk.green(`Report saved to: ${outputPath}`));
        }
      } else {
        console.log(report);
      }
    } catch (error) {
      spinner.fail('Failed to generate report');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze <results>')
  .description('Analyze load test results and provide recommendations')
  .option('--json', 'Output as JSON')
  .action(async (resultsPath: string, options) => {
    const spinner = ora('Analyzing results...').start();

    try {
      const { results, analysis } = analyzeLoadResults(resultsPath);

      spinner.succeed('Analysis complete');

      if (options.json) {
        console.log(JSON.stringify({
          results: results.summary,
          latency: results.latency,
          analysis: analysis.analysis,
          recommendations: analysis.recommendations,
          score: analysis.score,
        }, null, 2));
      } else {
        console.log('');
        console.log(chalk.bold('Load Test Analysis'));
        console.log(chalk.gray('='.repeat(50)));
        console.log('');

        // Score
        const scoreColor = analysis.score >= 80 ? chalk.green :
          analysis.score >= 60 ? chalk.yellow : chalk.red;
        console.log(`${chalk.bold('Performance Score:')} ${scoreColor(analysis.score + '/100')}`);
        console.log('');

        // Analysis points
        console.log(chalk.cyan('Analysis:'));
        for (const point of analysis.analysis) {
          console.log(`  ${chalk.gray('•')} ${point}`);
        }
        console.log('');

        // Recommendations
        if (analysis.recommendations.length > 0) {
          console.log(chalk.yellow('Recommendations:'));
          for (const rec of analysis.recommendations) {
            console.log(`  ${chalk.gray('•')} ${rec}`);
          }
          console.log('');
        }

        // Key metrics
        console.log(chalk.cyan('Key Metrics:'));
        console.log(`  Total Requests:  ${results.summary.totalRequests}`);
        console.log(`  Success Rate:    ${((results.summary.successCount / results.summary.totalRequests) * 100).toFixed(1)}%`);
        console.log(`  Actual RPS:      ${results.summary.actualRps}`);
        console.log(`  p50 Latency:     ${results.latency.p50}ms`);
        console.log(`  p95 Latency:     ${results.latency.p95}ms`);
        console.log(`  p99 Latency:     ${results.latency.p99}ms`);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Init command (bonus utility)
program
  .command('init')
  .description('Create a sample prompts configuration file')
  .option('--output <path>', 'Output path', 'prompts.json')
  .option('--json', 'Output as JSON')
  .action((options) => {
    try {
      createSampleConfig(options.output);

      if (options.json) {
        console.log(JSON.stringify({ path: options.output }, null, 2));
      } else {
        console.log(chalk.green(`Sample config created: ${options.output}`));
        console.log('');
        console.log('Edit the file to customize your test prompts, then run:');
        console.log(chalk.cyan(`  prompt-stress run ${options.output} --rps 5 --duration 30`));
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

// Helper functions
function printSummary(results: LoadTestResults): void {
  const { summary, latency } = results;

  console.log(chalk.bold('Test Summary'));
  console.log(chalk.gray('-'.repeat(40)));

  // Success rate with color
  const successRate = (summary.successCount / summary.totalRequests) * 100;
  const successColor = successRate >= 99 ? chalk.green :
    successRate >= 95 ? chalk.yellow : chalk.red;

  console.log(`Total Requests:    ${summary.totalRequests}`);
  console.log(`Successful:        ${successColor(summary.successCount.toString())} (${successRate.toFixed(1)}%)`);
  console.log(`Failed:            ${summary.errorCount > 0 ? chalk.red(summary.errorCount.toString()) : '0'}`);
  console.log(`Duration:          ${summary.actualDuration}s`);
  console.log(`Actual RPS:        ${summary.actualRps}`);
  console.log('');

  console.log(chalk.bold('Latency Percentiles'));
  console.log(chalk.gray('-'.repeat(40)));

  const maxLatency = latency.p99;
  const barWidth = 30;

  const percentiles = [
    { label: 'p50', value: latency.p50 },
    { label: 'p90', value: latency.p90 },
    { label: 'p95', value: latency.p95 },
    { label: 'p99', value: latency.p99 },
  ];

  for (const p of percentiles) {
    const filled = Math.round((p.value / maxLatency) * barWidth);
    const bar = chalk.cyan('#'.repeat(filled)) + chalk.gray('-'.repeat(barWidth - filled));
    console.log(`${p.label.padEnd(5)} [${bar}] ${p.value}ms`);
  }
}

// Parse and run
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
