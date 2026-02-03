#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import {
  generateReport,
  getSummary,
  getBreakdown,
  getTrends,
  exportReport,
  importData,
  recordUsage,
  formatCurrency,
  formatNumber,
  getDataPath,
  UsageSummary,
  GroupedUsage,
  TrendData,
} from './core';

const program = new Command();

program
  .name('ai-usage')
  .description('Generate usage reports by team/project with trend analysis and export capabilities')
  .version('1.0.0');

/**
 * Display usage summary
 */
function displaySummary(summary: UsageSummary, options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const startDate = new Date(summary.period.start).toLocaleDateString();
  const endDate = new Date(summary.period.end).toLocaleDateString();

  console.log(chalk.bold('\n Usage Summary'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`Period: ${startDate} - ${endDate}`);

  console.log(chalk.bold('\nTotals:'));
  console.log(`  Requests: ${chalk.cyan(formatNumber(summary.totals.requests))}`);
  console.log(`  Tokens:   ${chalk.yellow(formatNumber(summary.totals.tokens))}`);
  console.log(`  Cost:     ${chalk.green(formatCurrency(summary.totals.cost))}`);

  // By Model
  const models = Object.entries(summary.byModel);
  if (models.length > 0) {
    console.log(chalk.bold('\nBy Model:'));
    for (const [model, data] of models.sort((a, b) => b[1].cost - a[1].cost)) {
      console.log(`  ${chalk.cyan(model.padEnd(20))} ${formatNumber(data.requests).padStart(6)} reqs  ${formatNumber(data.tokens).padStart(12)} tokens  ${formatCurrency(data.cost).padStart(10)}`);
    }
  }

  // By User
  const users = Object.entries(summary.byUser || {});
  if (users.length > 0) {
    console.log(chalk.bold('\nBy User:'));
    for (const [user, data] of users.sort((a, b) => b[1].cost - a[1].cost).slice(0, 10)) {
      console.log(`  ${chalk.cyan(user.padEnd(20))} ${formatNumber(data.requests).padStart(6)} reqs  ${formatNumber(data.tokens).padStart(12)} tokens  ${formatCurrency(data.cost).padStart(10)}`);
    }
  }

  // By Team
  const teams = Object.entries(summary.byTeam || {});
  if (teams.length > 0) {
    console.log(chalk.bold('\nBy Team:'));
    for (const [team, data] of teams.sort((a, b) => b[1].cost - a[1].cost)) {
      console.log(`  ${chalk.cyan(team.padEnd(20))} ${formatNumber(data.requests).padStart(6)} reqs  ${formatNumber(data.tokens).padStart(12)} tokens  ${formatCurrency(data.cost).padStart(10)}`);
    }
  }

  // By Project
  const projects = Object.entries(summary.byProject || {});
  if (projects.length > 0) {
    console.log(chalk.bold('\nBy Project:'));
    for (const [project, data] of projects.sort((a, b) => b[1].cost - a[1].cost).slice(0, 10)) {
      console.log(`  ${chalk.cyan(project.padEnd(20))} ${formatNumber(data.requests).padStart(6)} reqs  ${formatNumber(data.tokens).padStart(12)} tokens  ${formatCurrency(data.cost).padStart(10)}`);
    }
  }

  console.log('');
}

/**
 * Display breakdown
 */
function displayBreakdown(breakdown: GroupedUsage[], groupBy: string, options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(breakdown, null, 2));
    return;
  }

  console.log(chalk.bold(`\n Usage Breakdown by ${groupBy}`));
  console.log(chalk.gray('─'.repeat(70)));

  const totalCost = breakdown.reduce((sum, g) => sum + g.totalCost, 0);

  for (const group of breakdown) {
    const percentage = totalCost > 0 ? (group.totalCost / totalCost) * 100 : 0;
    const bar = createBar(percentage);

    console.log(`${chalk.cyan(group.key.padEnd(25))} ${formatCurrency(group.totalCost).padStart(10)} (${percentage.toFixed(1)}%)`);
    console.log(`  ${bar}`);
    console.log(`  ${formatNumber(group.requestCount)} requests, ${formatNumber(group.totalTokens)} tokens, avg ${formatNumber(group.avgTokensPerRequest)} tokens/req`);
    console.log('');
  }
}

/**
 * Display trends
 */
function displayTrends(trends: TrendData[], options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(trends, null, 2));
    return;
  }

  console.log(chalk.bold('\n Usage Trends'));
  console.log(chalk.gray('─'.repeat(70)));

  const maxCost = Math.max(...trends.map(t => t.cost), 1);

  for (const trend of trends) {
    const bar = createBar((trend.cost / maxCost) * 100, 30);
    const changeStr = trend.changePercent > 0
      ? chalk.red(`+${trend.changePercent.toFixed(1)}%`)
      : trend.changePercent < 0
        ? chalk.green(`${trend.changePercent.toFixed(1)}%`)
        : chalk.gray('0%');

    console.log(`${chalk.cyan(trend.period.padEnd(20))} ${formatCurrency(trend.cost).padStart(10)} ${changeStr.padStart(12)}`);
    console.log(`  ${bar}`);
    console.log(`  ${formatNumber(trend.requests)} requests, ${formatNumber(trend.tokens)} tokens`);
    console.log('');
  }
}

/**
 * Create a visual bar
 */
function createBar(percentage: number, width: number = 40): string {
  const filled = Math.min(width, Math.round((percentage / 100) * width));
  const empty = width - filled;
  return chalk.cyan('[' + '='.repeat(filled) + ' '.repeat(empty) + ']');
}

// Report command
program
  .command('report')
  .description('Generate a usage report')
  .option('-p, --period <period>', 'Report period (day, week, month, quarter, year)', 'month')
  .option('-f, --format <format>', 'Output format (csv, json)')
  .option('-o, --output <file>', 'Output file path')
  .option('-g, --group-by <field>', 'Group by field (user, team, project, model)')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const period = options.period as 'day' | 'week' | 'month' | 'quarter' | 'year';

      if (options.output) {
        const format = options.format || (options.output.endsWith('.csv') ? 'csv' : 'json');
        const outputPath = exportReport(options.output, format, { period, groupBy: options.groupBy });
        console.log(chalk.green(`Report exported to: ${outputPath}`));
      } else {
        const report = generateReport({ period, groupBy: options.groupBy });
        displaySummary(report.summary, { json: options.json || options.format === 'json' });

        if (report.breakdown) {
          displayBreakdown(report.breakdown, options.groupBy, { json: options.json || options.format === 'json' });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Summary command
program
  .command('summary')
  .description('Show usage summary')
  .option('-p, --period <period>', 'Summary period (day, week, month, quarter, year)', 'month')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const period = options.period as 'day' | 'week' | 'month' | 'quarter' | 'year';
      const summary = getSummary(period);
      displaySummary(summary, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Breakdown command
program
  .command('breakdown')
  .description('Show usage breakdown by category')
  .option('-b, --by <field>', 'Group by field (user, team, project, model)', 'project')
  .option('-p, --period <period>', 'Period (day, week, month, quarter, year)', 'month')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const groupBy = options.by as 'user' | 'team' | 'project' | 'model';
      const period = options.period as 'day' | 'week' | 'month' | 'quarter' | 'year';
      const breakdown = getBreakdown(groupBy, period);
      displayBreakdown(breakdown, groupBy, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Trends command
program
  .command('trends')
  .description('Show usage trends over time')
  .option('-t, --type <type>', 'Period type (day, week, month)', 'month')
  .option('-n, --periods <number>', 'Number of periods', '6')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const periodType = options.type as 'day' | 'week' | 'month';
      const periods = parseInt(options.periods, 10);
      const trends = getTrends(periodType, periods);
      displayTrends(trends, { json: options.json });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Record command
program
  .command('record')
  .description('Record API usage')
  .requiredOption('-m, --model <model>', 'Model name')
  .requiredOption('-i, --input-tokens <tokens>', 'Input tokens', parseInt)
  .requiredOption('-o, --output-tokens <tokens>', 'Output tokens', parseInt)
  .requiredOption('-c, --cost <amount>', 'Cost', parseFloat)
  .option('-u, --user <user>', 'User name')
  .option('-t, --team <team>', 'Team name')
  .option('-p, --project <project>', 'Project name')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const record = recordUsage(
        options.model,
        options.inputTokens,
        options.outputTokens,
        options.cost,
        {
          user: options.user,
          team: options.team,
          project: options.project,
        }
      );

      if (options.json) {
        console.log(JSON.stringify({ success: true, record }, null, 2));
      } else {
        console.log(chalk.green('\nUsage recorded successfully!'));
        console.log(`  Model:         ${record.model}`);
        console.log(`  Input tokens:  ${formatNumber(record.inputTokens)}`);
        console.log(`  Output tokens: ${formatNumber(record.outputTokens)}`);
        console.log(`  Total tokens:  ${formatNumber(record.totalTokens)}`);
        console.log(`  Cost:          ${formatCurrency(record.cost)}`);
        if (record.user) console.log(`  User:          ${record.user}`);
        if (record.team) console.log(`  Team:          ${record.team}`);
        if (record.project) console.log(`  Project:       ${record.project}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Import command
program
  .command('import <file>')
  .description('Import usage data from CSV or JSON file')
  .option('--json', 'Output in JSON format')
  .action((file: string, options) => {
    try {
      const imported = importData(file);

      if (options.json) {
        console.log(JSON.stringify({ success: true, imported }, null, 2));
      } else {
        console.log(chalk.green(`\nImported ${imported} records successfully!`));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Export command
program
  .command('export <file>')
  .description('Export usage data to CSV or JSON file')
  .option('-p, --period <period>', 'Period (day, week, month, quarter, year)', 'month')
  .option('-f, --format <format>', 'Format (csv, json)')
  .option('--json', 'Output in JSON format')
  .action((file: string, options) => {
    try {
      const format = options.format || (file.endsWith('.csv') ? 'csv' : 'json');
      const outputPath = exportReport(file, format, { period: options.period });

      if (options.json) {
        console.log(JSON.stringify({ success: true, path: outputPath }, null, 2));
      } else {
        console.log(chalk.green(`\nExported to: ${outputPath}`));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// Config path command
program
  .command('config-path')
  .description('Show data directory path')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    const dataPath = getDataPath();

    if (options.json) {
      console.log(JSON.stringify({ path: dataPath }, null, 2));
    } else {
      console.log(`Data directory: ${dataPath}`);
    }
  });

// Default action - show summary
program.action(() => {
  const summary = getSummary('month');
  displaySummary(summary, { json: false });
});

program.parse();
