#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { AIRedactor, RedactResult } from './core';

const program = new Command();
const redactor = new AIRedactor();

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

function formatRedactResult(result: RedactResult & { file?: string }): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== AI Redaction Result ===\n'));

  if (result.file) {
    lines.push(`File: ${result.file}`);
  }

  if (result.redactions.length === 0) {
    lines.push(chalk.green('No sensitive data found to redact.\n'));
    lines.push(chalk.bold('Output:'));
    lines.push(result.redacted);
    return lines.join('\n');
  }

  lines.push(chalk.bold('\nSummary:'));
  lines.push(`  Total Redactions: ${result.summary.totalRedactions}`);
  lines.push(`  Characters Redacted: ${result.summary.charactersRedacted}`);

  lines.push(chalk.bold('\nRedactions by Pattern:'));
  for (const [pattern, count] of Object.entries(result.summary.byPattern)) {
    lines.push(`  ${pattern}: ${count}`);
  }

  lines.push(chalk.bold('\nRedactions by Category:'));
  for (const [category, count] of Object.entries(result.summary.byCategory)) {
    const categoryColor = category === 'pii' ? chalk.red :
      category === 'phi' ? chalk.magenta :
        category === 'financial' ? chalk.yellow :
          category === 'technical' ? chalk.blue : chalk.gray;
    lines.push(`  ${categoryColor(category)}: ${count}`);
  }

  lines.push(chalk.bold('\nDetailed Redactions:'));
  for (const redaction of result.redactions.slice(0, 15)) {
    const categoryColor = redaction.category === 'pii' ? chalk.red :
      redaction.category === 'phi' ? chalk.magenta :
        redaction.category === 'financial' ? chalk.yellow :
          redaction.category === 'technical' ? chalk.blue : chalk.gray;

    lines.push(`  ${categoryColor(`[${redaction.patternName}]`)} "${redaction.original}" -> "${redaction.replacement}"`);
    if (redaction.position.line) {
      lines.push(`    Location: Line ${redaction.position.line}, Column ${redaction.position.column}`);
    }
  }
  if (result.redactions.length > 15) {
    lines.push(`  ... and ${result.redactions.length - 15} more`);
  }

  lines.push(chalk.bold('\n--- Redacted Output ---'));
  lines.push(result.redacted);

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
  .name('ai-redact')
  .description('Redact sensitive data from AI outputs')
  .version('1.0.0')
  .option('--json', 'Output in JSON format');

program
  .command('redact [file]')
  .description('Redact sensitive data from a file or stdin')
  .option('--stdin', 'Read from stdin')
  .option('-p, --patterns <patterns>', 'Comma-separated list of patterns (ssn,email,phone,credit_card,ip,etc.)')
  .option('-o, --output <file>', 'Output file path')
  .option('--show-length', 'Show original length of redacted content')
  .option('--preview', 'Preview redactions without applying')
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

      const redactOptions = {
        patterns: cmdOptions.patterns ? cmdOptions.patterns.split(',') : undefined,
        showOriginalLength: cmdOptions.showLength
      };

      if (cmdOptions.preview) {
        const preview = redactor.previewRedactions(content, redactOptions);
        if (options.json) {
          output(preview, options);
        } else {
          console.log(chalk.bold.blue('\n=== Redaction Preview ===\n'));
          if (preview.length === 0) {
            console.log(chalk.green('No sensitive data found.'));
          } else {
            for (const item of preview) {
              console.log(`[${item.pattern}] Line ${item.line}: "${item.original}" -> "${item.replacement}"`);
            }
            console.log(chalk.gray(`\nTotal: ${preview.length} redactions will be applied`));
          }
        }
        return;
      }

      const result = redactor.redact(content, redactOptions);

      if (cmdOptions.output) {
        fs.writeFileSync(cmdOptions.output, result.redacted);
        if (options.json) {
          output({
            success: true,
            outputFile: cmdOptions.output,
            summary: result.summary
          }, options);
        } else {
          console.log(chalk.green(`Redacted output written to ${cmdOptions.output}`));
          console.log(`Total redactions: ${result.summary.totalRedactions}`);
          console.log(`Characters redacted: ${result.summary.charactersRedacted}`);
        }
      } else if (options.json) {
        output(result, options);
      } else {
        console.log(formatRedactResult(result));
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
  .description('List available redaction patterns')
  .option('-c, --category <category>', 'Filter by category (pii, phi, financial, technical)')
  .action((cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      let patterns = redactor.getAvailablePatterns();

      if (cmdOptions.category) {
        patterns = patterns.filter(p => p.category === cmdOptions.category);
      }

      if (options.json) {
        output(patterns, options);
      } else {
        console.log(chalk.bold.blue('\n=== Available Redaction Patterns ===\n'));

        const categories = [...new Set(patterns.map(p => p.category))];
        for (const category of categories) {
          const categoryColor = category === 'pii' ? chalk.red :
            category === 'phi' ? chalk.magenta :
              category === 'financial' ? chalk.yellow :
                category === 'technical' ? chalk.blue : chalk.gray;

          console.log(categoryColor.bold(`\n${category.toUpperCase()}:`));
          const catPatterns = patterns.filter(p => p.category === category);
          for (const pattern of catPatterns) {
            console.log(`  ${chalk.bold(pattern.name)}`);
            console.log(`    ${chalk.dim(pattern.description)}`);
          }
        }

        console.log(chalk.gray('\nUsage: ai-redact redact file.txt --patterns ssn,email,phone'));
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
  .command('batch <directory>')
  .description('Redact all files in a directory')
  .option('-p, --patterns <patterns>', 'Comma-separated list of patterns')
  .option('-e, --extension <ext>', 'File extension to process (default: .txt)', '.txt')
  .option('-o, --output-dir <dir>', 'Output directory for redacted files')
  .action((directory, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      if (!fs.existsSync(directory)) {
        throw new Error(`Directory not found: ${directory}`);
      }

      const files = fs.readdirSync(directory)
        .filter(f => f.endsWith(cmdOptions.extension || '.txt'));

      const results: Array<{
        file: string;
        redactions: number;
        success: boolean;
      }> = [];

      const outputDir = cmdOptions.outputDir || directory;
      if (cmdOptions.outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      for (const file of files) {
        const inputPath = `${directory}/${file}`;
        const outputPath = cmdOptions.outputDir
          ? `${outputDir}/${file.replace(cmdOptions.extension, '.redacted' + cmdOptions.extension)}`
          : inputPath.replace(cmdOptions.extension, '.redacted' + cmdOptions.extension);

        try {
          const content = fs.readFileSync(inputPath, 'utf-8');
          const result = redactor.redact(content, {
            patterns: cmdOptions.patterns ? cmdOptions.patterns.split(',') : undefined
          });
          fs.writeFileSync(outputPath, result.redacted);
          results.push({
            file: inputPath,
            redactions: result.summary.totalRedactions,
            success: true
          });
        } catch (err) {
          results.push({
            file: inputPath,
            redactions: 0,
            success: false
          });
        }
      }

      if (options.json) {
        output({
          success: true,
          totalFiles: files.length,
          results
        }, options);
      } else {
        console.log(chalk.bold.blue('\n=== Batch Redaction Results ===\n'));
        console.log(`Processed ${files.length} files\n`);
        for (const r of results) {
          const icon = r.success ? chalk.green('SUCCESS') : chalk.red('FAILED');
          console.log(`  ${icon} ${r.file} - ${r.redactions} redactions`);
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
