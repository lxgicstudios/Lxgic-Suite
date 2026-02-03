#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import {
  formatOutput,
  formatDuration,
  formatProgress,
  findLatestJob,
  loadJobState,
  deleteJobState,
  BatchJob,
  ProcessResult
} from './core';
import { readFile, readTemplate, detectFormat } from './formats';
import { processBatch, previewBatch, getDefaultConfig } from './processor';

const program = new Command();

program
  .name('ai-batch')
  .description('Batch process CSVs/files with AI')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

program
  .command('process <input>')
  .description('Process a CSV or JSON file with AI')
  .option('-p, --prompt <template>', 'Prompt template with {{column}} variables')
  .option('-t, --template <file>', 'Prompt template file (.txt)')
  .option('-o, --output <file>', 'Output file path')
  .option('-c, --concurrency <number>', 'Concurrent processing limit', '5')
  .option('-r, --retries <number>', 'Max retries per row', '3')
  .option('--output-column <name>', 'Name of the output column', 'ai_output')
  .option('--timeout <ms>', 'Timeout per row in milliseconds', '30000')
  .option('--dry-run', 'Preview without processing')
  .action(async (inputPath: string, options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      // Determine prompt template
      let promptTemplate: string;
      if (options.template) {
        spinner.start('Reading template file...');
        promptTemplate = readTemplate(options.template);
        spinner.succeed('Template loaded');
      } else if (options.prompt) {
        promptTemplate = options.prompt;
      } else {
        throw new Error('Please provide --prompt or --template');
      }

      // Determine output file
      const inputExt = path.extname(inputPath);
      const outputFile = options.output || inputPath.replace(inputExt, `_output${inputExt}`);

      // Read input file
      spinner.start('Reading input file...');
      const { headers, rows, format } = await readFile(inputPath);
      spinner.succeed(`Loaded ${rows.length} rows from ${inputPath}`);

      if (!jsonOutput) {
        console.log(`  Columns: ${headers.join(', ')}`);
        console.log(`  Format: ${format.toUpperCase()}`);
        console.log(`  Output: ${outputFile}`);
        console.log('');
      }

      // Dry run - preview only
      if (options.dryRun) {
        const previews = previewBatch(rows, promptTemplate, 5);

        if (jsonOutput) {
          console.log(formatOutput({
            success: true,
            totalRows: rows.length,
            previews
          }, true));
        } else {
          console.log(chalk.bold('Preview (first 5 rows):\n'));

          for (const preview of previews) {
            console.log(chalk.cyan(`Row ${preview.index + 1}:`));
            console.log(`  Input: ${JSON.stringify(preview.input)}`);
            console.log(`  Prompt: ${preview.prompt.substring(0, 100)}...`);
            console.log('');
          }
        }
        return;
      }

      // Configure batch processing
      const config = {
        ...getDefaultConfig(),
        concurrency: parseInt(options.concurrency, 10),
        retries: parseInt(options.retries, 10),
        timeout: parseInt(options.timeout, 10),
        outputColumn: options.outputColumn
      };

      let lastProgress = '';

      // Process batch
      spinner.start('Processing...');

      const { job, results } = await processBatch(
        inputPath,
        outputFile,
        promptTemplate,
        config,
        {
          onStart: (j: BatchJob) => {
            if (!jsonOutput) {
              console.log(chalk.bold(`\nJob started: ${j.id}\n`));
            }
          },
          onProgress: (j: BatchJob, result: ProcessResult) => {
            const processed = j.processedRows + j.failedRows;
            const progress = formatProgress(processed, j.totalRows);

            if (jsonOutput) {
              // Don't spam JSON output
            } else {
              spinner.text = `Processing... ${progress}`;
            }
          },
          onComplete: (j: BatchJob, r: ProcessResult[]) => {
            if (j.failedRows > 0) {
              spinner.warn(`Completed with ${j.failedRows} errors`);
            } else {
              spinner.succeed(`Completed processing ${j.processedRows} rows`);
            }
          },
          onRowError: (j: BatchJob, row, error) => {
            if (!jsonOutput) {
              console.log(chalk.red(`  [Error] Row ${row.index + 1}: ${error.message}`));
            }
          }
        }
      );

      // Output results
      if (jsonOutput) {
        console.log(formatOutput({
          success: job.status === 'completed',
          job: {
            id: job.id,
            status: job.status,
            totalRows: job.totalRows,
            processedRows: job.processedRows,
            failedRows: job.failedRows
          },
          outputFile,
          errors: job.errors
        }, true));
      } else {
        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(`  Total rows:     ${job.totalRows}`);
        console.log(`  Processed:      ${chalk.green(job.processedRows)}`);
        console.log(`  Failed:         ${chalk.red(job.failedRows)}`);
        console.log(`  Output file:    ${outputFile}`);

        if (job.errors.length > 0 && job.errors.length <= 10) {
          console.log('');
          console.log(chalk.bold('Errors:'));
          for (const err of job.errors) {
            console.log(chalk.red(`  Row ${err.row + 1}: ${err.error}`));
          }
        }
      }

      process.exit(job.status === 'completed' ? 0 : 1);
    } catch (error) {
      spinner.fail('Processing failed');

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
  .command('preview <input>')
  .description('Preview prompts that would be generated')
  .option('-p, --prompt <template>', 'Prompt template with {{column}} variables')
  .option('-t, --template <file>', 'Prompt template file (.txt)')
  .option('-n, --limit <number>', 'Number of rows to preview', '5')
  .action(async (inputPath: string, options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      // Determine prompt template
      let promptTemplate: string;
      if (options.template) {
        promptTemplate = readTemplate(options.template);
      } else if (options.prompt) {
        promptTemplate = options.prompt;
      } else {
        throw new Error('Please provide --prompt or --template');
      }

      // Read input file
      spinner.start('Reading input file...');
      const { headers, rows, format } = await readFile(inputPath);
      spinner.succeed(`Loaded ${rows.length} rows`);

      const limit = parseInt(options.limit, 10);
      const previews = previewBatch(rows, promptTemplate, limit);

      if (jsonOutput) {
        console.log(formatOutput({
          success: true,
          totalRows: rows.length,
          headers,
          format,
          template: promptTemplate,
          previews
        }, true));
      } else {
        console.log('');
        console.log(chalk.bold('File Info:'));
        console.log(`  Rows: ${rows.length}`);
        console.log(`  Columns: ${headers.join(', ')}`);
        console.log(`  Format: ${format.toUpperCase()}`);
        console.log('');
        console.log(chalk.bold('Template:'));
        console.log(`  ${promptTemplate}`);
        console.log('');
        console.log(chalk.bold(`Preview (first ${limit} rows):\n`));

        for (const preview of previews) {
          console.log(chalk.cyan(`Row ${preview.index + 1}:`));
          console.log(`  Data: ${JSON.stringify(preview.input)}`);
          console.log(`  Prompt: ${preview.prompt}`);
          console.log('');
        }
      }
    } catch (error) {
      spinner.fail('Preview failed');

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
  .command('resume [jobId]')
  .description('Resume an interrupted job')
  .option('-c, --concurrency <number>', 'Concurrent processing limit', '5')
  .action(async (jobId: string | undefined, options) => {
    const jsonOutput = program.opts().json;
    const spinner = ora({ isSilent: jsonOutput });

    try {
      // Find job to resume
      let state;
      if (jobId) {
        state = loadJobState(jobId);
        if (!state) {
          throw new Error(`Job not found: ${jobId}`);
        }
      } else {
        state = findLatestJob();
        if (!state) {
          throw new Error('No jobs found to resume');
        }
      }

      const { job } = state;

      if (job.status === 'completed') {
        if (jsonOutput) {
          console.log(formatOutput({
            success: true,
            message: 'Job already completed',
            job
          }, true));
        } else {
          console.log(chalk.green(`Job ${job.id} is already completed`));
        }
        return;
      }

      if (!jsonOutput) {
        console.log(chalk.bold(`Resuming job: ${job.id}`));
        console.log(`  Input: ${job.inputFile}`);
        console.log(`  Output: ${job.outputFile}`);
        console.log(`  Progress: ${job.processedRows + job.failedRows}/${job.totalRows}`);
        console.log('');
      }

      // Configure batch processing
      const config = {
        ...getDefaultConfig(),
        concurrency: parseInt(options.concurrency, 10)
      };

      spinner.start('Resuming processing...');

      const { job: updatedJob, results } = await processBatch(
        job.inputFile,
        job.outputFile,
        job.promptTemplate,
        config,
        {
          onProgress: (j: BatchJob) => {
            const processed = j.processedRows + j.failedRows;
            spinner.text = `Processing... ${formatProgress(processed, j.totalRows)}`;
          },
          onComplete: (j: BatchJob) => {
            if (j.failedRows > 0) {
              spinner.warn(`Completed with ${j.failedRows} errors`);
            } else {
              spinner.succeed(`Completed processing ${j.processedRows} rows`);
            }
          }
        },
        undefined,
        state
      );

      // Clean up state file on completion
      if (updatedJob.status === 'completed') {
        deleteJobState(updatedJob.id);
      }

      if (jsonOutput) {
        console.log(formatOutput({
          success: updatedJob.status === 'completed',
          job: updatedJob
        }, true));
      } else {
        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(`  Total rows:     ${updatedJob.totalRows}`);
        console.log(`  Processed:      ${chalk.green(updatedJob.processedRows)}`);
        console.log(`  Failed:         ${chalk.red(updatedJob.failedRows)}`);
      }

      process.exit(updatedJob.status === 'completed' ? 0 : 1);
    } catch (error) {
      spinner.fail('Resume failed');

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
  .command('status')
  .description('Show status of recent jobs')
  .action(async () => {
    const jsonOutput = program.opts().json;

    try {
      const state = findLatestJob();

      if (!state) {
        if (jsonOutput) {
          console.log(formatOutput({
            success: true,
            jobs: []
          }, true));
        } else {
          console.log(chalk.dim('No recent jobs found'));
        }
        return;
      }

      const { job } = state;

      if (jsonOutput) {
        console.log(formatOutput({
          success: true,
          job
        }, true));
      } else {
        console.log(chalk.bold('\nMost Recent Job:\n'));
        console.log(`  ID:         ${job.id}`);
        console.log(`  Status:     ${job.status === 'completed' ? chalk.green(job.status) : chalk.yellow(job.status)}`);
        console.log(`  Input:      ${job.inputFile}`);
        console.log(`  Output:     ${job.outputFile}`);
        console.log(`  Progress:   ${job.processedRows + job.failedRows}/${job.totalRows}`);
        console.log(`  Processed:  ${chalk.green(job.processedRows)}`);
        console.log(`  Failed:     ${chalk.red(job.failedRows)}`);
        console.log(`  Started:    ${job.startedAt}`);

        if (job.status !== 'completed' && job.status !== 'failed') {
          console.log('');
          console.log(chalk.dim(`  Run 'ai-batch resume' to continue this job`));
        }
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
