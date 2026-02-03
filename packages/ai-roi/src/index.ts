#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import {
  calculateROI,
  calculateTimeToValue,
  calculateProductivityROI,
  calculateROIFromData,
  generateProjection,
  formatCurrency,
  formatPercentage,
  formatMonths,
  ROIResult,
  TimeToValueResult,
  ProductivityMetrics,
} from './calculator';

const program = new Command();

program
  .name('ai-roi')
  .version('1.0.0')
  .description('Calculate ROI metrics for AI projects')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('calculate')
  .description('Calculate basic ROI from investment and savings')
  .requiredOption('--investment <amount>', 'Total investment amount', parseFloat)
  .requiredOption('--savings <amount>', 'Total savings achieved', parseFloat)
  .option('--period <months>', 'Time period in months', parseFloat, 12)
  .action(async (options) => {
    try {
      const result = calculateROI({
        investment: options.investment,
        savings: options.savings,
        timePeriodMonths: options.period,
      });

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        printROIResult(result, options.investment, options.savings);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('time-to-value')
  .description('Calculate time to value and break-even point')
  .requiredOption('--investment <amount>', 'Initial investment', parseFloat)
  .requiredOption('--monthly-savings <amount>', 'Monthly savings', parseFloat)
  .option('--monthly-cost <amount>', 'Monthly AI/operational cost', parseFloat, 0)
  .action(async (options) => {
    try {
      const result = calculateTimeToValue(
        options.investment,
        options.monthlySavings,
        options.monthlyCost
      );

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        printTimeToValue(result);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('productivity')
  .description('Calculate ROI based on productivity gains')
  .requiredOption('--hours-saved <hours>', 'Hours saved per week', parseFloat)
  .requiredOption('--hourly-rate <rate>', 'Hourly rate (cost of time)', parseFloat)
  .requiredOption('--ai-cost <cost>', 'Annual AI tool cost', parseFloat)
  .option('--weeks <weeks>', 'Working weeks per year', parseFloat, 50)
  .action(async (options) => {
    try {
      const result = calculateProductivityROI(
        options.hoursSaved,
        options.hourlyRate,
        options.aiCost,
        options.weeks
      );

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        printProductivityMetrics(result);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('from-file <file>')
  .description('Calculate ROI from savings data file')
  .requiredOption('--investment <amount>', 'Total investment amount', parseFloat)
  .action(async (file, options) => {
    try {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const result = calculateROIFromData(options.investment, data);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, ...result }, null, 2));
      } else {
        console.log(chalk.bold('\nROI from Savings Data'));
        console.log('─'.repeat(50));
        console.log(`Investment:      ${formatCurrency(options.investment)}`);
        console.log(`Total Savings:   ${formatCurrency(result.totalSavings)}`);
        console.log(`Net Gain:        ${formatCurrency(result.netGain)}`);
        console.log(`ROI:             ${formatPercentage(result.roiPercentage)}`);
        console.log();
        console.log(chalk.bold('Savings by Category:'));
        for (const [category, amount] of Object.entries(result.savingsByCategory)) {
          console.log(`  ${category}: ${formatCurrency(amount)}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('projection')
  .description('Generate ROI projection over time')
  .requiredOption('--investment <amount>', 'Initial investment', parseFloat)
  .requiredOption('--monthly-savings <amount>', 'Monthly savings', parseFloat)
  .option('--monthly-cost <amount>', 'Monthly ongoing cost', parseFloat, 0)
  .option('--months <months>', 'Projection period in months', parseFloat, 24)
  .action(async (options) => {
    try {
      const projection = generateProjection(
        options.investment,
        options.monthlySavings,
        options.monthlyCost,
        options.months
      );

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, projection }, null, 2));
      } else {
        console.log(chalk.bold('\nROI Projection'));
        console.log('─'.repeat(70));
        console.log(
          'Month'.padEnd(8) +
          'Savings'.padStart(14) +
          'Cost'.padStart(14) +
          'Net Value'.padStart(14) +
          'ROI'.padStart(12)
        );
        console.log('─'.repeat(70));

        for (const p of projection) {
          const netColor = p.netValue >= 0 ? chalk.green : chalk.red;
          const roiColor = p.roi >= 0 ? chalk.green : chalk.red;

          console.log(
            p.month.toString().padEnd(8) +
            formatCurrency(p.cumulativeSavings).padStart(14) +
            formatCurrency(p.cumulativeCost).padStart(14) +
            netColor(formatCurrency(p.netValue).padStart(14)) +
            roiColor(formatPercentage(p.roi).padStart(12))
          );
        }

        // Find break-even month
        const breakEven = projection.find(p => p.netValue >= 0);
        if (breakEven) {
          console.log();
          console.log(chalk.green(`✓ Break-even at month ${breakEven.month}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

function printROIResult(result: ROIResult, investment: number, savings: number): void {
  console.log(chalk.bold('\nROI Analysis'));
  console.log('─'.repeat(50));

  console.log(`Investment:       ${formatCurrency(investment)}`);
  console.log(`Savings:          ${formatCurrency(savings)}`);
  console.log(`Net Gain:         ${result.netGain >= 0 ? chalk.green(formatCurrency(result.netGain)) : chalk.red(formatCurrency(result.netGain))}`);
  console.log();
  console.log(`ROI:              ${result.roiPercentage >= 0 ? chalk.green(formatPercentage(result.roiPercentage)) : chalk.red(formatPercentage(result.roiPercentage))}`);

  if (result.annualizedROI !== null) {
    console.log(`Annualized ROI:   ${formatPercentage(result.annualizedROI)}`);
  }

  if (result.paybackPeriodMonths !== null) {
    console.log(`Payback Period:   ${formatMonths(result.paybackPeriodMonths)}`);
  }

  console.log();
  if (result.roiPercentage >= 100) {
    console.log(chalk.green('✓ Excellent ROI - Investment more than doubled'));
  } else if (result.roiPercentage >= 0) {
    console.log(chalk.yellow('○ Positive ROI - Investment recovered'));
  } else {
    console.log(chalk.red('✗ Negative ROI - Investment not recovered'));
  }
}

function printTimeToValue(result: TimeToValueResult): void {
  console.log(chalk.bold('\nTime to Value Analysis'));
  console.log('─'.repeat(50));

  console.log(`Initial Investment:   ${formatCurrency(result.initialInvestment)}`);
  console.log(`Monthly Savings:      ${formatCurrency(result.monthlySavings)}`);
  console.log();
  console.log(`Break-even:           ${formatMonths(result.breakEvenMonths)}`);
  console.log(`Break-even Date:      ${result.breakEvenDate}`);
  console.log();
  console.log(chalk.bold('Projected ROI:'));
  console.log(`  Year 1:             ${formatPercentage(result.yearOneROI)}`);
  console.log(`  Year 2:             ${formatPercentage(result.yearTwoROI)}`);
  console.log(`  5 Years:            ${formatPercentage(result.fiveYearROI)}`);
}

function printProductivityMetrics(result: ProductivityMetrics): void {
  console.log(chalk.bold('\nProductivity-Based ROI'));
  console.log('─'.repeat(50));

  console.log(`Hours Saved/Week:     ${result.hoursSavedPerWeek} hours`);
  console.log(`Hourly Rate:          ${formatCurrency(result.hourlyRate)}`);
  console.log(`Working Weeks/Year:   ${result.weeksPerYear}`);
  console.log();
  console.log(`Annual Time Savings:  ${formatCurrency(result.annualSavings)}`);
  console.log(`Annual AI Cost:       ${formatCurrency(result.aiCostPerYear)}`);
  console.log(`Net Annual Savings:   ${result.netAnnualSavings >= 0 ? chalk.green(formatCurrency(result.netAnnualSavings)) : chalk.red(formatCurrency(result.netAnnualSavings))}`);
  console.log();
  console.log(`ROI:                  ${result.roi >= 0 ? chalk.green(formatPercentage(result.roi)) : chalk.red(formatPercentage(result.roi))}`);

  if (result.roi >= 100) {
    console.log();
    console.log(chalk.green(`✓ AI investment pays for itself ${(result.roi / 100 + 1).toFixed(1)}x over`));
  }
}

program.parse();
