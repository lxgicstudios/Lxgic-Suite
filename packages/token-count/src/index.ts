#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import {
  countText,
  countFile,
  countBatch,
  countStdin,
  expandGlobPatterns,
  formatTokenCount,
  formatCost,
  CountResult,
} from './core';
import { BatchSummary } from './tokenizer';

const program = new Command();

program
  .name('token-count')
  .description('Count tokens for any text/prompt with accurate estimation for Claude and other AI models')
  .version('1.0.0');

/**
 * Format and display count results
 */
function displayResults(result: CountResult, options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(chalk.bold('\n Token Count Results'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(`${chalk.cyan('Input:')}       ${result.input}`);
  console.log(`${chalk.cyan('Tokens:')}      ${chalk.yellow(formatTokenCount(result.stats.total))} (${result.stats.total.toLocaleString()})`);
  console.log(`${chalk.cyan('Characters:')} ${result.stats.characters.toLocaleString()}`);
  console.log(`${chalk.cyan('Words:')}       ${result.stats.words.toLocaleString()}`);
  console.log(`${chalk.cyan('Lines:')}       ${result.stats.lines.toLocaleString()}`);
  console.log(`${chalk.cyan('Ratio:')}       ${result.stats.ratio} chars/token`);

  if (result.sections && result.sections.length > 0) {
    console.log(chalk.bold('\n Section Breakdown'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const section of result.sections) {
      const bar = '█'.repeat(Math.max(1, Math.round(section.percentage / 5)));
      console.log(`${chalk.cyan(section.name.padEnd(30))} ${chalk.yellow(section.tokens.toString().padStart(6))} tokens (${section.percentage}%)`);
      console.log(chalk.gray(`  ${bar}`));
    }
  }

  if (result.modelComparison && result.modelComparison.length > 0) {
    console.log(chalk.bold('\n Model Comparison'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const model of result.modelComparison) {
      const costStr = model.estimatedCost !== undefined ? formatCost(model.estimatedCost) : 'N/A';
      console.log(`${chalk.cyan(model.model.padEnd(20))} ${chalk.yellow(model.tokens.toString().padStart(8))} tokens  ${chalk.green(costStr.padStart(10))}`);
    }
  }

  console.log('');
}

/**
 * Display batch results
 */
function displayBatchResults(summary: BatchSummary, options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(chalk.bold('\n Batch Token Count Results'));
  console.log(chalk.gray('─'.repeat(60)));

  for (const file of summary.files) {
    if (file.error) {
      console.log(`${chalk.red('✗')} ${file.file}`);
      console.log(chalk.red(`    Error: ${file.error}`));
    } else {
      console.log(`${chalk.green('✓')} ${file.file}`);
      console.log(`    ${chalk.yellow(formatTokenCount(file.tokens))} tokens, ${file.words} words, ${file.characters} chars`);
    }
  }

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.cyan('Total Files:')}     ${summary.files.length}`);
  console.log(`  ${chalk.cyan('Total Tokens:')}    ${chalk.yellow(formatTokenCount(summary.totalTokens))} (${summary.totalTokens.toLocaleString()})`);
  console.log(`  ${chalk.cyan('Total Characters:')} ${summary.totalCharacters.toLocaleString()}`);
  console.log(`  ${chalk.cyan('Total Words:')}     ${summary.totalWords.toLocaleString()}`);

  if (summary.errorCount > 0) {
    console.log(`  ${chalk.red('Errors:')}          ${summary.errorCount}`);
  }

  console.log('');
}

// Count command for text or file
program
  .command('count [input]')
  .description('Count tokens in text or a file')
  .option('-b, --breakdown', 'Show breakdown by section')
  .option('-c, --compare', 'Compare token counts across models')
  .option('--stdin', 'Read input from stdin')
  .option('--json', 'Output in JSON format')
  .action(async (input: string | undefined, options) => {
    try {
      let result: CountResult;

      if (options.stdin) {
        result = await countStdin({
          breakdown: options.breakdown,
          compare: options.compare,
        });
      } else if (!input) {
        console.error(chalk.red('Error: Please provide text, a file path, or use --stdin'));
        process.exit(1);
      } else if (fs.existsSync(input)) {
        result = countFile(input, {
          breakdown: options.breakdown,
          compare: options.compare,
        });
      } else {
        result = countText(input, {
          breakdown: options.breakdown,
          compare: options.compare,
        });
      }

      displayResults(result, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Batch command for multiple files
program
  .command('batch <files...>')
  .description('Count tokens in multiple files')
  .option('--json', 'Output in JSON format')
  .action((files: string[], options) => {
    try {
      const expandedFiles = expandGlobPatterns(files);

      if (expandedFiles.length === 0) {
        console.error(chalk.red('Error: No files found matching the provided patterns'));
        process.exit(1);
      }

      const summary = countBatch(expandedFiles);
      displayBatchResults(summary, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Quick estimate command
program
  .command('estimate <text>')
  .description('Quick token estimate for a text string')
  .option('--json', 'Output in JSON format')
  .action((text: string, options) => {
    const result = countText(text, { compare: true });

    if (options.json) {
      console.log(JSON.stringify({
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        tokens: result.stats.total,
        characters: result.stats.characters,
        words: result.stats.words,
      }, null, 2));
    } else {
      console.log(`${chalk.yellow(result.stats.total)} tokens for ${result.stats.characters} characters`);
    }
  });

// Compare models command
program
  .command('compare <input>')
  .description('Compare token counts across different AI models')
  .option('--json', 'Output in JSON format')
  .action((input: string, options) => {
    try {
      let result: CountResult;

      if (fs.existsSync(input)) {
        result = countFile(input, { compare: true });
      } else {
        result = countText(input, { compare: true });
      }

      if (options.json) {
        console.log(JSON.stringify({
          input: result.input,
          modelComparison: result.modelComparison,
        }, null, 2));
      } else {
        console.log(chalk.bold('\n Model Token Comparison'));
        console.log(chalk.gray('─'.repeat(50)));

        if (result.modelComparison) {
          for (const model of result.modelComparison) {
            const costStr = model.estimatedCost !== undefined ? formatCost(model.estimatedCost) : 'N/A';
            console.log(`${chalk.cyan(model.model.padEnd(20))} ${chalk.yellow(model.tokens.toString().padStart(8))} tokens  ${chalk.green(costStr.padStart(10))}`);
          }
        }
        console.log('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Default action when no command is provided but arguments exist
program
  .argument('[text]', 'Text to count tokens for')
  .option('-b, --breakdown', 'Show breakdown by section')
  .option('-c, --compare', 'Compare token counts across models')
  .option('--stdin', 'Read input from stdin')
  .option('--json', 'Output in JSON format')
  .action(async (text: string | undefined, options) => {
    // If a subcommand was used, don't run default action
    if (process.argv.length > 2 && ['count', 'batch', 'estimate', 'compare'].includes(process.argv[2])) {
      return;
    }

    try {
      let result: CountResult;

      if (options.stdin) {
        result = await countStdin({
          breakdown: options.breakdown,
          compare: options.compare,
        });
      } else if (!text) {
        program.help();
        return;
      } else if (fs.existsSync(text)) {
        result = countFile(text, {
          breakdown: options.breakdown,
          compare: options.compare,
        });
      } else {
        result = countText(text, {
          breakdown: options.breakdown,
          compare: options.compare,
        });
      }

      displayResults(result, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

program.parse();
