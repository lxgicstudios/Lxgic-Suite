import chalk from 'chalk';
import { BenchmarkResult } from './core.js';
import { formatDuration, formatCost, formatNumber } from './stats.js';

/**
 * Create an ASCII bar chart
 */
function createBar(value: number, maxValue: number, width: number = 30): string {
  const filledWidth = Math.round((value / maxValue) * width);
  const filled = '\u2588'.repeat(filledWidth);
  const empty = '\u2591'.repeat(width - filledWidth);
  return filled + empty;
}

/**
 * Create a histogram from values
 */
function createHistogram(
  values: number[],
  buckets: number = 10,
  width: number = 30
): string[] {
  if (values.length === 0) return ['No data'];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / buckets;

  // Count values in each bucket
  const counts = new Array(buckets).fill(0);
  for (const value of values) {
    const bucketIndex = Math.min(
      Math.floor((value - min) / bucketSize),
      buckets - 1
    );
    counts[bucketIndex]++;
  }

  const maxCount = Math.max(...counts);
  const lines: string[] = [];

  for (let i = 0; i < buckets; i++) {
    const bucketStart = min + i * bucketSize;
    const bucketEnd = min + (i + 1) * bucketSize;
    const bar = createBar(counts[i], maxCount, width);
    const label = `${formatNumber(bucketStart, 0)}-${formatNumber(bucketEnd, 0)}ms`;
    lines.push(`  ${label.padEnd(16)} ${bar} ${counts[i]}`);
  }

  return lines;
}

/**
 * Format a benchmark result as a report
 */
export function formatReport(results: BenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.cyan.bold('  Benchmark Results'));
  lines.push(chalk.gray('  ' + '='.repeat(60)));
  lines.push('');

  for (const result of results) {
    lines.push(chalk.yellow.bold(`  Model: ${result.model}`));
    lines.push('');

    // Summary section
    lines.push(chalk.cyan('  Summary'));
    lines.push(chalk.gray('  ' + '-'.repeat(40)));
    lines.push(`  Successful Runs:    ${chalk.green(result.summary.successfulRuns)}/${result.summary.totalRuns}`);
    if (result.summary.failedRuns > 0) {
      lines.push(`  Failed Runs:        ${chalk.red(result.summary.failedRuns)}`);
    }
    lines.push(`  Total Time:         ${chalk.white(formatDuration(result.summary.totalTime))}`);
    lines.push(`  Total Cost:         ${chalk.white(formatCost(result.summary.totalCost))}`);
    lines.push('');

    // Latency section
    lines.push(chalk.cyan('  Latency'));
    lines.push(chalk.gray('  ' + '-'.repeat(40)));
    lines.push(`  Average:            ${formatDuration(result.statistics.latency.mean)}`);
    lines.push(`  Median (p50):       ${formatDuration(result.statistics.latency.p50)}`);
    lines.push(`  p95:                ${formatDuration(result.statistics.latency.p95)}`);
    lines.push(`  p99:                ${formatDuration(result.statistics.latency.p99)}`);
    lines.push(`  Min:                ${formatDuration(result.statistics.latency.min)}`);
    lines.push(`  Max:                ${formatDuration(result.statistics.latency.max)}`);
    lines.push(`  Std Dev:            ${formatDuration(result.statistics.latency.stdDev)}`);
    lines.push('');

    // Token throughput section
    lines.push(chalk.cyan('  Token Throughput'));
    lines.push(chalk.gray('  ' + '-'.repeat(40)));
    lines.push(`  Avg Input Tokens:   ${formatNumber(result.statistics.inputTokens.mean, 0)}`);
    lines.push(`  Avg Output Tokens:  ${formatNumber(result.statistics.outputTokens.mean, 0)}`);
    lines.push(`  Avg Tokens/sec:     ${formatNumber(result.summary.averageTokensPerSecond, 1)}`);
    lines.push('');

    // Cost section
    lines.push(chalk.cyan('  Cost Per Run'));
    lines.push(chalk.gray('  ' + '-'.repeat(40)));
    lines.push(`  Average:            ${formatCost(result.statistics.cost.mean)}`);
    lines.push(`  Min:                ${formatCost(result.statistics.cost.min)}`);
    lines.push(`  Max:                ${formatCost(result.statistics.cost.max)}`);
    lines.push('');

    // Latency histogram
    lines.push(chalk.cyan('  Latency Distribution'));
    lines.push(chalk.gray('  ' + '-'.repeat(40)));
    const latencies = result.iterations.filter(i => i.success).map(i => i.latencyMs);
    const histogramLines = createHistogram(latencies, 8, 25);
    lines.push(...histogramLines);
    lines.push('');

    // Separator between models
    if (results.indexOf(result) < results.length - 1) {
      lines.push(chalk.gray('  ' + '='.repeat(60)));
      lines.push('');
    }
  }

  // Comparison table if multiple models
  if (results.length > 1) {
    lines.push(chalk.cyan.bold('  Model Comparison'));
    lines.push(chalk.gray('  ' + '='.repeat(60)));
    lines.push('');

    // Find the best values for highlighting
    const bestLatency = Math.min(...results.map(r => r.statistics.latency.p50));
    const bestTps = Math.max(...results.map(r => r.summary.averageTokensPerSecond));
    const bestCost = Math.min(...results.map(r => r.statistics.cost.mean));

    // Table header
    const header = `  ${'Model'.padEnd(35)} ${'p50'.padStart(10)} ${'TPS'.padStart(10)} ${'Cost'.padStart(10)}`;
    lines.push(chalk.gray(header));
    lines.push(chalk.gray('  ' + '-'.repeat(65)));

    for (const result of results) {
      const modelName = result.model.length > 33
        ? result.model.slice(0, 30) + '...'
        : result.model;

      const p50 = formatDuration(result.statistics.latency.p50);
      const tps = formatNumber(result.summary.averageTokensPerSecond, 1);
      const cost = formatCost(result.statistics.cost.mean);

      const p50Colored = result.statistics.latency.p50 === bestLatency
        ? chalk.green(p50.padStart(10))
        : p50.padStart(10);
      const tpsColored = result.summary.averageTokensPerSecond === bestTps
        ? chalk.green(tps.padStart(10))
        : tps.padStart(10);
      const costColored = result.statistics.cost.mean === bestCost
        ? chalk.green(cost.padStart(10))
        : cost.padStart(10);

      lines.push(`  ${modelName.padEnd(35)} ${p50Colored} ${tpsColored} ${costColored}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format comparison between two prompts
 */
export function formatComparisonReport(
  result1: BenchmarkResult,
  result2: BenchmarkResult,
  file1: string,
  file2: string
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.cyan.bold('  Prompt Comparison Results'));
  lines.push(chalk.gray('  ' + '='.repeat(60)));
  lines.push('');

  // Comparison table header
  const header = `  ${'Metric'.padEnd(25)} ${'Prompt 1'.padStart(15)} ${'Prompt 2'.padStart(15)} ${'Diff'.padStart(12)}`;
  lines.push(chalk.gray(header));
  lines.push(chalk.gray('  ' + '-'.repeat(67)));

  // Helper to format diff
  const formatDiff = (v1: number, v2: number, lowerIsBetter: boolean = true): string => {
    const diff = v2 - v1;
    const pct = v1 !== 0 ? (diff / v1) * 100 : 0;
    const sign = diff > 0 ? '+' : '';
    const color = (diff > 0) === lowerIsBetter ? chalk.red : chalk.green;
    return color(`${sign}${pct.toFixed(1)}%`);
  };

  // Latency comparisons
  lines.push(`  ${'Avg Latency'.padEnd(25)} ${formatDuration(result1.statistics.latency.mean).padStart(15)} ${formatDuration(result2.statistics.latency.mean).padStart(15)} ${formatDiff(result1.statistics.latency.mean, result2.statistics.latency.mean).padStart(12)}`);
  lines.push(`  ${'p50 Latency'.padEnd(25)} ${formatDuration(result1.statistics.latency.p50).padStart(15)} ${formatDuration(result2.statistics.latency.p50).padStart(15)} ${formatDiff(result1.statistics.latency.p50, result2.statistics.latency.p50).padStart(12)}`);
  lines.push(`  ${'p95 Latency'.padEnd(25)} ${formatDuration(result1.statistics.latency.p95).padStart(15)} ${formatDuration(result2.statistics.latency.p95).padStart(15)} ${formatDiff(result1.statistics.latency.p95, result2.statistics.latency.p95).padStart(12)}`);
  lines.push(`  ${'p99 Latency'.padEnd(25)} ${formatDuration(result1.statistics.latency.p99).padStart(15)} ${formatDuration(result2.statistics.latency.p99).padStart(15)} ${formatDiff(result1.statistics.latency.p99, result2.statistics.latency.p99).padStart(12)}`);

  lines.push(chalk.gray('  ' + '-'.repeat(67)));

  // Token comparisons
  lines.push(`  ${'Avg Input Tokens'.padEnd(25)} ${formatNumber(result1.statistics.inputTokens.mean, 0).padStart(15)} ${formatNumber(result2.statistics.inputTokens.mean, 0).padStart(15)} ${formatDiff(result1.statistics.inputTokens.mean, result2.statistics.inputTokens.mean).padStart(12)}`);
  lines.push(`  ${'Avg Output Tokens'.padEnd(25)} ${formatNumber(result1.statistics.outputTokens.mean, 0).padStart(15)} ${formatNumber(result2.statistics.outputTokens.mean, 0).padStart(15)} ${formatDiff(result1.statistics.outputTokens.mean, result2.statistics.outputTokens.mean, false).padStart(12)}`);
  lines.push(`  ${'Tokens/sec'.padEnd(25)} ${formatNumber(result1.summary.averageTokensPerSecond, 1).padStart(15)} ${formatNumber(result2.summary.averageTokensPerSecond, 1).padStart(15)} ${formatDiff(result1.summary.averageTokensPerSecond, result2.summary.averageTokensPerSecond, false).padStart(12)}`);

  lines.push(chalk.gray('  ' + '-'.repeat(67)));

  // Cost comparison
  lines.push(`  ${'Avg Cost'.padEnd(25)} ${formatCost(result1.statistics.cost.mean).padStart(15)} ${formatCost(result2.statistics.cost.mean).padStart(15)} ${formatDiff(result1.statistics.cost.mean, result2.statistics.cost.mean).padStart(12)}`);
  lines.push(`  ${'Total Cost'.padEnd(25)} ${formatCost(result1.summary.totalCost).padStart(15)} ${formatCost(result2.summary.totalCost).padStart(15)} ${formatDiff(result1.summary.totalCost, result2.summary.totalCost).padStart(12)}`);

  lines.push('');

  // Summary
  lines.push(chalk.cyan('  Summary'));
  lines.push(chalk.gray('  ' + '-'.repeat(40)));

  const latencyDiff = result2.statistics.latency.p50 - result1.statistics.latency.p50;
  const latencyPct = result1.statistics.latency.p50 !== 0
    ? (latencyDiff / result1.statistics.latency.p50) * 100
    : 0;

  if (Math.abs(latencyDiff) < 50) {
    lines.push(`  Latency: ${chalk.gray('Similar performance (within 50ms)')}`);
  } else if (latencyDiff < 0) {
    lines.push(`  Latency: ${chalk.green(`Prompt 2 is ${Math.abs(latencyPct).toFixed(1)}% faster`)}`);
  } else {
    lines.push(`  Latency: ${chalk.red(`Prompt 2 is ${latencyPct.toFixed(1)}% slower`)}`);
  }

  const costDiff = result2.statistics.cost.mean - result1.statistics.cost.mean;
  const costPct = result1.statistics.cost.mean !== 0
    ? (costDiff / result1.statistics.cost.mean) * 100
    : 0;

  if (Math.abs(costPct) < 5) {
    lines.push(`  Cost: ${chalk.gray('Similar cost (within 5%)')}`);
  } else if (costDiff < 0) {
    lines.push(`  Cost: ${chalk.green(`Prompt 2 is ${Math.abs(costPct).toFixed(1)}% cheaper`)}`);
  } else {
    lines.push(`  Cost: ${chalk.red(`Prompt 2 is ${costPct.toFixed(1)}% more expensive`)}`);
  }

  lines.push('');

  return lines.join('\n');
}

export default { formatReport, formatComparisonReport };
