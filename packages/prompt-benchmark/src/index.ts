#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import { BenchmarkRunner, BenchmarkConfig, BenchmarkResult } from './core.js';
import { formatReport, formatComparisonReport } from './reporter.js';

const program = new Command();

program
  .name('prompt-benchmark')
  .description('Benchmark prompt latency and quality across models')
  .version('1.0.0');

/**
 * Run benchmark command
 */
program
  .command('run <file>')
  .description('Run benchmark on a prompt file')
  .option('-i, --iterations <count>', 'Number of iterations', '10')
  .option('-m, --models <models>', 'Comma-separated list of models', 'claude-3-5-sonnet-20241022')
  .option('-t, --temperature <temp>', 'Temperature for generation', '0.7')
  .option('--max-tokens <tokens>', 'Maximum tokens in response', '1024')
  .option('-o, --output <file>', 'Save results to file')
  .option('--json', 'Output in JSON format')
  .option('--warmup <count>', 'Number of warmup iterations', '1')
  .action(async (file, options) => {
    try {
      // Read prompt file
      const promptContent = await fs.readFile(file, 'utf-8');
      const prompt = parsePromptFile(promptContent);

      const models = options.models.split(',').map((m: string) => m.trim());
      const iterations = parseInt(options.iterations, 10);
      const warmup = parseInt(options.warmup, 10);

      const config: BenchmarkConfig = {
        prompt: prompt.content,
        systemPrompt: prompt.system,
        models,
        iterations,
        warmupIterations: warmup,
        temperature: parseFloat(options.temperature),
        maxTokens: parseInt(options.maxTokens, 10),
      };

      const runner = new BenchmarkRunner(config);

      if (!options.json) {
        console.log(chalk.cyan.bold('\n  Prompt Benchmark'));
        console.log(chalk.gray(`  File: ${file}`));
        console.log(chalk.gray(`  Models: ${models.join(', ')}`));
        console.log(chalk.gray(`  Iterations: ${iterations} (+ ${warmup} warmup)\n`));
      }

      const spinner = options.json ? null : ora('Running benchmark...').start();

      const results = await runner.run((progress) => {
        if (spinner) {
          spinner.text = `Running ${progress.model} - iteration ${progress.iteration}/${progress.total}`;
        }
      });

      if (spinner) {
        spinner.succeed('Benchmark complete');
      }

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(formatReport(results));
      }

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(results, null, 2), 'utf-8');
        if (!options.json) {
          console.log(chalk.green(`\nResults saved to: ${options.output}`));
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      } else {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      }
      process.exit(1);
    }
  });

/**
 * Compare prompts command
 */
program
  .command('compare <file1> <file2>')
  .description('Compare two prompt files')
  .option('-i, --iterations <count>', 'Number of iterations', '5')
  .option('-m, --model <model>', 'Model to use for comparison', 'claude-3-5-sonnet-20241022')
  .option('-t, --temperature <temp>', 'Temperature for generation', '0.7')
  .option('--max-tokens <tokens>', 'Maximum tokens in response', '1024')
  .option('-o, --output <file>', 'Save results to file')
  .option('--json', 'Output in JSON format')
  .action(async (file1, file2, options) => {
    try {
      // Read both prompt files
      const prompt1Content = await fs.readFile(file1, 'utf-8');
      const prompt2Content = await fs.readFile(file2, 'utf-8');

      const prompt1 = parsePromptFile(prompt1Content);
      const prompt2 = parsePromptFile(prompt2Content);

      const iterations = parseInt(options.iterations, 10);
      const model = options.model;

      if (!options.json) {
        console.log(chalk.cyan.bold('\n  Prompt Comparison'));
        console.log(chalk.gray(`  File 1: ${file1}`));
        console.log(chalk.gray(`  File 2: ${file2}`));
        console.log(chalk.gray(`  Model: ${model}`));
        console.log(chalk.gray(`  Iterations: ${iterations}\n`));
      }

      const spinner = options.json ? null : ora('Running comparison...').start();

      // Run benchmark for first prompt
      const config1: BenchmarkConfig = {
        prompt: prompt1.content,
        systemPrompt: prompt1.system,
        models: [model],
        iterations,
        warmupIterations: 1,
        temperature: parseFloat(options.temperature),
        maxTokens: parseInt(options.maxTokens, 10),
      };

      const runner1 = new BenchmarkRunner(config1);
      const results1 = await runner1.run((progress) => {
        if (spinner) {
          spinner.text = `Running prompt 1 - iteration ${progress.iteration}/${progress.total}`;
        }
      });

      // Run benchmark for second prompt
      const config2: BenchmarkConfig = {
        prompt: prompt2.content,
        systemPrompt: prompt2.system,
        models: [model],
        iterations,
        warmupIterations: 1,
        temperature: parseFloat(options.temperature),
        maxTokens: parseInt(options.maxTokens, 10),
      };

      const runner2 = new BenchmarkRunner(config2);
      const results2 = await runner2.run((progress) => {
        if (spinner) {
          spinner.text = `Running prompt 2 - iteration ${progress.iteration}/${progress.total}`;
        }
      });

      if (spinner) {
        spinner.succeed('Comparison complete');
      }

      const comparison = {
        prompt1: { file: file1, results: results1 },
        prompt2: { file: file2, results: results2 },
        model,
        iterations,
      };

      if (options.json) {
        console.log(JSON.stringify(comparison, null, 2));
      } else {
        console.log(formatComparisonReport(
          results1[0],
          results2[0],
          file1,
          file2
        ));
      }

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(comparison, null, 2), 'utf-8');
        if (!options.json) {
          console.log(chalk.green(`\nResults saved to: ${options.output}`));
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      } else {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      }
      process.exit(1);
    }
  });

/**
 * Parse a prompt file (supports plain text and YAML-like frontmatter)
 */
function parsePromptFile(content: string): { content: string; system?: string } {
  // Check for frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const promptContent = frontmatterMatch[2].trim();

    // Simple YAML parsing for system prompt
    const systemMatch = frontmatter.match(/system:\s*["']?(.+?)["']?\s*$/m);
    const system = systemMatch ? systemMatch[1] : undefined;

    return { content: promptContent, system };
  }

  return { content: content.trim() };
}

program.parse();
