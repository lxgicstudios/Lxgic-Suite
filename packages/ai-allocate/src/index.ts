#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { allocateCost, tagUsage, listAllocations, generateReport, AllocateConfig } from './core.js';

const program = new Command();

program
  .name('ai-allocate')
  .version('1.0.0')
  .description('Allocate AI costs to cost centers')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('tag <project>')
  .description('Tag usage with a project/cost center')
  .option('--cost-center <center>', 'Cost center to allocate to')
  .option('--team <team>', 'Team name')
  .option('--environment <env>', 'Environment (dev/staging/prod)')
  .action(async (project, options) => {
    const config: AllocateConfig = {
      project,
      costCenter: options.costCenter,
      team: options.team,
      environment: options.environment,
    };

    const spinner = ora('Tagging usage...').start();
    try {
      const result = await tagUsage(config);
      spinner.succeed('Usage tagged successfully');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        console.log(chalk.green(`Project: ${result.project}`));
        console.log(chalk.blue(`Cost Center: ${result.costCenter}`));
        if (result.team) console.log(chalk.gray(`Team: ${result.team}`));
      }
    } catch (error) {
      spinner.fail('Failed to tag usage');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('allocate <amount>')
  .description('Allocate a specific cost amount')
  .option('--project <project>', 'Project to allocate to')
  .option('--cost-center <center>', 'Cost center')
  .option('--description <desc>', 'Description of the allocation')
  .action(async (amount, options) => {
    const spinner = ora('Allocating cost...').start();
    try {
      const result = await allocateCost(parseFloat(amount), {
        project: options.project,
        costCenter: options.costCenter,
        description: options.description,
      });
      spinner.succeed('Cost allocated');

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        console.log(chalk.green(`Allocated $${result.amount.toFixed(2)} to ${result.project}`));
      }
    } catch (error) {
      spinner.fail('Failed to allocate cost');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all allocations')
  .option('--project <project>', 'Filter by project')
  .option('--cost-center <center>', 'Filter by cost center')
  .option('--period <period>', 'Time period (day/week/month)')
  .action(async (options) => {
    const spinner = ora('Loading allocations...').start();
    try {
      const allocations = await listAllocations(options);
      spinner.stop();

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, allocations }, null, 2));
      } else {
        if (allocations.length === 0) {
          console.log(chalk.yellow('No allocations found'));
          return;
        }

        console.log(chalk.bold('\nAllocations:'));
        console.log('─'.repeat(60));
        for (const alloc of allocations) {
          console.log(`${chalk.blue(alloc.project)} | ${chalk.green('$' + alloc.amount.toFixed(2))} | ${alloc.costCenter}`);
        }
        console.log('─'.repeat(60));
        const total = allocations.reduce((sum, a) => sum + a.amount, 0);
        console.log(chalk.bold(`Total: $${total.toFixed(2)}`));
      }
    } catch (error) {
      spinner.fail('Failed to load allocations');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate allocation report')
  .option('--period <period>', 'Time period (day/week/month)', 'month')
  .option('--format <format>', 'Output format (table/csv/json)', 'table')
  .option('--output <file>', 'Output file path')
  .action(async (options) => {
    const spinner = ora('Generating report...').start();
    try {
      const report = await generateReport(options.period, options.format);
      spinner.succeed('Report generated');

      if (program.opts().json || options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(report.content);
      }
    } catch (error) {
      spinner.fail('Failed to generate report');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();
