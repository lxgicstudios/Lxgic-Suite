#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { PolicyValidator, ValidationResult } from './core';

const program = new Command();
const validator = new PolicyValidator();

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

function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== Prompt Policy Validation ===\n'));

  if (result.file) {
    lines.push(`File: ${result.file}`);
  }
  lines.push(`Policy: ${result.policy}`);
  lines.push(`Status: ${result.valid ? chalk.green('VALID') : chalk.red('INVALID')}\n`);

  lines.push(chalk.bold('Metrics:'));
  lines.push(`  Token Count: ${result.metrics.tokenCount}`);
  lines.push(`  Line Count: ${result.metrics.lineCount}`);
  lines.push(`  Character Count: ${result.metrics.charCount}`);
  lines.push(`  Avg Line Length: ${result.metrics.avgLineLength}\n`);

  lines.push(chalk.bold('Summary:'));
  lines.push(`  Total Violations: ${result.summary.totalViolations}`);
  lines.push(`  Errors: ${chalk.red(result.summary.errors.toString())}`);
  lines.push(`  Warnings: ${chalk.yellow(result.summary.warnings.toString())}`);
  lines.push(`  Info: ${chalk.blue(result.summary.info.toString())}\n`);

  if (result.violations.length > 0) {
    lines.push(chalk.bold('Violations:'));
    for (const violation of result.violations) {
      const severityIcon = violation.severity === 'error' ? chalk.red('ERROR') :
        violation.severity === 'warning' ? chalk.yellow('WARN') :
          chalk.blue('INFO');

      lines.push(`\n  ${severityIcon} [${violation.ruleId}] ${violation.ruleName}`);
      lines.push(`    ${violation.message}`);
      if (violation.location) {
        lines.push(`    Location: Line ${violation.location.line}${violation.location.column ? `, Column ${violation.location.column}` : ''}`);
      }
      if (violation.matchedText) {
        lines.push(`    Matched: "${chalk.dim(violation.matchedText)}"`);
      }
    }
  } else {
    lines.push(chalk.green('No violations found.'));
  }

  return lines.join('\n');
}

program
  .name('prompt-policy')
  .description('Enforce organizational prompt policies')
  .version('1.0.0')
  .option('--json', 'Output in JSON format');

program
  .command('validate <file>')
  .description('Validate a prompt file against a policy')
  .option('-p, --policy <name>', 'Policy to use (strict/moderate/permissive)', 'moderate')
  .option('-c, --config <path>', 'Path to custom policy config file')
  .option('--ci', 'CI mode - exit with error code on violations')
  .action((file, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      let customPolicy;
      if (cmdOptions.config) {
        if (!fs.existsSync(cmdOptions.config)) {
          throw new Error(`Config file not found: ${cmdOptions.config}`);
        }
        customPolicy = validator.loadCustomPolicy(cmdOptions.config);
      }

      const result = validator.validateFile(file, cmdOptions.policy, customPolicy);

      if (options.json) {
        output(result, options);
      } else {
        console.log(formatValidationResult(result));
      }

      // Exit with error in CI mode if not valid
      if ((cmdOptions.ci || process.env.CI) && !result.valid) {
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
  .command('init')
  .description('Initialize a policy configuration file')
  .option('-d, --directory <path>', 'Directory to create config in', process.cwd())
  .action((cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      const result = validator.init(cmdOptions.directory);

      if (options.json) {
        output(result, options);
      } else {
        console.log(chalk.green('Policy configuration initialized successfully!'));
        console.log(`Config file created at: ${result.path}`);
        console.log('\nYou can customize the policy by editing the .prompt-policy.json file.');
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
  .command('list-policies')
  .description('List available policies')
  .action(() => {
    const options = program.opts<GlobalOptions>();

    try {
      const policies = validator.listPolicies();

      if (options.json) {
        output(policies, options);
      } else {
        console.log(chalk.bold.blue('\n=== Available Policies ===\n'));
        for (const policy of policies) {
          console.log(chalk.bold(`${policy.name}`));
          console.log(`  ${chalk.dim(policy.description)}`);
          console.log(`  Rules: ${policy.ruleCount}\n`);
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

program
  .command('show-policy <name>')
  .description('Show details of a specific policy')
  .action((name) => {
    const options = program.opts<GlobalOptions>();

    try {
      const policy = validator.getPolicyDetails(name);

      if (!policy) {
        throw new Error(`Unknown policy: ${name}. Use 'list-policies' to see available policies.`);
      }

      if (options.json) {
        output(policy, options);
      } else {
        console.log(chalk.bold.blue(`\n=== Policy: ${policy.name} ===\n`));
        console.log(`Description: ${policy.description}`);
        console.log(`Version: ${policy.version}\n`);

        console.log(chalk.bold('Rules:'));
        for (const rule of policy.rules) {
          const severityColor = rule.severity === 'error' ? chalk.red :
            rule.severity === 'warning' ? chalk.yellow : chalk.blue;
          const enabledIcon = rule.enabled ? chalk.green('ON') : chalk.gray('OFF');

          console.log(`\n  ${chalk.bold(rule.id)} ${rule.name} ${enabledIcon}`);
          console.log(`    Type: ${rule.type}`);
          console.log(`    Severity: ${severityColor(rule.severity)}`);
          console.log(`    Value: ${JSON.stringify(rule.value)}`);
          console.log(`    ${chalk.dim(rule.description)}`);
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

program
  .command('check-text <text>')
  .description('Validate text directly (not from file)')
  .option('-p, --policy <name>', 'Policy to use (strict/moderate/permissive)', 'moderate')
  .action((text, cmdOptions) => {
    const options = program.opts<GlobalOptions>();

    try {
      const result = validator.validate(text, cmdOptions.policy);

      if (options.json) {
        output(result, options);
      } else {
        console.log(formatValidationResult(result));
      }

      if (!result.valid) {
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

program.parse();
