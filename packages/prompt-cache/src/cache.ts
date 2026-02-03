import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface CacheEntry {
  key: string;
  prompt: string;
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  estimatedSavings: number;
  cacheSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // max entries
  persistPath: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 3600, // 1 hour default
  maxSize: 10000,
  persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '.', '.prompt-cache')
};

/**
 * Generate a hash key from prompt and model
 */
export function generateKey(prompt: string, model: string): string {
  const content = `${model}:${prompt}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}

/**
 * Prompt Cache Manager
 */
export class PromptCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    totalSavings: number;
  };
  private configPath: string;
  private cachePath: string;
  private statsPath: string;

  constructor(configOverrides?: Partial<CacheConfig>) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CONFIG, ...configOverrides };
    this.stats = { hits: 0, misses: 0, totalSavings: 0 };

    this.configPath = path.join(this.config.persistPath, 'config.json');
    this.cachePath = path.join(this.config.persistPath, 'cache.json');
    this.statsPath = path.join(this.config.persistPath, 'stats.json');

    this.ensureDirectory();
    this.loadConfig();
    this.loadCache();
    this.loadStats();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.config.persistPath)) {
      fs.mkdirSync(this.config.persistPath, { recursive: true });
    }
  }

  private loadConfig(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        this.config = { ...this.config, ...data };
      } catch (e) {
        // Use default config
      }
    }
  }

  private saveConfig(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  private loadCache(): void {
    if (fs.existsSync(this.cachePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
        this.cache = new Map(Object.entries(data));
        this.cleanExpired();
      } catch (e) {
        this.cache = new Map();
      }
    }
  }

  private saveCache(): void {
    const obj = Object.fromEntries(this.cache);
    fs.writeFileSync(this.cachePath, JSON.stringify(obj, null, 2));
  }

  private loadStats(): void {
    if (fs.existsSync(this.statsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.statsPath, 'utf-8'));
        this.stats = data;
      } catch (e) {
        // Use default stats
      }
    }
  }

  private saveStats(): void {
    fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
  }

  /**
   * Remove expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries if cache is full
   */
  private evictIfNeeded(): void {
    while (this.cache.size >= this.config.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.lastAccessedAt < oldestTime) {
          oldestTime = entry.lastAccessedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  /**
   * Get cached response
   */
  get(prompt: string, model: string): CacheEntry | null {
    if (!this.config.enabled) {
      this.stats.misses++;
      return null;
    }

    const key = generateKey(prompt, model);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.saveStats();
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.saveStats();
      this.saveCache();
      return null;
    }

    // Update hit statistics
    entry.hitCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;
    this.stats.totalSavings += entry.estimatedCost;

    this.saveCache();
    this.saveStats();

    return entry;
  }

  /**
   * Set cached response
   */
  set(
    prompt: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    estimatedCost: number
  ): void {
    if (!this.config.enabled) return;

    this.cleanExpired();
    this.evictIfNeeded();

    const key = generateKey(prompt, model);
    const now = Date.now();

    const entry: CacheEntry = {
      key,
      prompt,
      response,
      model,
      inputTokens,
      outputTokens,
      estimatedCost,
      createdAt: now,
      expiresAt: now + (this.config.ttl * 1000),
      hitCount: 0,
      lastAccessedAt: now
    };

    this.cache.set(key, entry);
    this.saveCache();
  }

  /**
   * Check if key exists in cache
   */
  has(prompt: string, model: string): boolean {
    if (!this.config.enabled) return false;

    const key = generateKey(prompt, model);
    const entry = this.cache.get(key);

    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.saveCache();
      return false;
    }

    return true;
  }

  /**
   * Delete a cache entry
   */
  delete(prompt: string, model: string): boolean {
    const key = generateKey(prompt, model);
    const result = this.cache.delete(key);
    if (result) {
      this.saveCache();
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    this.saveCache();
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.cleanExpired();

    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      if (oldestEntry === null || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (newestEntry === null || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
      totalSize += entry.prompt.length + entry.response.length;
    }

    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      totalEntries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      estimatedSavings: this.stats.totalSavings,
      cacheSize: totalSize,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Get all entries (for listing)
   */
  getEntries(): CacheEntry[] {
    this.cleanExpired();
    return Array.from(this.cache.values());
  }

  /**
   * Enable caching
   */
  enable(ttl?: number): void {
    this.config.enabled = true;
    if (ttl !== undefined) {
      this.config.ttl = ttl;
    }
    this.saveConfig();
  }

  /**
   * Disable caching
   */
  disable(): void {
    this.config.enabled = false;
    this.saveConfig();
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current TTL
   */
  getTTL(): number {
    return this.config.ttl;
  }

  /**
   * Set TTL
   */
  setTTL(ttl: number): void {
    this.config.ttl = ttl;
    this.saveConfig();
  }

  /**
   * Get config
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, totalSavings: 0 };
    this.saveStats();
  }

  /**
   * Get detailed savings report
   */
  getSavingsReport(): {
    totalHits: number;
    totalSavings: number;
    savingsByModel: Map<string, { hits: number; savings: number }>;
    topCachedPrompts: Array<{ prompt: string; hits: number; savings: number }>;
  } {
    const savingsByModel = new Map<string, { hits: number; savings: number }>();
    const promptSavings: Array<{ prompt: string; hits: number; savings: number }> = [];

    for (const entry of this.cache.values()) {
      // By model
      const modelStats = savingsByModel.get(entry.model) || { hits: 0, savings: 0 };
      modelStats.hits += entry.hitCount;
      modelStats.savings += entry.hitCount * entry.estimatedCost;
      savingsByModel.set(entry.model, modelStats);

      // By prompt
      if (entry.hitCount > 0) {
        promptSavings.push({
          prompt: entry.prompt.substring(0, 50) + (entry.prompt.length > 50 ? '...' : ''),
          hits: entry.hitCount,
          savings: entry.hitCount * entry.estimatedCost
        });
      }
    }

    // Sort by savings
    promptSavings.sort((a, b) => b.savings - a.savings);

    return {
      totalHits: this.stats.hits,
      totalSavings: this.stats.totalSavings,
      savingsByModel,
      topCachedPrompts: promptSavings.slice(0, 10)
    };
  }
}

// Singleton instance
let instance: PromptCache | null = null;

export function getCache(): PromptCache {
  if (!instance) {
    instance = new PromptCache();
  }
  return instance;
}
