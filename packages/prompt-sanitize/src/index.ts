#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { PromptSanitizer, RedactionResult, ScanResult } from './core';

const program = new Command();
const sanitizer = new PromptSanitizer();

interface GlobalOptions {
  json?: boolean;
}

function output(data: unknown, options: GlobalOptions): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(data);
  }
}

function formatRedactionResult(result: RedactionResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== Sanitization Result ===\n'));

  if (result.redactions.length === 0) {
    lines.push(chalk.green('No sensitive data detected.\n'));
    lines.push(chalk.bold('Output:'));
    lines.push(result.sanitized);
    return lines.join('\n');
  }

  const riskColors: Record<string, typeof chalk.red> = {
    critical: chalk.bgRed.white,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    none: chalk.green
  };

  lines.push(`Risk Level: ${riskColors[result.summary.riskLevel](result.summary.riskLevel.toUpperCase())}`);
  lines.push(`Total Redactions: ${result.summary.totalRedactions}\n`);

  lines.push(chalk.bold('Redactions by Type:'));
  for (const [type, count] of Object.entries(result.summary.byType)) {
    lines.push(`  ${type}: ${count}`);
  }

  lines.push(chalk.bold('\nRedactions by Category:'));
  for (const [category, count] of Object.entries(result.summary.byCategory)) {
    lines.push(`  ${category}: ${count}`);
  }

  lines.push(chalk.bold('\nDetailed Redactions:'));
  for (const redaction of result.redactions.slice(0, 10)) {
    const sensitivityColor = redaction.sensitivity === 'high' ? chalk.red :
      redaction.sensitivity === 'medium' ? chalk.yellow : chalk.blue;
    lines.push(`  ${sensitivityColor('[' + redaction.sensitivity.toUpperCase() + ']')} ${redaction.type}: "${redaction.original}" -> "${redaction.replacement}"`);
  }
  if (result.redactions.length > 10) {
    lines.push(`  ... and ${result.redactions.length - 10} more`);
  }

  lines.push(chalk.bold('\n--- Sanitized Output ---'));
  lines.push(result.sanitized);

  return lines.join('\n');
}

function formatScanResult(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== Scan Result ===\n'));

  if (result.file) {
    lines.push(`File: ${result.file}\n`);
  }

  if (result.detections.length === 0) {
    lines.push(chalk.green('No sensitive data detected.'));
    return lines.join('\n');
  }

  const riskColors: Record<string, typeof chalk.red> = {
    critical: chalk.bgRed.white,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    none: chalk.green
  };

  lines.push(`Risk Level: ${riskColors[result.summary.riskLevel](result.summary.riskLevel.toUpperCase())}`);
  lines.push(`Total Detections: ${result.summary.totalDetections}\n`);

  lines.push(chalk.bold('Detections by Type:'));
  for (const [type, count] of Object.entries(result.summary.byType)) {
    lines.push(`  ${type}: ${count}`);
  }

  lines.push(chalk.bold('\nDetailed Detections:'));
  for (const detection of result.detections.slice(0, 15)) {
    const sensitivityColor = detection.sensitivity === 'high' ? chalk.red :
      detection.sensitivity === 'medium' ? chalk.yellow : chalk.blue;
    const location = detection.position.line ?
      `Line ${detection.position.line}, Col ${detection.position.column}` :
      `Position ${detection.position.start}`;
    lines.push(`  ${sensitivityColor('[' + detection.sensitivity.toUpperCase() + ']')} ${detection.type} at ${location}`);
    lines.push(`    Value: ${chalk.dim(detection.value)}`);
    if (detection.context) {
      lines.push(`    Context: ${detection.context}`);
    }
  }
  if (result.detections.length > 15) {
    lines.push(`  ... and ${result.detections.length - 15} more`);
  }

  return lines.join('\n');
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

program
  .name('prompt-sanitize')
  .description('Strip PII/PHI from prompts before sending')
  .version('1.0.0')
  .option('--json', 'Output in JSON format');

program
  .command('clean [file]')
  .description('Clean/sanitize a file or stdin')
  .option('--stdin', 'Read from stdin')
  .option('-p, --patterns <patterns>', 'Comma-separated list of patterns to use')
  .option('-e, --exclude <patterns>', 'Comma-separated list of patterns to exclude')
  .option('-o, --output <file>', 'Write sanitized output to file')
  .action(async (file, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      let content: string;

      if (cmdOptions.stdin || !file) {
        if (process.stdin.isTTY && !file) {
          console.error(chalk.red('Error: Please provide a file path or use --stdin'));
          process.exit(1);
        }
        content = await readStdin();
      } else {
        if (!fs.existsSync(file)) {
          throw new Error(`File not found: ${file}`);
        }
        content = fs.readFileSync(file, 'utf-8');
      }

      const sanitizeOptions = {
        patterns: cmdOptions.patterns ? cmdOptions.patterns.split(',') : undefined,
        excludePatterns: cmdOptions.exclude ? cmdOptions.exclude.split(',') : undefined
      };

      const result = sanitizer.sanitize(content, sanitizeOptions);

      if (cmdOptions.output) {
        fs.writeFileSync(cmdOptions.output, result.sanitized);
        if (options.json) {
          output({ success: true, outputFile: cmdOptions.output, summary: result.summary }, options);
        } else {
          console.log(chalk.green(`Sanitized output written to ${cmdOptions.output}`));
          console.log(`Redactions: ${result.summary.totalRedactions}`);
        }
      } else if (options.json) {
        output(result, options);
      } else {
        console.log(formatRedactionResult(result));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (options.json) {
        output({ success: false, error: message }, options);
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

program
  .command('scan <file>')
  .description('Scan a file for sensitive data without modifying')
  .option('-p, --patterns <patterns>', 'Comma-separated list of patterns to use')
  .option('-e, --exclude <patterns>', 'Comma-separated list of patterns to exclude')
  .option('-c, --context', 'Show surrounding context for detections')
  .action((file, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      const scanOptions = {
        patterns: cmdOptions.patterns ? cmdOptions.patterns.split(',') : undefined,
        excludePatterns: cmdOptions.exclude ? cmdOptions.exclude.split(',') : undefined,
        showContext: cmdOptions.context
      };

      const result = sanitizer.scanFile(file, scanOptions);

      if (options.json) {
        output(result, options);
      } else {
        console.log(formatScanResult(result));
      }

      // Exit with error code if sensitive data found
      if (result.summary.riskLevel === 'high' || result.summary.riskLevel === 'critical') {
        process.exit(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (options.json) {
        output({ success: false, error: message }, options);
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

program
  .command('patterns')
  .description('List available patterns')
  .option('-c, --category <category>', 'Filter by category (pii, phi, financial)')
  .action((cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      let patterns = sanitizer.getAvailablePatterns();

      if (cmdOptions.category) {
        patterns = patterns.filter(p => p.category === cmdOptions.category);
      }

      if (options.json) {
        output(patterns, options);
      } else {
        console.log(chalk.bold.blue('\n=== Available Patterns ===\n'));
        for (const pattern of patterns) {
          const sensitivityColor = pattern.sensitivity === 'high' ? chalk.red :
            pattern.sensitivity === 'medium' ? chalk.yellow : chalk.blue;
          console.log(`${chalk.bold(pattern.name)} ${sensitivityColor('[' + pattern.sensitivity + ']')} (${pattern.category})`);
          console.log(`  ${chalk.dim(pattern.description)}\n`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (options.json) {
        output({ success: false, error: message }, options);
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

program.parse();
