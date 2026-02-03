import chalk from 'chalk';
import type { Change } from 'diff';
import type { DiffResult, ComparisonResult } from './core.js';

/**
 * Format a single diff change with colors
 */
function formatChange(change: Change): string {
  const lines = change.value.split('\n');

  // Remove empty last line if the value ends with newline
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (change.added) {
    return lines.map(line => chalk.green(`+ ${line}`)).join('\n');
  } else if (change.removed) {
    return lines.map(line => chalk.red(`- ${line}`)).join('\n');
  } else {
    return lines.map(line => chalk.gray(`  ${line}`)).join('\n');
  }
}

/**
 * Format the diff output with colored changes
 */
export function formatDiffOutput(result: DiffResult): string {
  const output: string[] = [];

  output.push(chalk.bold('Files compared:'));
  output.push(chalk.yellow(`  - ${result.file1}`));
  output.push(chalk.cyan(`  + ${result.file2}`));
  output.push('');

  output.push(chalk.bold('Changes:'));
  output.push(chalk.red(`  - ${result.stats.deletions} deletions`));
  output.push(chalk.green(`  + ${result.stats.additions} additions`));
  output.push(chalk.gray(`    ${result.stats.unchanged} unchanged`));
  output.push('');

  output.push(chalk.bold('Diff:'));
  output.push(chalk.dim('─'.repeat(60)));

  for (const change of result.changes) {
    output.push(formatChange(change));
  }

  output.push(chalk.dim('─'.repeat(60)));

  return output.join('\n');
}

/**
 * Format token difference information
 */
export function formatTokenDiff(result: DiffResult): string {
  const output: string[] = [];
  const { tokenDiff } = result;

  output.push('');
  output.push(chalk.bold('Token Analysis:'));
  output.push(`  ${chalk.yellow('File 1:')} ~${tokenDiff.prompt1Tokens} tokens`);
  output.push(`  ${chalk.cyan('File 2:')} ~${tokenDiff.prompt2Tokens} tokens`);

  const diffColor = tokenDiff.difference > 0 ? chalk.red : chalk.green;
  const diffSign = tokenDiff.difference > 0 ? '+' : '';
  output.push(`  ${chalk.bold('Change:')} ${diffColor(`${diffSign}${tokenDiff.difference} tokens (${diffSign}${tokenDiff.percentChange}%)`)}`);

  return output.join('\n');
}

/**
 * Format the output comparison results
 */
export function formatComparisonOutput(result: ComparisonResult): string {
  const output: string[] = [];

  output.push(chalk.bold(`Model: ${result.model}`));
  output.push('');

  if (result.input) {
    output.push(chalk.bold('Sample Input:'));
    output.push(chalk.dim(result.input));
    output.push('');
  }

  output.push(chalk.bold('Timing:'));
  output.push(`  ${chalk.yellow('Prompt 1:')} ${result.timing.prompt1Time}ms`);
  output.push(`  ${chalk.cyan('Prompt 2:')} ${result.timing.prompt2Time}ms`);
  output.push('');

  output.push(chalk.bold('Token Usage:'));
  output.push(`  ${chalk.yellow('Prompt 1:')} ${result.usage.prompt1InputTokens} input, ${result.usage.prompt1OutputTokens} output`);
  output.push(`  ${chalk.cyan('Prompt 2:')} ${result.usage.prompt2InputTokens} input, ${result.usage.prompt2OutputTokens} output`);
  output.push('');

  output.push(chalk.bold.yellow('Output 1:'));
  output.push(chalk.dim('─'.repeat(60)));
  output.push(result.output1);
  output.push(chalk.dim('─'.repeat(60)));
  output.push('');

  output.push(chalk.bold.cyan('Output 2:'));
  output.push(chalk.dim('─'.repeat(60)));
  output.push(result.output2);
  output.push(chalk.dim('─'.repeat(60)));
  output.push('');

  // Show diff of outputs
  output.push(chalk.bold('Output Diff:'));
  output.push(chalk.dim('─'.repeat(60)));

  for (const change of result.outputDiff) {
    output.push(formatChange(change));
  }

  output.push(chalk.dim('─'.repeat(60)));

  return output.join('\n');
}

/**
 * Format a side-by-side comparison (for terminal width)
 */
export function formatSideBySide(
  left: string,
  right: string,
  leftHeader: string = 'Left',
  rightHeader: string = 'Right',
  width: number = 40
): string {
  const output: string[] = [];
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const maxLines = Math.max(leftLines.length, rightLines.length);

  // Truncate and pad function
  const formatLine = (line: string, w: number): string => {
    if (line.length > w) {
      return line.substring(0, w - 3) + '...';
    }
    return line.padEnd(w);
  };

  // Headers
  output.push(chalk.bold(formatLine(leftHeader, width)) + ' | ' + chalk.bold(formatLine(rightHeader, width)));
  output.push('─'.repeat(width) + '─┼─' + '─'.repeat(width));

  // Content
  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i] || '';
    const rightLine = rightLines[i] || '';
    output.push(formatLine(leftLine, width) + ' | ' + formatLine(rightLine, width));
  }

  return output.join('\n');
}

/**
 * Create a unified diff string
 */
export function createUnifiedDiff(result: DiffResult): string {
  const output: string[] = [];

  output.push(`--- ${result.file1}`);
  output.push(`+++ ${result.file2}`);

  let lineNum1 = 1;
  let lineNum2 = 1;

  for (const change of result.changes) {
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (change.added) {
      for (const line of lines) {
        output.push(`+${line}`);
        lineNum2++;
      }
    } else if (change.removed) {
      for (const line of lines) {
        output.push(`-${line}`);
        lineNum1++;
      }
    } else {
      for (const line of lines) {
        output.push(` ${line}`);
        lineNum1++;
        lineNum2++;
      }
    }
  }

  return output.join('\n');
}
