import * as fs from 'fs';
import * as path from 'path';
import {
  UsageRecord,
  UsageSummary,
  GroupedUsage,
  TrendData,
  loadUsageData,
  addRecord,
  getRecordsForPeriod,
  getPeriodBoundaries,
  groupRecords,
  generateSummary,
  calculateTrends,
  exportToCSV,
  exportToJSON,
  importFromCSV,
  getConfigPath,
} from './reporter';

export interface ReportOptions {
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate?: string;
  endDate?: string;
  format?: 'csv' | 'json';
  groupBy?: 'user' | 'team' | 'project' | 'model';
}

export interface ReportResult {
  summary: UsageSummary;
  records: UsageRecord[];
  breakdown?: GroupedUsage[];
  trends?: TrendData[];
}

/**
 * Generate a usage report
 */
export function generateReport(options: ReportOptions = {}): ReportResult {
  let startDate: Date;
  let endDate: Date;

  if (options.startDate && options.endDate) {
    startDate = new Date(options.startDate);
    endDate = new Date(options.endDate);
  } else {
    const boundaries = getPeriodBoundaries(options.period || 'month');
    startDate = boundaries.start;
    endDate = boundaries.end;
  }

  const records = getRecordsForPeriod(startDate, endDate);
  const summary = generateSummary(records, startDate, endDate);

  const result: ReportResult = {
    summary,
    records,
  };

  if (options.groupBy) {
    result.breakdown = groupRecords(records, options.groupBy);
  }

  return result;
}

/**
 * Get usage summary
 */
export function getSummary(period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'): UsageSummary {
  const { start, end } = getPeriodBoundaries(period);
  const records = getRecordsForPeriod(start, end);
  return generateSummary(records, start, end);
}

/**
 * Get usage breakdown
 */
export function getBreakdown(
  groupBy: 'user' | 'team' | 'project' | 'model',
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'
): GroupedUsage[] {
  const { start, end } = getPeriodBoundaries(period);
  const records = getRecordsForPeriod(start, end);
  return groupRecords(records, groupBy);
}

/**
 * Get trend analysis
 */
export function getTrends(
  periodType: 'day' | 'week' | 'month' = 'month',
  periods: number = 6
): TrendData[] {
  return calculateTrends(periodType, periods);
}

/**
 * Export report to file
 */
export function exportReport(
  outputPath: string,
  format: 'csv' | 'json',
  options: ReportOptions = {}
): string {
  const report = generateReport(options);
  let content: string;

  if (format === 'csv') {
    content = exportToCSV(report.records);
  } else {
    content = exportToJSON(report.records);
  }

  const absolutePath = path.resolve(outputPath);
  fs.writeFileSync(absolutePath, content, 'utf-8');

  return absolutePath;
}

/**
 * Import usage data from file
 */
export function importData(filePath: string): number {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return importFromCSV(content);
  } else if (ext === '.json') {
    const records = JSON.parse(content) as UsageRecord[];
    let imported = 0;
    for (const record of records) {
      addRecord({
        user: record.user,
        team: record.team,
        project: record.project,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        cost: record.cost,
        metadata: record.metadata,
      });
      imported++;
    }
    return imported;
  }

  throw new Error('Unsupported file format. Use .csv or .json');
}

/**
 * Record API usage
 */
export function recordUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  options: {
    user?: string;
    team?: string;
    project?: string;
    metadata?: Record<string, string>;
  } = {}
): UsageRecord {
  return addRecord({
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost,
    user: options.user,
    team: options.team,
    project: options.project,
    metadata: options.metadata,
  });
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get data directory path
 */
export function getDataPath(): string {
  return getConfigPath();
}

// Re-export types
export { UsageRecord, UsageSummary, GroupedUsage, TrendData };
