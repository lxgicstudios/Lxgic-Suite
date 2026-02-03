#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import {
  compress,
  compressFile,
  compressAndSave,
  analyze,
  analyzeFile,
  suggestions,
  suggestionsForFile,
  compressBatch,
  formatTokenCount,
  estimateCostSavings,
  OptimizationResult,
  AnalysisResult,
  Suggestion,
} from './core';

const program = new Command();

program
  .name('token-optimize')
  .version('1.0.0')
  .description('Compress prompts to reduce tokens while maintaining meaning')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('compress <input>')
  .description('Compress a prompt file to reduce token count')
  .option('-o, --output <file>', 'Output file (default: input.optimized.ext)')
  .option('--preview', 'Preview changes without saving')
  .action(async (input, options) => {
    try {
      if (!fs.existsSync(input)) {
        throw new Error(`File not found: ${input}`);
      }

      let result: OptimizationResult & { filePath?: string; outputPath?: string };

      if (options.preview) {
        result = compressFile(input);
      } else {
        result = compressAndSave(input, options.output);
      }

      if (program.opts().json) {
        console.log(JSON.stringify({
          success: true,
          originalTokens: result.originalTokens,
          optimizedTokens: result.optimizedTokens,
          tokensSaved: result.tokensSaved,
          percentSaved: result.percentSaved,
          appliedOptimizations: result.appliedOptimizations,
          outputPath: result.outputPath,
        }, null, 2));
      } else {
        printCompressionResult(result, options.preview);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('analyze <input>')
  .description('Analyze a prompt for optimization opportunities')
  .action(async (input) => {
    try {
      let result: AnalysisResult & { filePath?: string };

      if (fs.existsSync(input)) {
        result = analyzeFile(input);
      } else {
        result = analyze(input);
      }

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        printAnalysisResult(result);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('suggest <input>')
  .description('Get specific suggestions for optimizing a prompt')
  .option('--limit <n>', 'Limit number of suggestions', '20')
  .action(async (input, options) => {
    try {
      let result: { filePath?: string; suggestions: Suggestion[] };

      if (fs.existsSync(input)) {
        result = suggestionsForFile(input);
      } else {
        result = { suggestions: suggestions(input) };
      }

      const limit = parseInt(options.limit, 10);
      const displaySuggestions = result.suggestions.slice(0, limit);

      if (program.opts().json) {
        console.log(JSON.stringify({
          success: true,
          totalSuggestions: result.suggestions.length,
          suggestions: displaySuggestions,
        }, null, 2));
      } else {
        printSuggestions(displaySuggestions, result.suggestions.length, limit);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('batch <files...>')
  .description('Compress multiple files at once')
  .option('--save', 'Save optimized files')
  .action(async (files, options) => {
    try {
      const result = compressBatch(files);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        console.log(chalk.bold('\nBatch Compression Results'));
        console.log('─'.repeat(60));

        for (const file of result.files) {
          const saved = file.tokensSaved > 0;
          const icon = saved ? chalk.green('✓') : chalk.gray('○');
          console.log(`${icon} ${file.filePath}`);
          console.log(`   ${formatTokenCount(file.originalTokens)} → ${formatTokenCount(file.optimizedTokens)} (${file.percentSaved.toFixed(1)}% saved)`);
        }

        console.log();
        console.log('─'.repeat(60));
        console.log(chalk.bold('Summary:'));
        console.log(`  Files processed:  ${result.files.length}`);
        console.log(`  Original tokens:  ${formatTokenCount(result.totalOriginalTokens)}`);
        console.log(`  Optimized tokens: ${formatTokenCount(result.totalOptimizedTokens)}`);
        console.log(`  Tokens saved:     ${chalk.green(formatTokenCount(result.totalSaved))} (${result.percentSaved.toFixed(1)}%)`);
        console.log(`  Est. cost saved:  ${chalk.green('$' + estimateCostSavings(result.totalSaved).toFixed(4))}/request`);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('estimate <input>')
  .description('Estimate token count for text or file')
  .action(async (input) => {
    try {
      let text: string;
      let source: string;

      if (fs.existsSync(input)) {
        text = fs.readFileSync(input, 'utf-8');
        source = input;
      } else {
        text = input;
        source = 'stdin';
      }

      const analysis = analyze(text);

      if (program.opts().json) {
        console.log(JSON.stringify({
          success: true,
          source,
          tokenCount: analysis.tokenCount,
          characterCount: analysis.characterCount,
          lineCount: analysis.lineCount,
        }, null, 2));
      } else {
        console.log(chalk.bold('\nToken Estimate'));
        console.log('─'.repeat(40));
        console.log(`Source:     ${source}`);
        console.log(`Tokens:     ${formatTokenCount(analysis.tokenCount)}`);
        console.log(`Characters: ${analysis.characterCount.toLocaleString()}`);
        console.log(`Lines:      ${analysis.lineCount}`);
        console.log();
        console.log(chalk.gray(`Est. cost: $${(analysis.tokenCount * 0.000003).toFixed(6)}/request (input)`));
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

function printCompressionResult(result: OptimizationResult & { outputPath?: string }, preview: boolean): void {
  console.log(chalk.bold('\nCompression Results'));
  console.log('─'.repeat(50));

  console.log(`Original tokens:   ${formatTokenCount(result.originalTokens)}`);
  console.log(`Optimized tokens:  ${formatTokenCount(result.optimizedTokens)}`);
  console.log(`Tokens saved:      ${chalk.green(formatTokenCount(result.tokensSaved))} (${result.percentSaved.toFixed(1)}%)`);
  console.log();

  if (result.appliedOptimizations.length > 0) {
    console.log(chalk.bold('Optimizations applied:'));
    for (const opt of result.appliedOptimizations) {
      console.log(`  ${chalk.green('✓')} ${opt}`);
    }
    console.log();
  }

  const costSaved = estimateCostSavings(result.tokensSaved);
  console.log(`Est. cost savings: ${chalk.green('$' + costSaved.toFixed(4))}/request`);

  if (preview) {
    console.log();
    console.log(chalk.yellow('Preview mode - no files were modified'));
    if (program.opts().verbose) {
      console.log();
      console.log(chalk.bold('Optimized content:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(result.optimized);
    }
  } else if (result.outputPath) {
    console.log();
    console.log(chalk.green(`✓ Saved to: ${result.outputPath}`));
  }
}

function printAnalysisResult(result: AnalysisResult & { filePath?: string }): void {
  console.log(chalk.bold('\nPrompt Analysis'));
  console.log('─'.repeat(50));

  if (result.filePath) {
    console.log(`File:              ${result.filePath}`);
  }
  console.log(`Token count:       ${formatTokenCount(result.tokenCount)}`);
  console.log(`Character count:   ${result.characterCount.toLocaleString()}`);
  console.log(`Line count:        ${result.lineCount}`);
  console.log(`Whitespace ratio:  ${(result.whitespaceRatio * 100).toFixed(1)}%`);
  console.log(`Avg line length:   ${result.avgLineLength.toFixed(0)} chars`);
  console.log();

  const potentialColor = result.optimizationPotential === 'high' ? chalk.red :
                        result.optimizationPotential === 'medium' ? chalk.yellow : chalk.green;
  console.log(`Optimization potential: ${potentialColor(result.optimizationPotential.toUpperCase())}`);
  console.log(`Estimated savings:      ${result.estimatedSavings.toFixed(1)}%`);

  if (result.verbosePhrases.length > 0) {
    console.log();
    console.log(chalk.yellow(`Found ${result.verbosePhrases.length} verbose phrase(s)`));
  }

  if (result.redundantPhrases.length > 0) {
    console.log(chalk.yellow(`Found ${result.redundantPhrases.length} redundant phrase(s)`));
  }
}

function printSuggestions(displaySuggestions: Suggestion[], total: number, limit: number): void {
  console.log(chalk.bold('\nOptimization Suggestions'));
  console.log('─'.repeat(60));

  if (displaySuggestions.length === 0) {
    console.log(chalk.green('✓ No optimization suggestions - prompt is already efficient!'));
    return;
  }

  let totalSavings = 0;

  for (const suggestion of displaySuggestions) {
    const typeColor = suggestion.type === 'verbose' ? chalk.yellow :
                      suggestion.type === 'redundancy' ? chalk.red :
                      suggestion.type === 'whitespace' ? chalk.gray : chalk.blue;

    console.log(`${typeColor(`[${suggestion.type}]`)} ${suggestion.description}`);
    if (suggestion.line) {
      console.log(chalk.gray(`  Line ${suggestion.line}`));
    }
    console.log(`  ${chalk.red(`- "${suggestion.original.substring(0, 50)}${suggestion.original.length > 50 ? '...' : ''}"`)}`)
    console.log(`  ${chalk.green(`+ "${suggestion.suggested.substring(0, 50)}${suggestion.suggested.length > 50 ? '...' : ''}"`)}`)
    console.log(`  Saves ~${suggestion.tokenSavings} token(s)`);
    console.log();

    totalSavings += suggestion.tokenSavings;
  }

  if (total > limit) {
    console.log(chalk.gray(`... and ${total - limit} more suggestions`));
    console.log();
  }

  console.log('─'.repeat(60));
  console.log(`Total potential savings: ~${chalk.green(totalSavings)} tokens`);
}

program.parse();
