#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { AIFirewall, CheckResult, AnalyzeResult } from './core';

const program = new Command();
const firewall = new AIFirewall();

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

function formatCheckResult(result: CheckResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== AI Firewall Check Result ===\n'));

  const riskColors: Record<string, typeof chalk.red> = {
    critical: chalk.bgRed.white,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    safe: chalk.green
  };

  lines.push(`Status: ${result.allowed ? chalk.green('ALLOWED') : chalk.red('BLOCKED')}`);
  lines.push(`Risk Score: ${result.riskScore}/100`);
  lines.push(`Risk Level: ${riskColors[result.riskLevel](result.riskLevel.toUpperCase())}\n`);

  if (result.matches.length === 0) {
    lines.push(chalk.green('No security threats detected.\n'));
  } else {
    lines.push(chalk.bold(`Detected ${result.matches.length} security pattern(s):\n`));

    for (const match of result.matches) {
      const severityColor = match.severity === 'critical' ? chalk.bgRed.white :
        match.severity === 'high' ? chalk.red :
          match.severity === 'medium' ? chalk.yellow : chalk.blue;

      const actionIcon = match.action === 'block' ? chalk.red('BLOCK') :
        match.action === 'warn' ? chalk.yellow('WARN') : chalk.green('ALLOW');

      lines.push(`  ${severityColor(`[${match.severity.toUpperCase()}]`)} ${match.ruleName} (${match.ruleId})`);
      lines.push(`    Action: ${actionIcon} | Score: ${match.score}`);
      lines.push(`    Category: ${match.category}`);
      lines.push(`    Match: "${chalk.dim(match.matchedText)}"`);
      if (match.position.line) {
        lines.push(`    Location: Line ${match.position.line}, Column ${match.position.column}`);
      }
      lines.push('');
    }
  }

  lines.push(chalk.bold('Summary:'));
  lines.push(`  Total Matches: ${result.summary.totalMatches}`);
  lines.push(`  Blocked: ${result.summary.blockedCount}`);
  lines.push(`  Warnings: ${result.summary.warnCount}`);

  if (Object.keys(result.summary.byCategory).length > 0) {
    lines.push('\n  By Category:');
    for (const [cat, count] of Object.entries(result.summary.byCategory)) {
      lines.push(`    ${cat}: ${count}`);
    }
  }

  lines.push(chalk.bold('\nRecommendation:'));
  const recColor = result.allowed ? chalk.green : chalk.red;
  lines.push(`  ${recColor(result.recommendation)}`);

  return lines.join('\n');
}

function formatAnalyzeResult(result: AnalyzeResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== AI Firewall Analysis Report ===\n'));

  lines.push(`File: ${result.file}`);
  lines.push(`Total Lines: ${result.lines}\n`);

  const riskColors: Record<string, typeof chalk.red> = {
    critical: chalk.bgRed.white,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    safe: chalk.green
  };

  lines.push(`Overall Risk Score: ${result.overallRiskScore}/100`);
  lines.push(`Overall Risk Level: ${riskColors[result.overallRiskLevel](result.overallRiskLevel.toUpperCase())}\n`);

  lines.push(chalk.bold('Summary:'));
  lines.push(`  Flagged Lines: ${result.summary.flaggedLines}/${result.summary.totalLines}`);
  lines.push(`  Blocked Lines: ${result.summary.blockedLines}`);
  lines.push(`  Total Patterns Found: ${result.summary.totalMatches}\n`);

  if (result.checks.length > 0) {
    lines.push(chalk.bold('Flagged Lines:'));
    for (const check of result.checks.slice(0, 10)) {
      const statusIcon = check.allowed ? chalk.yellow('WARNING') : chalk.red('BLOCKED');
      lines.push(`\n  ${statusIcon} ${check.input}`);
      for (const match of check.matches.slice(0, 3)) {
        lines.push(`    - ${match.ruleName}: "${match.matchedText}"`);
      }
      if (check.matches.length > 3) {
        lines.push(`    ... and ${check.matches.length - 3} more`);
      }
    }
    if (result.checks.length > 10) {
      lines.push(`\n  ... and ${result.checks.length - 10} more flagged lines`);
    }
  } else {
    lines.push(chalk.green('No security threats detected in file.'));
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
  .name('ai-firewall')
  .description('Block prompt injection and jailbreak attempts')
  .version('1.0.0')
  .option('--json', 'Output in JSON format');

program
  .command('check [input]')
  .description('Check input for security threats')
  .option('--stdin', 'Read from stdin')
  .option('-s, --severity <level>', 'Minimum severity to report (low/medium/high/critical)')
  .action(async (input, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      let text: string;

      if (cmdOptions.stdin || !input) {
        if (process.stdin.isTTY && !input) {
          console.error(chalk.red('Error: Please provide input text or use --stdin'));
          process.exit(1);
        }
        text = await readStdin();
      } else {
        text = input;
      }

      const firewallOptions = {
        minSeverity: cmdOptions.severity as 'low' | 'medium' | 'high' | 'critical' | undefined
      };

      const result = firewall.check(text, firewallOptions);

      if (options.json) {
        output(result, options);
      } else {
        console.log(formatCheckResult(result));
      }

      // Exit with error code if blocked
      if (!result.allowed) {
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
  .command('analyze <file>')
  .description('Analyze a file for security threats')
  .option('-s, --severity <level>', 'Minimum severity to report (low/medium/high/critical)')
  .action((file, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      const firewallOptions = {
        minSeverity: cmdOptions.severity as 'low' | 'medium' | 'high' | 'critical' | undefined
      };

      const result = firewall.analyze(file, firewallOptions);

      if (options.json) {
        output(result, options);
      } else {
        console.log(formatAnalyzeResult(result));
      }

      // Exit with error code if any lines blocked
      if (result.summary.blockedLines > 0) {
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
  .command('rules')
  .description('List all security rules')
  .option('-c, --category <category>', 'Filter by category')
  .option('-s, --severity <severity>', 'Filter by severity')
  .action((cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      let rules = firewall.getRules();

      if (cmdOptions.category) {
        rules = rules.filter(r => r.category === cmdOptions.category);
      }
      if (cmdOptions.severity) {
        rules = rules.filter(r => r.severity === cmdOptions.severity);
      }

      if (options.json) {
        output(rules, options);
      } else {
        console.log(chalk.bold.blue('\n=== AI Firewall Security Rules ===\n'));

        const categories = [...new Set(rules.map(r => r.category))];
        for (const category of categories) {
          console.log(chalk.bold(`\n${category.toUpperCase()}:`));
          const catRules = rules.filter(r => r.category === category);
          for (const rule of catRules) {
            const severityColor = rule.severity === 'critical' ? chalk.bgRed.white :
              rule.severity === 'high' ? chalk.red :
                rule.severity === 'medium' ? chalk.yellow : chalk.blue;
            const actionColor = rule.action === 'block' ? chalk.red :
              rule.action === 'warn' ? chalk.yellow : chalk.green;

            console.log(`  ${chalk.bold(rule.id)} ${rule.name}`);
            console.log(`    Severity: ${severityColor(rule.severity)} | Action: ${actionColor(rule.action)} | Score: ${rule.score}`);
            console.log(`    ${chalk.dim(rule.description)}`);
          }
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
