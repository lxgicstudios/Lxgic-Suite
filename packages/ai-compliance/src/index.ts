#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
  scanFile,
  scanDirectory,
  generateReport,
  formatReport,
  formatViolation,
  calculateComplianceScore,
  getComplianceGrade,
} from './core';
import {
  ComplianceStandard,
  getAvailableStandards,
  getStandardInfo,
  getRulesByStandard,
} from './standards';

const program = new Command();

let jsonOutput = false;

function output(data: unknown, message?: string): void {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
  } else if (message) {
    console.log(message);
  } else {
    console.log(data);
  }
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(1);
}

program
  .name('ai-compliance')
  .description('Check AI usage against GDPR/CCPA/HIPAA compliance standards')
  .version('1.0.0')
  .option('--json', 'Output in JSON format')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('scan')
  .description('Scan a directory for compliance violations')
  .option('-s, --standard <standard>', 'Compliance standard (gdpr, ccpa, hipaa, all)', 'all')
  .option('-d, --directory <dir>', 'Directory to scan', '.')
  .option('-p, --patterns <patterns>', 'File patterns to scan (comma-separated)', '**/*.txt,**/*.md,**/*.json')
  .option('-o, --output <file>', 'Output report to file')
  .action(async (options) => {
    try {
      const standard = options.standard as ComplianceStandard;
      const patterns = options.patterns.split(',');

      if (!jsonOutput) {
        console.log(chalk.blue(`Scanning directory: ${options.directory}`));
        console.log(chalk.blue(`Standard: ${standard.toUpperCase()}`));
      }

      const results = await scanDirectory(options.directory, standard, patterns);
      const report = generateReport(results, standard);
      const score = calculateComplianceScore(report);
      const grade = getComplianceGrade(score);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const outputData = jsonOutput ? JSON.stringify(report, null, 2) : formatReport(report);
        fs.writeFileSync(outputPath, outputData);

        if (!jsonOutput) {
          console.log(chalk.green(`Report saved to: ${outputPath}`));
        }
      }

      if (jsonOutput) {
        output({ ...report, score, grade });
      } else {
        console.log(formatReport(report));
        console.log('');
        console.log(chalk.bold(`Compliance Score: ${score}/100 (Grade: ${grade})`));
      }

      // Exit with error code if critical violations found
      if (report.summary.bySeverity.critical > 0) {
        process.exit(1);
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('report')
  .description('Generate a compliance report for the current directory')
  .option('-s, --standard <standard>', 'Compliance standard (gdpr, ccpa, hipaa, all)', 'all')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .option('-o, --output <file>', 'Output report to file')
  .action(async (options) => {
    try {
      const standard = options.standard as ComplianceStandard;

      const results = await scanDirectory('.', standard);
      const report = generateReport(results, standard);
      const score = calculateComplianceScore(report);
      const grade = getComplianceGrade(score);

      const outputData = options.format === 'json' || jsonOutput
        ? JSON.stringify({ ...report, score, grade }, null, 2)
        : formatReport(report) + `\n\nCompliance Score: ${score}/100 (Grade: ${grade})`;

      if (options.output) {
        fs.writeFileSync(path.resolve(options.output), outputData);
        console.log(chalk.green(`Report saved to: ${options.output}`));
      } else {
        console.log(outputData);
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('check <file>')
  .description('Check a specific file for compliance violations')
  .option('-s, --standard <standard>', 'Compliance standard (gdpr, ccpa, hipaa, all)', 'all')
  .action((file, options) => {
    try {
      const standard = options.standard as ComplianceStandard;
      const result = scanFile(file, standard);

      if (jsonOutput) {
        const score = result.violations.length === 0 ? 100 : Math.max(0, 100 - result.violations.length * 10);
        output({ ...result, score, passed: result.violations.length === 0 });
      } else {
        console.log(chalk.bold(`\nCompliance Check: ${file}`));
        console.log(`Standard: ${standard.toUpperCase()}`);
        console.log('');

        if (result.violations.length === 0) {
          console.log(chalk.green('No violations found.'));
        } else {
          console.log(chalk.red(`Found ${result.violations.length} violation(s):\n`));

          for (const violation of result.violations) {
            const severityColor =
              violation.severity === 'critical' ? chalk.red :
              violation.severity === 'high' ? chalk.yellow :
              violation.severity === 'medium' ? chalk.cyan : chalk.white;

            console.log(severityColor(`[${violation.severity.toUpperCase()}] ${violation.ruleId}: ${violation.ruleName}`));
            console.log(`  Line ${violation.line}, Column ${violation.column}`);
            console.log(`  Match: "${violation.match}"`);
            console.log(`  Context: ${violation.context}`);
            console.log(chalk.blue(`  Recommendation: ${violation.recommendation}`));
            console.log('');
          }
        }
      }

      // Exit with error code if violations found
      if (result.violations.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('standards')
  .description('List available compliance standards and rules')
  .option('-s, --standard <standard>', 'Show rules for a specific standard')
  .action((options) => {
    try {
      const standards = getAvailableStandards();

      if (options.standard) {
        const standard = options.standard as ComplianceStandard;
        const info = getStandardInfo(standard);
        const rules = getRulesByStandard(standard);

        if (jsonOutput) {
          output({ standard: info, rules });
        } else {
          console.log(chalk.bold(`\n${info.name} (${options.standard.toUpperCase()})`));
          console.log(info.description);
          console.log(`\nRules (${rules.length}):\n`);

          for (const rule of rules) {
            const severityColor =
              rule.severity === 'critical' ? chalk.red :
              rule.severity === 'high' ? chalk.yellow :
              rule.severity === 'medium' ? chalk.cyan : chalk.white;

            console.log(`  ${rule.id} - ${rule.name}`);
            console.log(`    Severity: ${severityColor(rule.severity)}`);
            console.log(`    ${rule.description}`);
            console.log('');
          }
        }
      } else {
        if (jsonOutput) {
          const allInfo = standards.map(s => ({
            id: s,
            ...getStandardInfo(s as ComplianceStandard),
          }));
          output({ standards: allInfo });
        } else {
          console.log(chalk.bold('\nAvailable Compliance Standards:\n'));

          for (const standard of standards) {
            if (standard === 'all') continue;
            const info = getStandardInfo(standard as ComplianceStandard);
            console.log(`  ${chalk.cyan(standard.toUpperCase())} - ${info.name}`);
            console.log(`    ${info.description}`);
            console.log(`    Rules: ${info.ruleCount}`);
            console.log('');
          }

          console.log(chalk.gray('Use --standard <name> to see rules for a specific standard'));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
