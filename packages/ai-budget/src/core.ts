import {
  BudgetConfig,
  BudgetStatus,
  HistoryEntry,
  UsageEntry,
  BudgetLimits,
  loadConfig,
  saveConfig,
  setLimits,
  setAlerts,
  addUsage,
  getStatus,
  resetUsage,
  getHistory,
  getConfigPath,
} from './tracker';

export interface SetBudgetOptions {
  daily?: number;
  weekly?: number;
  monthly?: number;
  alert?: number[];
  currency?: string;
}

export interface AddUsageOptions {
  amount: number;
  model?: string;
  project?: string;
  description?: string;
}

/**
 * Set budget limits and optionally alert thresholds
 */
export function setBudget(options: SetBudgetOptions): BudgetConfig {
  const limits: BudgetLimits = {};

  if (options.daily !== undefined) limits.daily = options.daily;
  if (options.weekly !== undefined) limits.weekly = options.weekly;
  if (options.monthly !== undefined) limits.monthly = options.monthly;

  const config = setLimits(limits);

  if (options.alert && options.alert.length > 0) {
    setAlerts(options.alert);
  }

  if (options.currency) {
    const updatedConfig = loadConfig();
    updatedConfig.currency = options.currency;
    saveConfig(updatedConfig);
    return updatedConfig;
  }

  return config;
}

/**
 * Record AI usage
 */
export function recordUsage(options: AddUsageOptions): { entry: UsageEntry; status: BudgetStatus } {
  const entry: Omit<UsageEntry, 'timestamp'> = {
    amount: options.amount,
    model: options.model,
    project: options.project,
    description: options.description,
  };

  addUsage(entry);
  const status = getStatus();

  return {
    entry: { ...entry, timestamp: new Date().toISOString() },
    status,
  };
}

/**
 * Get current budget status
 */
export function getBudgetStatus(): BudgetStatus {
  return getStatus();
}

/**
 * Reset usage data
 */
export function resetBudget(period?: 'daily' | 'weekly' | 'monthly' | 'all'): void {
  resetUsage(period);
}

/**
 * Get usage history
 */
export function getBudgetHistory(
  periods: number = 6,
  periodType: 'daily' | 'weekly' | 'monthly' = 'monthly'
): HistoryEntry[] {
  return getHistory(periods, periodType);
}

/**
 * Check if budget is exceeded
 */
export function isBudgetExceeded(): { exceeded: boolean; details: string[] } {
  const status = getStatus();
  const exceeded: string[] = [];

  if (status.limits.daily && status.currentUsage.daily > status.limits.daily) {
    exceeded.push(`Daily limit exceeded: $${status.currentUsage.daily.toFixed(2)} / $${status.limits.daily.toFixed(2)}`);
  }

  if (status.limits.weekly && status.currentUsage.weekly > status.limits.weekly) {
    exceeded.push(`Weekly limit exceeded: $${status.currentUsage.weekly.toFixed(2)} / $${status.limits.weekly.toFixed(2)}`);
  }

  if (status.limits.monthly && status.currentUsage.monthly > status.limits.monthly) {
    exceeded.push(`Monthly limit exceeded: $${status.currentUsage.monthly.toFixed(2)} / $${status.limits.monthly.toFixed(2)}`);
  }

  return {
    exceeded: exceeded.length > 0,
    details: exceeded,
  };
}

/**
 * Get remaining budget
 */
export function getRemainingBudget(): { daily?: number; weekly?: number; monthly?: number } {
  const status = getStatus();
  const remaining: { daily?: number; weekly?: number; monthly?: number } = {};

  if (status.limits.daily !== undefined) {
    remaining.daily = Math.max(0, status.limits.daily - status.currentUsage.daily);
  }

  if (status.limits.weekly !== undefined) {
    remaining.weekly = Math.max(0, status.limits.weekly - status.currentUsage.weekly);
  }

  if (status.limits.monthly !== undefined) {
    remaining.monthly = Math.max(0, status.limits.monthly - status.currentUsage.monthly);
  }

  return remaining;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3',
    JPY: '\u00A5',
  };

  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Get configuration directory path
 */
export function getDataPath(): string {
  return getConfigPath();
}

// Re-export types
export { BudgetConfig, BudgetStatus, HistoryEntry, UsageEntry, BudgetLimits };
