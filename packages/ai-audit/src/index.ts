#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { AuditCore } from './core';

const program = new Command();
const core = new AuditCore();

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

function formatReport(report: ReturnType<AuditCore['generateReport']>): string {
  const lines: string[] = [];

  lines.push(chalk.bold.blue('\n=== AI Audit Compliance Report ===\n'));
  lines.push(chalk.gray(`Report ID: ${report.reportId}`));
  lines.push(chalk.gray(`Generated: ${report.generatedAt}`));
  lines.push(chalk.gray(`Period: ${report.period.type} (${report.period.start} to ${report.period.end})\n`));

  lines.push(chalk.bold('Summary:'));
  lines.push(`  Total Interactions: ${report.summary.totalInteractions}`);
  lines.push(`  Success Rate: ${report.summary.successRate}%`);
  lines.push(`  Unique Users: ${report.summary.uniqueUsers}`);
  lines.push(`  Avg Response Time: ${report.summary.averageResponseTime}ms`);
  lines.push(`  Total Tokens Used: ${report.summary.totalTokensUsed}\n`);

  lines.push(chalk.bold('SOC2 Compliance:'));
  const soc2 = report.compliance.soc2;
  lines.push(`  Access Controls Logged: ${soc2.accessControlsLogged ? chalk.green('PASS') : chalk.red('FAIL')}`);
  lines.push(`  Data Integrity Maintained: ${soc2.dataIntegrityMaintained ? chalk.green('PASS') : chalk.red('FAIL')}`);
  lines.push(`  Audit Trail Complete: ${soc2.auditTrailComplete ? chalk.green('PASS') : chalk.red('FAIL')}`);
  lines.push(`  Security Events Recorded: ${soc2.securityEventsRecorded ? chalk.green('PASS') : chalk.red('FAIL')}\n`);

  lines.push(chalk.bold('HIPAA Compliance:'));
  const hipaa = report.compliance.hipaa;
  lines.push(`  Access Logs Available: ${hipaa.accessLogsAvailable ? chalk.green('PASS') : chalk.red('FAIL')}`);
  lines.push(`  PHI Access Tracked: ${hipaa.phiAccessTracked ? chalk.green('PASS') : chalk.red('FAIL')}`);
  lines.push(`  User Identification Present: ${hipaa.userIdentificationPresent ? chalk.green('PASS') : chalk.red('FAIL')}`);
  lines.push(`  Timestamps Recorded: ${hipaa.timestampsRecorded ? chalk.green('PASS') : chalk.red('FAIL')}\n`);

  if (report.entries.length > 0) {
    lines.push(chalk.bold('Recent Entries:'));
    const recentEntries = report.entries.slice(-5);
    for (const entry of recentEntries) {
      const statusColor = entry.status === 'success' ? chalk.green : chalk.red;
      lines.push(`  [${entry.timestamp}] ${entry.user} - ${entry.action} ${statusColor(`(${entry.status})`)}`);
    }
  }

  return lines.join('\n');
}

program
  .name('ai-audit')
  .description('Audit trail for all AI interactions (SOC2/HIPAA compliance)')
  .version('1.0.0')
  .option('--json', 'Output in JSON format');

program
  .command('start')
  .description('Start audit logging')
  .action(() => {
    const options = program.opts<GlobalOptions>();
    try {
      const result = core.start();
      if (options.json) {
        output(result, options);
      } else {
        if (result.success) {
          console.log(chalk.green('Audit logging started successfully'));
          console.log(chalk.gray(`Started at: ${result.state.startedAt}`));
        } else {
          console.log(chalk.yellow(result.message));
        }
      }
      process.exit(result.success ? 0 : 1);
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
  .command('stop')
  .description('Stop audit logging')
  .action(() => {
    const options = program.opts<GlobalOptions>();
    try {
      const result = core.stop();
      if (options.json) {
        output(result, options);
      } else {
        if (result.success) {
          console.log(chalk.green('Audit logging stopped successfully'));
          console.log(chalk.gray(`Stopped at: ${result.state.stoppedAt}`));
        } else {
          console.log(chalk.yellow(result.message));
        }
      }
      process.exit(result.success ? 0 : 1);
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
  .command('log <entry>')
  .description('Log an audit entry')
  .option('-u, --user <user>', 'User performing the action')
  .option('-p, --prompt <prompt>', 'Prompt text (will be hashed)')
  .option('-r, --response <response>', 'Response text (will be hashed)')
  .option('-m, --model <model>', 'AI model used')
  .option('-t, --tokens <tokens>', 'Token count', parseInt)
  .option('-d, --duration <duration>', 'Duration in milliseconds', parseInt)
  .option('-s, --status <status>', 'Status (success/failure/pending)', 'success')
  .action((entry, cmdOptions) => {
    const options = program.opts<GlobalOptions>();
    try {
      const result = core.log({
        action: entry,
        user: cmdOptions.user,
        prompt: cmdOptions.prompt,
        response: cmdOptions.response,
        model: cmdOptions.model,
        tokenCount: cmdOptions.tokens,
        duration: cmdOptions.duration,
        status: cmdOptions.status as 'success' | 'failure' | 'pending'
      });
      if (options.json) {
        output(result, options);
      } else {
        console.log(chalk.green('Entry logged successfully'));
        console.log(chalk.gray(`ID: ${result.entry.id}`));
        console.log(chalk.gray(`Timestamp: ${result.entry.timestamp}`));
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
  .command('report')
  .description('Generate compliance report')
  .option('-p, --period <period>', 'Report period (day/week/month/year)', 'week')
  .option('-u, --user <user>', 'Filter by user')
  .action((cmdOptions) => {
    const options = program.opts<GlobalOptions>();
    try {
      const report = core.generateReport({
        period: cmdOptions.period as 'day' | 'week' | 'month' | 'year',
        user: cmdOptions.user
      });
      if (options.json) {
        output(report, options);
      } else {
        console.log(formatReport(report));
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
  .command('export')
  .description('Export audit data')
  .option('-f, --format <format>', 'Export format (json/csv)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action((cmdOptions) => {
    const options = program.opts<GlobalOptions>();
    try {
      const result = core.export({
        format: cmdOptions.format as 'json' | 'csv',
        outputPath: cmdOptions.output
      });

      if (cmdOptions.output) {
        const fs = require('fs');
        fs.writeFileSync(cmdOptions.output, result.data);
        if (options.json) {
          output({ success: true, path: cmdOptions.output, format: result.format }, options);
        } else {
          console.log(chalk.green(`Exported to ${cmdOptions.output}`));
        }
      } else {
        console.log(result.data);
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
  .command('status')
  .description('Show audit status')
  .action(() => {
    const options = program.opts<GlobalOptions>();
    try {
      const status = core.getStatus();
      if (options.json) {
        output(status, options);
      } else {
        console.log(chalk.bold('\nAudit Status:'));
        console.log(`  Enabled: ${status.enabled ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Total Entries: ${status.entryCount}`);
        if (status.state.startedAt) {
          console.log(`  Started At: ${status.state.startedAt}`);
        }
        if (status.state.stoppedAt) {
          console.log(`  Stopped At: ${status.state.stoppedAt}`);
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
