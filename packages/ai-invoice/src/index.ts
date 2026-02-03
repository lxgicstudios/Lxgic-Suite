#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateInvoice,
  exportInvoice,
  previewInvoice,
  getUsageSummary,
  loadConfig,
  saveConfig,
  CONFIG_DIR,
  addUsageRecord
} from './core';

const program = new Command();

program
  .name('ai-invoice')
  .description('Generate invoices for AI usage - aggregate costs and create professional invoice documents')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Generate an invoice for a specific month')
  .requiredOption('--month <month>', 'Month in YYYY-MM format (e.g., 2024-01)')
  .option('--group-by <type>', 'Group line items by: model, project, team', 'model')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format: json, csv, pdf, text', 'text')
  .option('--json', 'Output as JSON (shorthand for --format json)')
  .action((options: { month: string; groupBy: string; output?: string; format: string; json?: boolean }) => {
    try {
      const groupBy = options.groupBy as 'model' | 'project' | 'team';
      const invoice = generateInvoice(options.month, groupBy);

      const format = options.json ? 'json' : options.format as 'json' | 'csv' | 'pdf' | 'text';
      const output = exportInvoice(invoice, format);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, output);
        console.log(chalk.green(`Invoice saved to: ${outputPath}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Preview command
program
  .command('preview')
  .description('Preview invoice for current or specified month')
  .option('--month <month>', 'Month in YYYY-MM format', getCurrentMonth())
  .option('--group-by <type>', 'Group line items by: model, project, team', 'model')
  .option('--json', 'Output as JSON')
  .action((options: { month: string; groupBy: string; json?: boolean }) => {
    try {
      const groupBy = options.groupBy as 'model' | 'project' | 'team';

      if (options.json) {
        const invoice = generateInvoice(options.month, groupBy);
        console.log(JSON.stringify(invoice, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nInvoice Preview\n'));
        console.log(previewInvoice(options.month, groupBy));
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Export command
program
  .command('export')
  .description('Export invoice in specified format')
  .requiredOption('--month <month>', 'Month in YYYY-MM format')
  .option('--format <format>', 'Output format: json, csv, pdf', 'pdf')
  .option('-o, --output <file>', 'Output file path')
  .option('--group-by <type>', 'Group line items by: model, project, team', 'model')
  .option('--json', 'Output metadata as JSON')
  .action((options: { month: string; format: string; output?: string; groupBy: string; json?: boolean }) => {
    try {
      const groupBy = options.groupBy as 'model' | 'project' | 'team';
      const invoice = generateInvoice(options.month, groupBy);
      const format = options.format as 'json' | 'csv' | 'pdf';
      const output = exportInvoice(invoice, format);

      const defaultExt = format === 'pdf' ? 'html' : format;
      const outputPath = options.output
        ? path.resolve(options.output)
        : path.join(process.cwd(), `invoice-${options.month}.${defaultExt}`);

      fs.writeFileSync(outputPath, output);

      if (options.json) {
        console.log(JSON.stringify({
          success: true,
          outputPath,
          format,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total
        }, null, 2));
      } else {
        console.log(chalk.green(`\nInvoice exported successfully!`));
        console.log(chalk.gray(`Format: ${format.toUpperCase()}`));
        console.log(chalk.gray(`File: ${outputPath}`));
        console.log(chalk.gray(`Invoice #: ${invoice.invoiceNumber}`));
        console.log(chalk.gray(`Total: ${invoice.currency}${invoice.total.toFixed(2)}`));

        if (format === 'pdf') {
          console.log(chalk.yellow('\nNote: PDF format generates an HTML file ready for PDF conversion.'));
          console.log(chalk.yellow('Open the HTML file in a browser and use Print > Save as PDF.'));
        }
        console.log('');
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

// Summary command
program
  .command('summary')
  .description('Show usage summary for a month')
  .option('--month <month>', 'Month in YYYY-MM format', getCurrentMonth())
  .option('--json', 'Output as JSON')
  .action((options: { month: string; json?: boolean }) => {
    try {
      const summary = getUsageSummary(options.month);

      if (options.json) {
        console.log(JSON.stringify({
          month: options.month,
          totalRecords: summary.totalRecords,
          totalCost: summary.totalCost,
          totalInputTokens: summary.totalInputTokens,
          totalOutputTokens: summary.totalOutputTokens,
          byModel: Object.fromEntries(summary.byModel),
          byProject: Object.fromEntries(summary.byProject),
          byTeam: Object.fromEntries(summary.byTeam)
        }, null, 2));
      } else {
        console.log(chalk.bold.cyan(`\nUsage Summary for ${options.month}\n`));
        console.log('═'.repeat(50));
        console.log(`Total API Calls:    ${summary.totalRecords.toLocaleString()}`);
        console.log(`Total Input Tokens: ${summary.totalInputTokens.toLocaleString()}`);
        console.log(`Total Output Tokens: ${summary.totalOutputTokens.toLocaleString()}`);
        console.log(`Total Cost:         $${summary.totalCost.toFixed(2)}`);
        console.log('');

        console.log(chalk.bold('By Model:'));
        for (const [model, cost] of summary.byModel) {
          console.log(`  ${model.padEnd(20)} $${cost.toFixed(2)}`);
        }
        console.log('');

        console.log(chalk.bold('By Project:'));
        for (const [project, cost] of summary.byProject) {
          console.log(`  ${project.padEnd(20)} $${cost.toFixed(2)}`);
        }
        console.log('');

        console.log(chalk.bold('By Team:'));
        for (const [team, cost] of summary.byTeam) {
          console.log(`  ${team.padEnd(20)} $${cost.toFixed(2)}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('View or update invoice configuration')
  .option('--vendor-name <name>', 'Set vendor name')
  .option('--vendor-email <email>', 'Set vendor email')
  .option('--client-name <name>', 'Set client name')
  .option('--client-email <email>', 'Set client email')
  .option('--tax-rate <rate>', 'Set tax rate (e.g., 0.1 for 10%)')
  .option('--currency <symbol>', 'Set currency symbol')
  .option('--show', 'Show current configuration')
  .option('--json', 'Output as JSON')
  .action((options: {
    vendorName?: string;
    vendorEmail?: string;
    clientName?: string;
    clientEmail?: string;
    taxRate?: string;
    currency?: string;
    show?: boolean;
    json?: boolean;
  }) => {
    try {
      const config = loadConfig();
      let updated = false;

      if (options.vendorName) {
        config.vendor.name = options.vendorName;
        updated = true;
      }
      if (options.vendorEmail) {
        config.vendor.email = options.vendorEmail;
        updated = true;
      }
      if (options.clientName) {
        if (!config.client) config.client = { name: '' };
        config.client.name = options.clientName;
        updated = true;
      }
      if (options.clientEmail) {
        if (!config.client) config.client = { name: '' };
        config.client.email = options.clientEmail;
        updated = true;
      }
      if (options.taxRate) {
        config.taxRate = parseFloat(options.taxRate);
        updated = true;
      }
      if (options.currency) {
        config.currency = options.currency;
        updated = true;
      }

      if (updated) {
        saveConfig(config);
      }

      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        console.log(chalk.bold.cyan('\nInvoice Configuration\n'));
        console.log(chalk.gray(`Config file: ${CONFIG_DIR}/config.json\n`));
        console.log(chalk.bold('Vendor:'));
        console.log(`  Name:  ${config.vendor.name}`);
        console.log(`  Email: ${config.vendor.email || 'Not set'}`);
        console.log('');
        console.log(chalk.bold('Client:'));
        console.log(`  Name:  ${config.client?.name || 'Not set'}`);
        console.log(`  Email: ${config.client?.email || 'Not set'}`);
        console.log('');
        console.log(chalk.bold('Settings:'));
        console.log(`  Tax Rate: ${config.taxRate ? (config.taxRate * 100).toFixed(0) + '%' : 'None'}`);
        console.log(`  Currency: ${config.currency || '$'}`);
        console.log('');

        if (updated) {
          console.log(chalk.green('Configuration updated successfully!'));
          console.log('');
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Add usage record command
program
  .command('add')
  .description('Add a usage record')
  .requiredOption('--model <model>', 'Model used')
  .requiredOption('--input <tokens>', 'Input tokens')
  .requiredOption('--output <tokens>', 'Output tokens')
  .requiredOption('--cost <cost>', 'Total cost')
  .option('--project <project>', 'Project name')
  .option('--team <team>', 'Team name')
  .option('--description <desc>', 'Description')
  .option('--json', 'Output as JSON')
  .action((options: {
    model: string;
    input: string;
    output: string;
    cost: string;
    project?: string;
    team?: string;
    description?: string;
    json?: boolean;
  }) => {
    try {
      addUsageRecord({
        model: options.model,
        inputTokens: parseInt(options.input),
        outputTokens: parseInt(options.output),
        cost: parseFloat(options.cost),
        project: options.project,
        team: options.team,
        description: options.description
      });

      if (options.json) {
        console.log(JSON.stringify({ success: true, message: 'Usage record added' }));
      } else {
        console.log(chalk.green('Usage record added successfully!'));
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: (error as Error).message }));
      } else {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  });

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
