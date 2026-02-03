import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UsageRecord {
  id: string;
  timestamp: string;
  user?: string;
  team?: string;
  project?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  metadata?: Record<string, string>;
}

export interface UsageData {
  records: UsageRecord[];
  lastUpdated: string;
}

export interface GroupedUsage {
  key: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  avgTokensPerRequest: number;
  records: UsageRecord[];
}

export interface UsageSummary {
  period: {
    start: string;
    end: string;
  };
  totals: {
    tokens: number;
    cost: number;
    requests: number;
  };
  byModel: Record<string, { tokens: number; cost: number; requests: number }>;
  byUser?: Record<string, { tokens: number; cost: number; requests: number }>;
  byTeam?: Record<string, { tokens: number; cost: number; requests: number }>;
  byProject?: Record<string, { tokens: number; cost: number; requests: number }>;
}

export interface TrendData {
  period: string;
  tokens: number;
  cost: number;
  requests: number;
  changePercent: number;
}

const CONFIG_DIR = path.join(os.homedir(), '.lxgic', 'ai-usage');
const USAGE_FILE = path.join(CONFIG_DIR, 'usage.json');

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load usage data
 */
export function loadUsageData(): UsageData {
  ensureConfigDir();

  if (!fs.existsSync(USAGE_FILE)) {
    const defaultData: UsageData = {
      records: [],
      lastUpdated: new Date().toISOString(),
    };
    saveUsageData(defaultData);
    return defaultData;
  }

  const content = fs.readFileSync(USAGE_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save usage data
 */
export function saveUsageData(data: UsageData): void {
  ensureConfigDir();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a usage record
 */
export function addRecord(record: Omit<UsageRecord, 'id' | 'timestamp'>): UsageRecord {
  const data = loadUsageData();
  const newRecord: UsageRecord = {
    ...record,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
  data.records.push(newRecord);
  saveUsageData(data);
  return newRecord;
}

/**
 * Get records for a date range
 */
export function getRecordsForPeriod(startDate: Date, endDate: Date): UsageRecord[] {
  const data = loadUsageData();
  return data.records.filter(record => {
    const recordDate = new Date(record.timestamp);
    return recordDate >= startDate && recordDate <= endDate;
  });
}

/**
 * Get period boundaries
 */
export function getPeriodBoundaries(period: 'day' | 'week' | 'month' | 'quarter' | 'year'): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarter':
      const quarter = Math.floor(start.getMonth() / 3);
      start.setMonth(quarter * 3);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(quarter * 3 + 3);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'year':
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Group records by a field
 */
export function groupRecords(records: UsageRecord[], groupBy: 'user' | 'team' | 'project' | 'model'): GroupedUsage[] {
  const groups: Map<string, UsageRecord[]> = new Map();

  for (const record of records) {
    let key = 'unknown';
    switch (groupBy) {
      case 'user':
        key = record.user || 'unknown';
        break;
      case 'team':
        key = record.team || 'unknown';
        break;
      case 'project':
        key = record.project || 'unknown';
        break;
      case 'model':
        key = record.model;
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  }

  const result: GroupedUsage[] = [];
  for (const [key, groupRecords] of groups) {
    const totalTokens = groupRecords.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = groupRecords.reduce((sum, r) => sum + r.cost, 0);
    const requestCount = groupRecords.length;

    result.push({
      key,
      totalTokens,
      totalCost,
      requestCount,
      avgTokensPerRequest: requestCount > 0 ? Math.round(totalTokens / requestCount) : 0,
      records: groupRecords,
    });
  }

  return result.sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Generate usage summary
 */
export function generateSummary(records: UsageRecord[], startDate: Date, endDate: Date): UsageSummary {
  const summary: UsageSummary = {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totals: {
      tokens: 0,
      cost: 0,
      requests: records.length,
    },
    byModel: {},
    byUser: {},
    byTeam: {},
    byProject: {},
  };

  for (const record of records) {
    summary.totals.tokens += record.totalTokens;
    summary.totals.cost += record.cost;

    // By model
    if (!summary.byModel[record.model]) {
      summary.byModel[record.model] = { tokens: 0, cost: 0, requests: 0 };
    }
    summary.byModel[record.model].tokens += record.totalTokens;
    summary.byModel[record.model].cost += record.cost;
    summary.byModel[record.model].requests++;

    // By user
    if (record.user) {
      if (!summary.byUser![record.user]) {
        summary.byUser![record.user] = { tokens: 0, cost: 0, requests: 0 };
      }
      summary.byUser![record.user].tokens += record.totalTokens;
      summary.byUser![record.user].cost += record.cost;
      summary.byUser![record.user].requests++;
    }

    // By team
    if (record.team) {
      if (!summary.byTeam![record.team]) {
        summary.byTeam![record.team] = { tokens: 0, cost: 0, requests: 0 };
      }
      summary.byTeam![record.team].tokens += record.totalTokens;
      summary.byTeam![record.team].cost += record.cost;
      summary.byTeam![record.team].requests++;
    }

    // By project
    if (record.project) {
      if (!summary.byProject![record.project]) {
        summary.byProject![record.project] = { tokens: 0, cost: 0, requests: 0 };
      }
      summary.byProject![record.project].tokens += record.totalTokens;
      summary.byProject![record.project].cost += record.cost;
      summary.byProject![record.project].requests++;
    }
  }

  return summary;
}

/**
 * Calculate trend data
 */
export function calculateTrends(periodType: 'day' | 'week' | 'month', periods: number = 6): TrendData[] {
  const trends: TrendData[] = [];
  const now = new Date();

  for (let i = periods - 1; i >= 0; i--) {
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    switch (periodType) {
      case 'day':
        periodStart.setDate(periodStart.getDate() - i);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setDate(periodEnd.getDate() - i);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      case 'week':
        periodStart.setDate(periodStart.getDate() - (i * 7) - periodStart.getDay());
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setTime(periodStart.getTime());
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      case 'month':
        periodStart.setMonth(periodStart.getMonth() - i);
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setMonth(periodStart.getMonth() + 1);
        periodEnd.setDate(0);
        periodEnd.setHours(23, 59, 59, 999);
        break;
    }

    const records = getRecordsForPeriod(periodStart, periodEnd);
    const tokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const cost = records.reduce((sum, r) => sum + r.cost, 0);
    const requests = records.length;

    const prevTrend = trends.length > 0 ? trends[trends.length - 1] : null;
    const changePercent = prevTrend && prevTrend.cost > 0
      ? ((cost - prevTrend.cost) / prevTrend.cost) * 100
      : 0;

    trends.push({
      period: formatPeriodLabel(periodStart, periodType),
      tokens,
      cost,
      requests,
      changePercent,
    });
  }

  return trends;
}

/**
 * Format period label
 */
function formatPeriodLabel(date: Date, periodType: 'day' | 'week' | 'month'): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (periodType) {
    case 'day':
      return `${months[date.getMonth()]} ${date.getDate()}`;
    case 'week':
      return `Week of ${months[date.getMonth()]} ${date.getDate()}`;
    case 'month':
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}

/**
 * Export to CSV format
 */
export function exportToCSV(records: UsageRecord[]): string {
  const headers = ['id', 'timestamp', 'user', 'team', 'project', 'model', 'inputTokens', 'outputTokens', 'totalTokens', 'cost'];
  const rows = records.map(r => [
    r.id,
    r.timestamp,
    r.user || '',
    r.team || '',
    r.project || '',
    r.model,
    r.inputTokens.toString(),
    r.outputTokens.toString(),
    r.totalTokens.toString(),
    r.cost.toFixed(4),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Export to JSON format
 */
export function exportToJSON(records: UsageRecord[]): string {
  return JSON.stringify(records, null, 2);
}

/**
 * Get configuration path
 */
export function getConfigPath(): string {
  return CONFIG_DIR;
}

/**
 * Import records from CSV
 */
export function importFromCSV(csvContent: string): number {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return 0;

  const headers = lines[0].split(',');
  const data = loadUsageData();
  let imported = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const record: Partial<UsageRecord> = {};

    headers.forEach((header, index) => {
      const value = values[index];
      switch (header.trim()) {
        case 'user': record.user = value || undefined; break;
        case 'team': record.team = value || undefined; break;
        case 'project': record.project = value || undefined; break;
        case 'model': record.model = value; break;
        case 'inputTokens': record.inputTokens = parseInt(value, 10) || 0; break;
        case 'outputTokens': record.outputTokens = parseInt(value, 10) || 0; break;
        case 'totalTokens': record.totalTokens = parseInt(value, 10) || 0; break;
        case 'cost': record.cost = parseFloat(value) || 0; break;
      }
    });

    if (record.model && record.totalTokens !== undefined) {
      data.records.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        model: record.model,
        inputTokens: record.inputTokens || 0,
        outputTokens: record.outputTokens || 0,
        totalTokens: record.totalTokens,
        cost: record.cost || 0,
        user: record.user,
        team: record.team,
        project: record.project,
      });
      imported++;
    }
  }

  saveUsageData(data);
  return imported;
}
