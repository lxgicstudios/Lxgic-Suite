import { PromptCache, getCache, CacheEntry, CacheStats, generateKey } from './cache';

export interface CacheStatusResult {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  currentSize: number;
  hitRate: number;
  estimatedSavings: number;
}

export interface CacheStatsResult extends CacheStats {
  formattedSavings: string;
  formattedHitRate: string;
  formattedSize: string;
}

/**
 * Enable the cache with optional TTL
 */
export function enableCache(ttl?: number): CacheStatusResult {
  const cache = getCache();
  cache.enable(ttl);
  return getStatus();
}

/**
 * Disable the cache
 */
export function disableCache(): CacheStatusResult {
  const cache = getCache();
  cache.disable();
  return getStatus();
}

/**
 * Get current cache status
 */
export function getStatus(): CacheStatusResult {
  const cache = getCache();
  const stats = cache.getStats();
  const config = cache.getConfig();

  return {
    enabled: cache.isEnabled(),
    ttl: config.ttl,
    maxSize: config.maxSize,
    currentSize: stats.totalEntries,
    hitRate: stats.hitRate,
    estimatedSavings: stats.estimatedSavings
  };
}

/**
 * Clear the cache
 */
export function clearCache(): { clearedEntries: number; status: CacheStatusResult } {
  const cache = getCache();
  const clearedEntries = cache.clear();
  return {
    clearedEntries,
    status: getStatus()
  };
}

/**
 * Get detailed cache statistics
 */
export function getCacheStats(): CacheStatsResult {
  const cache = getCache();
  const stats = cache.getStats();

  return {
    ...stats,
    formattedSavings: formatCurrency(stats.estimatedSavings),
    formattedHitRate: (stats.hitRate * 100).toFixed(1) + '%',
    formattedSize: formatBytes(stats.cacheSize)
  };
}

/**
 * Get savings report
 */
export function getSavingsReport(): {
  totalHits: number;
  totalSavings: number;
  formattedSavings: string;
  savingsByModel: Array<{ model: string; hits: number; savings: number; formattedSavings: string }>;
  topCachedPrompts: Array<{ prompt: string; hits: number; savings: number; formattedSavings: string }>;
} {
  const cache = getCache();
  const report = cache.getSavingsReport();

  const savingsByModel = Array.from(report.savingsByModel.entries()).map(([model, data]) => ({
    model,
    hits: data.hits,
    savings: data.savings,
    formattedSavings: formatCurrency(data.savings)
  }));

  const topCachedPrompts = report.topCachedPrompts.map(p => ({
    ...p,
    formattedSavings: formatCurrency(p.savings)
  }));

  return {
    totalHits: report.totalHits,
    totalSavings: report.totalSavings,
    formattedSavings: formatCurrency(report.totalSavings),
    savingsByModel,
    topCachedPrompts
  };
}

/**
 * List cache entries
 */
export function listEntries(limit?: number): CacheEntry[] {
  const cache = getCache();
  let entries = cache.getEntries();

  // Sort by last accessed
  entries.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

  if (limit) {
    entries = entries.slice(0, limit);
  }

  return entries;
}

/**
 * Set TTL
 */
export function setTTL(ttl: number): CacheStatusResult {
  const cache = getCache();
  cache.setTTL(ttl);
  return getStatus();
}

/**
 * Reset statistics
 */
export function resetStats(): CacheStatsResult {
  const cache = getCache();
  cache.resetStats();
  return getCacheStats();
}

/**
 * Check cache for a prompt
 */
export function checkCache(prompt: string, model: string): {
  hit: boolean;
  key: string;
  entry?: CacheEntry;
} {
  const cache = getCache();
  const key = generateKey(prompt, model);
  const entry = cache.get(prompt, model);

  return {
    hit: entry !== null,
    key,
    entry: entry || undefined
  };
}

/**
 * Add entry to cache
 */
export function addToCache(
  prompt: string,
  response: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  estimatedCost: number
): { key: string; expiresAt: number } {
  const cache = getCache();
  cache.set(prompt, response, model, inputTokens, outputTokens, estimatedCost);

  const key = generateKey(prompt, model);
  const config = cache.getConfig();

  return {
    key,
    expiresAt: Date.now() + (config.ttl * 1000)
  };
}

/**
 * Format status for display
 */
export function formatStatus(status: CacheStatusResult): string {
  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '           Cache Status',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `Status:     ${status.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
    `TTL:        ${formatDuration(status.ttl)}`,
    `Max Size:   ${status.maxSize.toLocaleString()} entries`,
    `Used:       ${status.currentSize.toLocaleString()} entries`,
    `Hit Rate:   ${(status.hitRate * 100).toFixed(1)}%`,
    `Savings:    ${formatCurrency(status.estimatedSavings)}`,
    ''
  ];

  return lines.join('\n');
}

/**
 * Format stats for display
 */
export function formatStats(stats: CacheStatsResult): string {
  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '         Cache Statistics',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `Total Entries:    ${stats.totalEntries.toLocaleString()}`,
    `Cache Size:       ${stats.formattedSize}`,
    '',
    `Total Hits:       ${stats.totalHits.toLocaleString()}`,
    `Total Misses:     ${stats.totalMisses.toLocaleString()}`,
    `Hit Rate:         ${stats.formattedHitRate}`,
    '',
    `Estimated Savings: ${stats.formattedSavings}`,
    ''
  ];

  if (stats.oldestEntry) {
    lines.push(`Oldest Entry:     ${new Date(stats.oldestEntry).toLocaleString()}`);
  }
  if (stats.newestEntry) {
    lines.push(`Newest Entry:     ${new Date(stats.newestEntry).toLocaleString()}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format savings report for display
 */
export function formatSavingsReport(report: ReturnType<typeof getSavingsReport>): string {
  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '         Savings Report',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `Total Cache Hits: ${report.totalHits.toLocaleString()}`,
    `Total Savings:    ${report.formattedSavings}`,
    ''
  ];

  if (report.savingsByModel.length > 0) {
    lines.push('Savings by Model:');
    lines.push('─────────────────────────────────────────');
    for (const { model, hits, formattedSavings } of report.savingsByModel) {
      lines.push(`  ${model.padEnd(20)} ${hits.toString().padStart(5)} hits  ${formattedSavings}`);
    }
    lines.push('');
  }

  if (report.topCachedPrompts.length > 0) {
    lines.push('Top Cached Prompts:');
    lines.push('─────────────────────────────────────────');
    for (const { prompt, hits, formattedSavings } of report.topCachedPrompts) {
      lines.push(`  ${prompt.substring(0, 30).padEnd(30)} ${hits.toString().padStart(5)} hits  ${formattedSavings}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format cache entries for display
 */
export function formatEntries(entries: CacheEntry[]): string {
  if (entries.length === 0) {
    return 'No cache entries found.';
  }

  const lines: string[] = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '                              Cache Entries',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ''
  ];

  for (const entry of entries) {
    const expiresIn = Math.max(0, entry.expiresAt - Date.now());
    lines.push(`Key: ${entry.key}`);
    lines.push(`Model: ${entry.model}`);
    lines.push(`Prompt: ${entry.prompt.substring(0, 60)}${entry.prompt.length > 60 ? '...' : ''}`);
    lines.push(`Hits: ${entry.hitCount} | Cost: ${formatCurrency(entry.estimatedCost)} | Expires in: ${formatDuration(expiresIn / 1000)}`);
    lines.push('─────────────────────────────────────────────────────────────────────────────');
  }

  lines.push('');
  lines.push(`Total: ${entries.length} entries`);

  return lines.join('\n');
}

// Helper functions
function formatCurrency(amount: number): string {
  if (amount < 0.01) {
    return `$${amount.toFixed(6)}`;
  }
  return `$${amount.toFixed(4)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export { PromptCache, getCache, generateKey };
