import * as fs from 'fs';
import Conf from 'conf';
import { z } from 'zod';
import { ConsistencyAnalyzer, ConsistencyResult, formatConsistencyReport } from './analyzer';

const ConfigSchema = z.object({
  defaultRuns: z.number().default(5),
  defaultTemperature: z.number().default(1),
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  consistencyThreshold: z.number().default(0.8),
  maxTokens: z.number().default(1024)
});

export type Config = z.infer<typeof ConfigSchema>;

export interface CheckOptions {
  file: string;
  runs: number;
  temperature?: number;
  model?: string;
  json?: boolean;
}

export interface ThresholdOptions {
  min: number;
  file?: string;
  runs?: number;
  json?: boolean;
}

export interface ThresholdResult {
  passed: boolean;
  threshold: number;
  actual: number;
  message: string;
}

export class AIConsistencyCore {
  private config: Conf<Config>;
  private analyzer: ConsistencyAnalyzer;
  private lastResult: ConsistencyResult | null = null;

  constructor() {
    this.config = new Conf<Config>({
      projectName: 'ai-consistency',
      defaults: {
        defaultRuns: 5,
        defaultTemperature: 1,
        defaultModel: 'claude-sonnet-4-20250514',
        consistencyThreshold: 0.8,
        maxTokens: 1024
      }
    });
    this.analyzer = new ConsistencyAnalyzer();
  }

  getConfig(): Config {
    return this.config.store;
  }

  setConfig(key: keyof Config, value: any): void {
    this.config.set(key, value);
  }

  async check(options: CheckOptions): Promise<ConsistencyResult> {
    let prompt: string;

    if (fs.existsSync(options.file)) {
      prompt = fs.readFileSync(options.file, 'utf-8');
    } else {
      prompt = options.file; // Treat as prompt text
    }

    const config = this.getConfig();

    const result = await this.analyzer.analyzeConsistency(prompt, {
      runs: options.runs || config.defaultRuns,
      temperature: options.temperature ?? config.defaultTemperature,
      model: options.model || config.defaultModel,
      maxTokens: config.maxTokens
    });

    this.lastResult = result;
    return result;
  }

  getLastResult(): ConsistencyResult | null {
    return this.lastResult;
  }

  async checkThreshold(options: ThresholdOptions): Promise<ThresholdResult> {
    let result: ConsistencyResult;

    if (options.file) {
      result = await this.check({
        file: options.file,
        runs: options.runs || this.getConfig().defaultRuns
      });
    } else if (this.lastResult) {
      result = this.lastResult;
    } else {
      throw new Error('No file specified and no previous result available. Run check first.');
    }

    const passed = result.consistencyScore >= options.min;
    const message = passed
      ? `Consistency ${(result.consistencyScore * 100).toFixed(1)}% meets threshold ${(options.min * 100).toFixed(1)}%`
      : `Consistency ${(result.consistencyScore * 100).toFixed(1)}% is below threshold ${(options.min * 100).toFixed(1)}%`;

    return {
      passed,
      threshold: options.min,
      actual: result.consistencyScore,
      message
    };
  }

  formatOutput(data: any, json: boolean): string {
    if (json) {
      return JSON.stringify(data, null, 2);
    }

    if (data.consistencyScore !== undefined && data.outputs !== undefined) {
      return formatConsistencyReport(data);
    }

    if (data.passed !== undefined) {
      return data.message;
    }

    return String(data);
  }
}

export const core = new AIConsistencyCore();
