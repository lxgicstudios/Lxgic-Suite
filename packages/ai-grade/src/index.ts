#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import {
  evaluateOutputs,
  createRubricInteractive,
  generateReport,
  loadReports,
  config,
} from './core';
import { loadRubric, validateRubric, GradingReport } from './rubrics';

const program = new Command();

program
  .name('ai-grade')
  .description('Grade outputs on custom rubrics using AI')
  .version('1.0.0');

// Evaluate command
program
  .command('evaluate <outputs-dir>')
  .description('Evaluate outputs in a directory against a rubric')
  .requiredOption('--rubric <path>', 'Path to rubric YAML file')
  .option('--graders <number>', 'Number of graders for inter-rater reliability', '1')
  .option('--output <path>', 'Output path for report JSON')
  .option('--json', 'Output results as JSON')
  .action(async (outputsDir: string, options) => {
    const spinner = ora('Evaluating outputs...').start();

    try {
      const resolvedDir = path.resolve(outputsDir);
      const rubricPath = path.resolve(options.rubric);

      // Validate inputs
      if (!fs.existsSync(resolvedDir)) {
        throw new Error(`Outputs directory not found: ${resolvedDir}`);
      }

      if (!fs.existsSync(rubricPath)) {
        throw new Error(`Rubric file not found: ${rubricPath}`);
      }

      // Load and validate rubric
      spinner.text = 'Loading rubric...';
      const rubric = loadRubric(rubricPath);
      spinner.text = `Rubric "${rubric.name}" loaded with ${rubric.criteria.length} criteria`;

      // Count files
      const files = fs.readdirSync(resolvedDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.txt', '.md', '.json', '.html'].includes(ext);
      });

      spinner.text = `Evaluating ${files.length} files...`;

      const reports = await evaluateOutputs(resolvedDir, {
        rubric: rubricPath,
        graders: parseInt(options.graders, 10),
        output: options.output ? path.resolve(options.output) : undefined,
        json: options.json,
      });

      spinner.succeed(`Evaluated ${reports.length} files`);

      if (options.json) {
        console.log(JSON.stringify(reports, null, 2));
      } else {
        // Display summary
        console.log('');
        console.log(chalk.bold('Evaluation Results'));
        console.log(chalk.gray('─'.repeat(50)));

        const avgScore = reports.reduce((sum, r) => sum + r.percentageScore, 0) / reports.length;
        console.log(`${chalk.cyan('Average Score:')} ${getScoreColor(avgScore)}${avgScore.toFixed(1)}%${chalk.reset('')}`);
        console.log('');

        for (const report of reports) {
          const scoreColor = getScoreColor(report.percentageScore);
          console.log(`${chalk.white(report.outputFile.padEnd(30))} ${scoreColor}${report.percentageScore.toFixed(1)}%${chalk.reset('')}`);

          for (const grade of report.grades) {
            const bar = createColoredBar(grade.score, grade.maxScore);
            console.log(`  ${chalk.gray(grade.criterion.padEnd(15))} ${bar} ${grade.score}/${grade.maxScore}`);
          }
          console.log('');
        }

        if (options.output) {
          console.log(chalk.green(`Report saved to: ${options.output}`));
        }
      }
    } catch (error) {
      spinner.fail('Evaluation failed');
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Create rubric command
program
  .command('create-rubric')
  .description('Create a new rubric template')
  .option('--output <path>', 'Output path for rubric', 'rubric.yaml')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const spinner = ora('Creating rubric template...').start();

    try {
      const outputPath = path.resolve(options.output);
      const rubric = await createRubricInteractive(outputPath);

      spinner.succeed('Rubric template created');

      if (options.json) {
        console.log(JSON.stringify({ path: outputPath, rubric }, null, 2));
      } else {
        console.log('');
        console.log(chalk.green(`Rubric saved to: ${outputPath}`));
        console.log('');
        console.log(chalk.cyan('Rubric Structure:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`Name: ${rubric.name}`);
        console.log(`Criteria: ${rubric.criteria.length}`);
        console.log('');

        for (const criterion of rubric.criteria) {
          console.log(`  ${chalk.white(criterion.name)} (weight: ${(criterion.weight * 100).toFixed(0)}%)`);
          console.log(`    ${chalk.gray(criterion.description)}`);
        }

        console.log('');
        console.log(chalk.yellow('Edit the YAML file to customize your rubric.'));
      }
    } catch (error) {
      spinner.fail('Failed to create rubric');
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
  .description('Generate a formatted report from grading results')
  .option('--input <path>', 'Path to grading results JSON', 'grade-results.json')
  .option('--format <type>', 'Report format (text, json, html)', 'text')
  .option('--output <path>', 'Output path for report')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const spinner = ora('Generating report...').start();

    try {
      const inputPath = path.resolve(options.input);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Results file not found: ${inputPath}`);
      }

      const reports = loadReports(inputPath);
      const report = generateReport(reports, {
        format: options.format,
        output: options.output,
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
        console.log('');
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

// Helper functions
function getScoreColor(score: number): string {
  if (score >= 80) return chalk.green.toString();
  if (score >= 60) return chalk.yellow.toString();
  return chalk.red.toString();
}

function createColoredBar(value: number, max: number): string {
  const width = 15;
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  const percentage = (value / max) * 100;

  let color = chalk.green;
  if (percentage < 60) color = chalk.red;
  else if (percentage < 80) color = chalk.yellow;

  return color('[' + '#'.repeat(filled) + '-'.repeat(empty) + ']');
}

// Parse and run
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
