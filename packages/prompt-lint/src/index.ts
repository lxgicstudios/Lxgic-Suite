#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import {
  PromptLinter,
  LintConfig,
  LintReport,
  formatReport,
  formatReportJson,
  parsePromptFile,
  combineReports,
} from './core.js';
import { DEFAULT_RULES, getRuleIds, Severity } from './rules.js';

const program = new Command();

// Package info
const VERSION = '1.0.0';

program
  .name('prompt-lint')
  .description('Lint prompts for best practices and anti-patterns')
  .version(VERSION);

// Lint command
program
  .command('lint')
  .description('Lint prompt files or stdin for best practices')
  .argument('[files...]', 'Files or glob patterns to lint')
  .option('--stdin', 'Read prompt from stdin')
  .option('-j, --json', 'Output results as JSON')
  .option('-s, --severity <level>', 'Minimum severity to report (error, warning, info)', 'info')
  .option('-e, --enable <rules>', 'Comma-separated list of rules to enable')
  .option('-d, --disable <rules>', 'Comma-separated list of rules to disable')
  .option('--no-color', 'Disable colored output')
  .option('-q, --quiet', 'Only output errors and warnings')
  .addHelpText('after', `
Examples:
  $ prompt-lint lint prompt.txt
  $ prompt-lint lint "prompts/**/*.txt"
  $ prompt-lint lint --stdin < prompt.txt
  $ prompt-lint lint prompt.txt --json
  $ prompt-lint lint prompt.txt --severity warning
  $ prompt-lint lint prompt.txt --enable prompt-length-min,clarity-vague-words
  $ prompt-lint lint prompt.txt --disable role-definition

Available Rules:
${DEFAULT_RULES.map(r => `  ${r.id} (${r.severity}): ${r.description}`).join('\n')}
`)
  .action(async (files: string[], options) => {
    const config: LintConfig = {
      minSeverity: options.severity as Severity,
    };

    if (options.enable) {
      config.enabledRules = options.enable.split(',').map((s: string) => s.trim());
    }

    if (options.disable) {
      config.disabledRules = options.disable.split(',').map((s: string) => s.trim());
    }

    if (options.quiet) {
      config.minSeverity = 'warning';
    }

    const linter = new PromptLinter(config);
    const reports: LintReport[] = [];

    try {
      if (options.stdin) {
        // Read from stdin
        const spinner = ora('Reading from stdin...').start();
        const input = await readStdin();
        spinner.stop();

        if (!input.trim()) {
          console.error(chalk.red('Error: No input received from stdin'));
          process.exit(1);
        }

        const report = linter.lint(input.trim());
        reports.push(report);
      } else if (files.length > 0) {
        // Lint files
        const spinner = ora('Finding files...').start();
        const allFiles: string[] = [];

        for (const pattern of files) {
          // Check if it's a glob pattern or a direct file
          if (pattern.includes('*')) {
            const matches = await glob(pattern, { nodir: true });
            allFiles.push(...matches);
          } else {
            allFiles.push(pattern);
          }
        }

        if (allFiles.length === 0) {
          spinner.fail('No files found matching the patterns');
          process.exit(1);
        }

        spinner.text = `Linting ${allFiles.length} file(s)...`;

        for (const filePath of allFiles) {
          try {
            const absolutePath = path.resolve(filePath);
            const content = await fs.readFile(absolutePath, 'utf-8');
            const prompts = parsePromptFile(content, filePath);

            for (let i = 0; i < prompts.length; i++) {
              const reportPath = prompts.length > 1 ? `${filePath}#${i + 1}` : filePath;
              const report = linter.lint(prompts[i], reportPath);
              reports.push(report);
            }
          } catch (error) {
            reports.push({
              prompt: '',
              filePath,
              results: [{
                ruleId: 'file-read-error',
                ruleName: 'File Read Error',
                severity: 'error',
                violations: [{
                  message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
                }],
              }],
              summary: { totalViolations: 1, errors: 1, warnings: 0, infos: 0 },
              passed: false,
            });
          }
        }

        spinner.succeed(`Linted ${allFiles.length} file(s)`);
      } else {
        // No files and no stdin flag
        program.commands.find(c => c.name() === 'lint')?.help();
        process.exit(1);
      }

      // Output results
      if (options.json) {
        const combined = combineReports(reports);
        console.log(JSON.stringify(combined, null, 2));
      } else {
        for (const report of reports) {
          console.log(formatReport(report, options.color !== false));
        }

        if (reports.length > 1) {
          const combined = combineReports(reports);
          console.log('\n' + '═'.repeat(50));
          console.log(chalk.bold('Overall Summary'));
          console.log('═'.repeat(50));
          console.log(`Files: ${combined.totalSummary.passedFiles} passed, ${combined.totalSummary.failedFiles} failed`);
          console.log(`Issues: ${combined.totalSummary.errors} error(s), ${combined.totalSummary.warnings} warning(s), ${combined.totalSummary.infos} info(s)`);
        }
      }

      // Exit with appropriate code
      const hasErrors = reports.some(r => !r.passed);
      process.exit(hasErrors ? 1 : 0);

    } catch (error) {
      if (!options.json) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      } else {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      process.exit(1);
    }
  });

// Rules command to list available rules
program
  .command('rules')
  .description('List all available linting rules')
  .option('-j, --json', 'Output as JSON')
  .action((options) => {
    if (options.json) {
      console.log(JSON.stringify(DEFAULT_RULES.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        severity: r.severity,
      })), null, 2));
    } else {
      console.log(chalk.bold('\nAvailable Linting Rules:\n'));

      const byCategory: Record<Severity, typeof DEFAULT_RULES> = {
        error: [],
        warning: [],
        info: [],
      };

      for (const rule of DEFAULT_RULES) {
        byCategory[rule.severity].push(rule);
      }

      for (const severity of ['error', 'warning', 'info'] as Severity[]) {
        const rules = byCategory[severity];
        if (rules.length === 0) continue;

        const colorFn = severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.blue;
        console.log(colorFn.bold(`[${severity.toUpperCase()}] Rules:`));

        for (const rule of rules) {
          console.log(`  ${chalk.cyan(rule.id)}`);
          console.log(`    ${rule.name}`);
          console.log(`    ${chalk.dim(rule.description)}\n`);
        }
      }
    }
  });

// Check command (alias for lint with error-only severity)
program
  .command('check')
  .description('Quick check for critical issues only (errors)')
  .argument('[files...]', 'Files or glob patterns to check')
  .option('--stdin', 'Read prompt from stdin')
  .option('-j, --json', 'Output results as JSON')
  .action(async (files: string[], options) => {
    // Delegate to lint with error severity
    const lintCmd = program.commands.find(c => c.name() === 'lint');
    if (lintCmd) {
      await lintCmd.parseAsync([...files, '--severity', 'error', ...(options.stdin ? ['--stdin'] : []), ...(options.json ? ['--json'] : [])], { from: 'user' });
    }
  });

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', () => {
      resolve('');
    });

    // Timeout after 5 seconds if no input
    setTimeout(() => {
      if (!data) {
        resolve('');
      }
    }, 5000);
  });
}

// Parse and execute
program.parse();
