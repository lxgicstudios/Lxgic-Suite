import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BudgetLimits {
  daily?: number;
  weekly?: number;
  monthly?: number;
}

export interface AlertThreshold {
  percentage: number;
  triggered: boolean;
  triggeredAt?: string;
}

export interface UsageEntry {
  timestamp: string;
  amount: number;
  model?: string;
  project?: string;
  description?: string;
}

export interface BudgetConfig {
  limits: BudgetLimits;
  alerts: AlertThreshold[];
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageData {
  entries: UsageEntry[];
  totalSpent: number;
  lastUpdated: string;
}

export interface BudgetStatus {
  limits: BudgetLimits;
  currentUsage: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  percentUsed: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  alerts: AlertThreshold[];
  triggeredAlerts: AlertThreshold[];
  currency: string;
}

export interface HistoryEntry {
  period: string;
  startDate: string;
  endDate: string;
  totalSpent: number;
  limit?: number;
  percentUsed?: number;
}

const CONFIG_DIR = path.join(os.homedir(), '.lxgic', 'ai-budget');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
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
 * Load budget configuration
 */
export function loadConfig(): BudgetConfig {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig: BudgetConfig = {
      limits: {},
      alerts: [
        { percentage: 50, triggered: false },
        { percentage: 80, triggered: false },
        { percentage: 100, triggered: false },
      ],
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save budget configuration
 */
export function saveConfig(config: BudgetConfig): void {
  ensureConfigDir();
  config.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Load usage data
 */
export function loadUsage(): UsageData {
  ensureConfigDir();

  if (!fs.existsSync(USAGE_FILE)) {
    const defaultUsage: UsageData = {
      entries: [],
      totalSpent: 0,
      lastUpdated: new Date().toISOString(),
    };
    saveUsage(defaultUsage);
    return defaultUsage;
  }

  const content = fs.readFileSync(USAGE_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save usage data
 */
export function saveUsage(usage: UsageData): void {
  ensureConfigDir();
  usage.lastUpdated = new Date().toISOString();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

/**
 * Set budget limits
 */
export function setLimits(limits: BudgetLimits): BudgetConfig {
  const config = loadConfig();
  config.limits = { ...config.limits, ...limits };
  saveConfig(config);
  return config;
}

/**
 * Set alert thresholds
 */
export function setAlerts(percentages: number[]): BudgetConfig {
  const config = loadConfig();
  config.alerts = percentages.map(percentage => ({
    percentage,
    triggered: false,
  }));
  saveConfig(config);
  return config;
}

/**
 * Add a usage entry
 */
export function addUsage(entry: Omit<UsageEntry, 'timestamp'>): UsageData {
  const usage = loadUsage();
  const newEntry: UsageEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  usage.entries.push(newEntry);
  usage.totalSpent += entry.amount;
  saveUsage(usage);

  // Check alerts
  checkAlerts();

  return usage;
}

/**
 * Get usage for a specific period
 */
export function getUsageForPeriod(startDate: Date, endDate: Date): number {
  const usage = loadUsage();
  return usage.entries
    .filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    })
    .reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Get current period boundaries
 */
function getPeriodBoundaries(period: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Get current budget status
 */
export function getStatus(): BudgetStatus {
  const config = loadConfig();
  const dailyPeriod = getPeriodBoundaries('daily');
  const weeklyPeriod = getPeriodBoundaries('weekly');
  const monthlyPeriod = getPeriodBoundaries('monthly');

  const dailyUsage = getUsageForPeriod(dailyPeriod.start, dailyPeriod.end);
  const weeklyUsage = getUsageForPeriod(weeklyPeriod.start, weeklyPeriod.end);
  const monthlyUsage = getUsageForPeriod(monthlyPeriod.start, monthlyPeriod.end);

  const status: BudgetStatus = {
    limits: config.limits,
    currentUsage: {
      daily: dailyUsage,
      weekly: weeklyUsage,
      monthly: monthlyUsage,
    },
    percentUsed: {
      daily: config.limits.daily ? (dailyUsage / config.limits.daily) * 100 : 0,
      weekly: config.limits.weekly ? (weeklyUsage / config.limits.weekly) * 100 : 0,
      monthly: config.limits.monthly ? (monthlyUsage / config.limits.monthly) * 100 : 0,
    },
    alerts: config.alerts,
    triggeredAlerts: config.alerts.filter(a => a.triggered),
    currency: config.currency,
  };

  return status;
}

/**
 * Check and trigger alerts
 */
export function checkAlerts(): AlertThreshold[] {
  const config = loadConfig();
  const status = getStatus();
  const triggeredAlerts: AlertThreshold[] = [];

  // Check against the highest usage percentage
  const maxPercentUsed = Math.max(
    status.percentUsed.daily,
    status.percentUsed.weekly,
    status.percentUsed.monthly
  );

  for (const alert of config.alerts) {
    if (!alert.triggered && maxPercentUsed >= alert.percentage) {
      alert.triggered = true;
      alert.triggeredAt = new Date().toISOString();
      triggeredAlerts.push(alert);
    }
  }

  if (triggeredAlerts.length > 0) {
    saveConfig(config);
  }

  return triggeredAlerts;
}

/**
 * Reset usage for current period
 */
export function resetUsage(period?: 'daily' | 'weekly' | 'monthly' | 'all'): void {
  const usage = loadUsage();
  const config = loadConfig();

  if (period === 'all' || !period) {
    usage.entries = [];
    usage.totalSpent = 0;
    config.alerts.forEach(a => {
      a.triggered = false;
      delete a.triggeredAt;
    });
  } else {
    const { start, end } = getPeriodBoundaries(period);
    usage.entries = usage.entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate < start || entryDate > end;
    });
    usage.totalSpent = usage.entries.reduce((sum, entry) => sum + entry.amount, 0);
  }

  saveUsage(usage);
  saveConfig(config);
}

/**
 * Get usage history
 */
export function getHistory(periods: number = 6, periodType: 'daily' | 'weekly' | 'monthly' = 'monthly'): HistoryEntry[] {
  const config = loadConfig();
  const usage = loadUsage();
  const history: HistoryEntry[] = [];

  const now = new Date();

  for (let i = 0; i < periods; i++) {
    const start = new Date(now);
    const end = new Date(now);

    switch (periodType) {
      case 'daily':
        start.setDate(start.getDate() - i);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - i);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start.setDate(start.getDate() - (i * 7) - start.getDay());
        start.setHours(0, 0, 0, 0);
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - i);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    const spent = getUsageForPeriod(start, end);
    const limit = config.limits[periodType];

    history.push({
      period: formatPeriodLabel(start, periodType),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalSpent: spent,
      limit,
      percentUsed: limit ? (spent / limit) * 100 : undefined,
    });
  }

  return history.reverse();
}

/**
 * Format period label
 */
function formatPeriodLabel(date: Date, periodType: 'daily' | 'weekly' | 'monthly'): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (periodType) {
    case 'daily':
      return `${months[date.getMonth()]} ${date.getDate()}`;
    case 'weekly':
      return `Week of ${months[date.getMonth()]} ${date.getDate()}`;
    case 'monthly':
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}

/**
 * Export configuration path for external access
 */
export function getConfigPath(): string {
  return CONFIG_DIR;
}
