import { AuditStorage, AuditEntry, AuditState } from './storage';

export interface ReportOptions {
  period: 'day' | 'week' | 'month' | 'year';
  format?: 'text' | 'json';
  user?: string;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  outputPath?: string;
}

export interface LogEntryInput {
  action: string;
  user?: string;
  prompt?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  apiEndpoint?: string;
  model?: string;
  tokenCount?: number;
  duration?: number;
  status?: 'success' | 'failure' | 'pending';
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: string;
  period: {
    start: string;
    end: string;
    type: string;
  };
  summary: {
    totalInteractions: number;
    successRate: number;
    uniqueUsers: number;
    averageResponseTime: number;
    totalTokensUsed: number;
  };
  compliance: {
    soc2: {
      accessControlsLogged: boolean;
      dataIntegrityMaintained: boolean;
      auditTrailComplete: boolean;
      securityEventsRecorded: boolean;
    };
    hipaa: {
      accessLogsAvailable: boolean;
      phiAccessTracked: boolean;
      userIdentificationPresent: boolean;
      timestampsRecorded: boolean;
    };
  };
  entries: AuditEntry[];
  statistics: Record<string, unknown>;
}

export class AuditCore {
  private storage: AuditStorage;

  constructor(dbPath?: string) {
    this.storage = new AuditStorage(dbPath);
  }

  public start(): { success: boolean; message: string; state: AuditState } {
    if (this.storage.isEnabled()) {
      return {
        success: false,
        message: 'Audit logging is already enabled',
        state: this.storage.getState()
      };
    }

    this.storage.start();

    // Log the start event itself
    this.storage.addEntry({
      user: process.env.USER || process.env.USERNAME || 'system',
      action: 'audit_started',
      status: 'success',
      metadata: {
        event: 'Audit logging enabled',
        environment: process.env.NODE_ENV || 'development'
      }
    });

    return {
      success: true,
      message: 'Audit logging started successfully',
      state: this.storage.getState()
    };
  }

  public stop(): { success: boolean; message: string; state: AuditState } {
    if (!this.storage.isEnabled()) {
      return {
        success: false,
        message: 'Audit logging is not currently enabled',
        state: this.storage.getState()
      };
    }

    // Log the stop event before stopping
    this.storage.addEntry({
      user: process.env.USER || process.env.USERNAME || 'system',
      action: 'audit_stopped',
      status: 'success',
      metadata: {
        event: 'Audit logging disabled'
      }
    });

    this.storage.stop();

    return {
      success: true,
      message: 'Audit logging stopped successfully',
      state: this.storage.getState()
    };
  }

  public log(input: LogEntryInput): { success: boolean; entry: AuditEntry } {
    const entry = this.storage.addEntry({
      user: input.user || process.env.USER || process.env.USERNAME || 'unknown',
      action: input.action,
      promptHash: input.prompt ? this.storage.hashContent(input.prompt) : undefined,
      responseHash: input.response ? this.storage.hashContent(input.response) : undefined,
      metadata: input.metadata,
      apiEndpoint: input.apiEndpoint,
      model: input.model,
      tokenCount: input.tokenCount,
      duration: input.duration,
      status: input.status || 'success'
    });

    return { success: true, entry };
  }

  public generateReport(options: ReportOptions): ComplianceReport {
    const entries = this.storage.getEntriesByPeriod(options.period);
    const filteredEntries = options.user
      ? entries.filter(e => e.user === options.user)
      : entries;

    const statistics = this.storage.getStatistics(filteredEntries);

    const now = new Date();
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };

    const startDate = new Date(now.getTime() - periodMs[options.period]);

    const successCount = filteredEntries.filter(e => e.status === 'success').length;
    const successRate = filteredEntries.length > 0
      ? (successCount / filteredEntries.length) * 100
      : 0;

    const report: ComplianceReport = {
      reportId: this.storage.generateId(),
      generatedAt: now.toISOString(),
      period: {
        start: startDate.toISOString(),
        end: now.toISOString(),
        type: options.period
      },
      summary: {
        totalInteractions: filteredEntries.length,
        successRate: Math.round(successRate * 100) / 100,
        uniqueUsers: statistics.uniqueUsers as number,
        averageResponseTime: Math.round((statistics.averageDuration as number) * 100) / 100,
        totalTokensUsed: statistics.totalTokens as number
      },
      compliance: {
        soc2: {
          accessControlsLogged: filteredEntries.every(e => e.user !== 'unknown'),
          dataIntegrityMaintained: filteredEntries.every(e => e.promptHash || e.action.startsWith('audit_')),
          auditTrailComplete: filteredEntries.length > 0,
          securityEventsRecorded: filteredEntries.some(e =>
            e.action === 'audit_started' || e.action === 'audit_stopped'
          )
        },
        hipaa: {
          accessLogsAvailable: true,
          phiAccessTracked: filteredEntries.every(e => e.timestamp && e.user),
          userIdentificationPresent: filteredEntries.every(e => e.user !== 'unknown'),
          timestampsRecorded: filteredEntries.every(e => !!e.timestamp)
        }
      },
      entries: filteredEntries,
      statistics
    };

    return report;
  }

  public export(options: ExportOptions): { success: boolean; data: string; format: string } {
    const data = this.storage.exportData(options.format);
    return {
      success: true,
      data,
      format: options.format
    };
  }

  public getStatus(): { enabled: boolean; state: AuditState; entryCount: number } {
    return {
      enabled: this.storage.isEnabled(),
      state: this.storage.getState(),
      entryCount: this.storage.getDatabase().metadata.totalEntries
    };
  }
}
