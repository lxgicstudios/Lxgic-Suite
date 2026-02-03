import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  promptHash?: string;
  responseHash?: string;
  metadata?: Record<string, unknown>;
  apiEndpoint?: string;
  model?: string;
  tokenCount?: number;
  duration?: number;
  status: 'success' | 'failure' | 'pending';
  ipAddress?: string;
  sessionId?: string;
}

export interface AuditState {
  enabled: boolean;
  startedAt?: string;
  stoppedAt?: string;
}

export interface AuditDatabase {
  version: string;
  state: AuditState;
  entries: AuditEntry[];
  metadata: {
    createdAt: string;
    lastModified: string;
    totalEntries: number;
  };
}

export class AuditStorage {
  private dbPath: string;
  private db: AuditDatabase;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), '.ai-audit.json');
    this.db = this.load();
  }

  private getDefaultDatabase(): AuditDatabase {
    const now = new Date().toISOString();
    return {
      version: '1.0.0',
      state: { enabled: false },
      entries: [],
      metadata: {
        createdAt: now,
        lastModified: now,
        totalEntries: 0
      }
    };
  }

  private load(): AuditDatabase {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      // If file is corrupted, start fresh
    }
    return this.getDefaultDatabase();
  }

  private save(): void {
    this.db.metadata.lastModified = new Date().toISOString();
    this.db.metadata.totalEntries = this.db.entries.length;
    fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2));
  }

  public hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public generateId(): string {
    return crypto.randomUUID();
  }

  public start(): void {
    this.db.state = {
      enabled: true,
      startedAt: new Date().toISOString()
    };
    this.save();
  }

  public stop(): void {
    this.db.state = {
      enabled: false,
      startedAt: this.db.state.startedAt,
      stoppedAt: new Date().toISOString()
    };
    this.save();
  }

  public isEnabled(): boolean {
    return this.db.state.enabled;
  }

  public getState(): AuditState {
    return this.db.state;
  }

  public addEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const fullEntry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.db.entries.push(fullEntry);
    this.save();
    return fullEntry;
  }

  public getEntries(options?: {
    startDate?: Date;
    endDate?: Date;
    user?: string;
    action?: string;
    status?: string;
    limit?: number;
  }): AuditEntry[] {
    let entries = [...this.db.entries];

    if (options?.startDate) {
      entries = entries.filter(e => new Date(e.timestamp) >= options.startDate!);
    }
    if (options?.endDate) {
      entries = entries.filter(e => new Date(e.timestamp) <= options.endDate!);
    }
    if (options?.user) {
      entries = entries.filter(e => e.user === options.user);
    }
    if (options?.action) {
      entries = entries.filter(e => e.action === options.action);
    }
    if (options?.status) {
      entries = entries.filter(e => e.status === options.status);
    }
    if (options?.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  public getEntriesByPeriod(period: 'day' | 'week' | 'month' | 'year'): AuditEntry[] {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    return this.getEntries({ startDate });
  }

  public getStatistics(entries?: AuditEntry[]): Record<string, unknown> {
    const data = entries || this.db.entries;

    const stats = {
      totalEntries: data.length,
      successCount: data.filter(e => e.status === 'success').length,
      failureCount: data.filter(e => e.status === 'failure').length,
      uniqueUsers: [...new Set(data.map(e => e.user))].length,
      actionBreakdown: {} as Record<string, number>,
      userBreakdown: {} as Record<string, number>,
      modelBreakdown: {} as Record<string, number>,
      averageDuration: 0,
      totalTokens: 0
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const entry of data) {
      // Action breakdown
      stats.actionBreakdown[entry.action] = (stats.actionBreakdown[entry.action] || 0) + 1;

      // User breakdown
      stats.userBreakdown[entry.user] = (stats.userBreakdown[entry.user] || 0) + 1;

      // Model breakdown
      if (entry.model) {
        stats.modelBreakdown[entry.model] = (stats.modelBreakdown[entry.model] || 0) + 1;
      }

      // Duration stats
      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }

      // Token count
      if (entry.tokenCount) {
        stats.totalTokens += entry.tokenCount;
      }
    }

    stats.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    return stats;
  }

  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'user', 'action', 'status', 'promptHash', 'responseHash', 'model', 'tokenCount', 'duration'];
      const rows = this.db.entries.map(entry =>
        headers.map(h => {
          const value = entry[h as keyof AuditEntry];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value || '';
        }).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(this.db, null, 2);
  }

  public getDatabase(): AuditDatabase {
    return this.db;
  }
}
