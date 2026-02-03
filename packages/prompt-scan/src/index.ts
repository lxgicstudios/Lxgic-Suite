#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scanPrompt, scanDirectory, scanCode, generateReport, ScanResult } from './core.js';
import * as fs from 'fs';

const program = new Command();

program
  .name('prompt-scan')
  .version('1.0.0')
  .description('Scan for prompt injection vulnerabilities')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('check <file>')
  .description('Check a prompt file for injection vulnerabilities')
  .option('--strict', 'Enable strict mode with more rules')
  .action(async (file, options) => {
    const spinner = ora('Scanning prompt...').start();
    try {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      const content = fs.readFileSync(file, 'utf-8');
      const result = await scanPrompt(content, options.strict);

      spinner.stop();

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        printScanResult(result);
      }

      if (result.vulnerabilities.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('scan <directory>')
  .description('Scan a directory for vulnerable prompts')
  .option('--pattern <glob>', 'File pattern to match', '**/*.{txt,md,prompt}')
  .option('--strict', 'Enable strict mode')
  .action(async (directory, options) => {
    const spinner = ora('Scanning directory...').start();
    try {
      const results = await scanDirectory(directory, options.pattern, options.strict);
      spinner.stop();

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, results }, null, 2));
      } else {
        console.log(chalk.bold(`\nScanned ${results.filesScanned} files\n`));

        if (results.vulnerabilities.length === 0) {
          console.log(chalk.green('✓ No vulnerabilities found'));
        } else {
          console.log(chalk.red(`✗ Found ${results.vulnerabilities.length} vulnerabilities:\n`));
          for (const vuln of results.vulnerabilities) {
            console.log(`${chalk.yellow(vuln.file)}:`);
            console.log(`  ${chalk.red(vuln.type)}: ${vuln.description}`);
            if (vuln.line) console.log(chalk.gray(`  Line ${vuln.line}`));
          }
        }
      }

      if (results.vulnerabilities.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('code <directory>')
  .description('Scan code for vulnerable prompt construction')
  .option('--language <lang>', 'Programming language (js, ts, py)', 'ts')
  .action(async (directory, options) => {
    const spinner = ora('Scanning code...').start();
    try {
      const results = await scanCode(directory, options.language);
      spinner.stop();

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, results }, null, 2));
      } else {
        console.log(chalk.bold(`\nScanned ${results.filesScanned} code files\n`));

        if (results.risks.length === 0) {
          console.log(chalk.green('✓ No risky prompt construction found'));
        } else {
          console.log(chalk.yellow(`Found ${results.risks.length} potential risks:\n`));
          for (const risk of results.risks) {
            const severity = risk.severity === 'high' ? chalk.red : risk.severity === 'medium' ? chalk.yellow : chalk.gray;
            console.log(`${severity(risk.severity.toUpperCase())} ${chalk.blue(risk.file)}:${risk.line}`);
            console.log(`  ${risk.description}`);
            console.log(chalk.gray(`  ${risk.code}`));
            console.log();
          }
        }
      }

      const highRisks = results.risks.filter(r => r.severity === 'high');
      if (highRisks.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate a security scan report')
  .option('--output <file>', 'Output file')
  .option('--format <format>', 'Report format (text, json, html)', 'text')
  .action(async (options) => {
    const spinner = ora('Generating report...').start();
    try {
      const report = await generateReport(options.format);
      spinner.succeed('Report generated');

      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(chalk.green(`Report saved to ${options.output}`));
      } else {
        console.log(report);
      }
    } catch (error) {
      spinner.fail('Failed to generate report');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

function printScanResult(result: ScanResult): void {
  console.log(chalk.bold('\nSecurity Scan Results'));
  console.log('─'.repeat(50));
  console.log(`Score: ${getScoreColor(result.score)}${result.score}/100${chalk.reset()}`);
  console.log();

  if (result.vulnerabilities.length === 0) {
    console.log(chalk.green('✓ No vulnerabilities detected'));
  } else {
    console.log(chalk.red(`Found ${result.vulnerabilities.length} vulnerabilities:\n`));
    for (const vuln of result.vulnerabilities) {
      const severity = vuln.severity === 'critical' ? chalk.red :
                       vuln.severity === 'high' ? chalk.yellow :
                       vuln.severity === 'medium' ? chalk.blue : chalk.gray;
      console.log(`${severity('●')} ${vuln.type}`);
      console.log(chalk.gray(`  ${vuln.description}`));
      if (vuln.recommendation) {
        console.log(chalk.green(`  → ${vuln.recommendation}`));
      }
      console.log();
    }
  }

  if (result.recommendations.length > 0) {
    console.log(chalk.bold('Recommendations:'));
    for (const rec of result.recommendations) {
      console.log(chalk.blue(`  • ${rec}`));
    }
  }
}

function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return (t: string) => chalk.green.bold(t);
  if (score >= 70) return (t: string) => chalk.yellow(t);
  if (score >= 50) return (t: string) => chalk.rgb(255, 165, 0)(t);
  return (t: string) => chalk.red(t);
}

program.parse();
