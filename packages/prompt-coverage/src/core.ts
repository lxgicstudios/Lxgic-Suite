import Conf from 'conf';
import { z } from 'zod';
import { CoverageAnalyzer, CoverageResult, formatCoverageReport } from './coverage.js';

const ConfigSchema = z.object({
  defaultThreshold: z.number().default(80),
  outputFormat: z.enum(['text', 'json', 'html']).default('text'),
  badgeStyle: z.enum(['flat', 'flat-square', 'plastic']).default('flat'),
  excludePatterns: z.array(z.string()).default([]),
  includePatterns: z.array(z.string()).default(['**/*.test.ts', '**/*.spec.ts'])
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ReportOptions {
  testsDir: string;
  promptsDir?: string;
  json?: boolean;
  outputFile?: string;
}

export interface BadgeOptions {
  testsDir?: string;
  style?: 'flat' | 'flat-square' | 'plastic';
  output?: string;
  json?: boolean;
}

export interface ThresholdOptions {
  min: number;
  testsDir?: string;
  json?: boolean;
}

export interface ThresholdResult {
  passed: boolean;
  threshold: number;
  actual: number;
  message: string;
}

export class PromptCoverageCore {
  private config: Conf<Config>;

  constructor() {
    this.config = new Conf<Config>({
      projectName: 'prompt-coverage',
      defaults: {
        defaultThreshold: 80,
        outputFormat: 'text',
        badgeStyle: 'flat',
        excludePatterns: [],
        includePatterns: ['**/*.test.ts', '**/*.spec.ts']
      }
    });
  }

  getConfig(): Config {
    return this.config.store;
  }

  setConfig(key: keyof Config, value: any): void {
    this.config.set(key, value);
  }

  async generateReport(options: ReportOptions): Promise<CoverageResult> {
    const analyzer = new CoverageAnalyzer(
      options.testsDir,
      options.promptsDir
    );

    const result = await analyzer.calculateCoverage();

    if (options.outputFile) {
      const fs = await import('fs');
      const content = options.json
        ? JSON.stringify(result, null, 2)
        : formatCoverageReport(result);
      fs.writeFileSync(options.outputFile, content);
    }

    return result;
  }

  async generateBadge(options: BadgeOptions): Promise<{ url: string; svg: string }> {
    const testsDir = options.testsDir || process.cwd();
    const analyzer = new CoverageAnalyzer(testsDir);
    const result = await analyzer.calculateCoverage();

    const url = analyzer.generateBadge(result.coveragePercentage);
    const svg = analyzer.generateBadgeSVG(result.coveragePercentage);

    if (options.output) {
      const fs = await import('fs');
      fs.writeFileSync(options.output, svg);
    }

    return { url, svg };
  }

  async checkThreshold(options: ThresholdOptions): Promise<ThresholdResult> {
    const testsDir = options.testsDir || process.cwd();
    const analyzer = new CoverageAnalyzer(testsDir);
    const result = await analyzer.calculateCoverage();

    const passed = result.coveragePercentage >= options.min;
    const message = passed
      ? `Coverage ${result.coveragePercentage}% meets threshold ${options.min}%`
      : `Coverage ${result.coveragePercentage}% is below threshold ${options.min}%`;

    return {
      passed,
      threshold: options.min,
      actual: result.coveragePercentage,
      message
    };
  }

  formatOutput(data: any, json: boolean): string {
    if (json) {
      return JSON.stringify(data, null, 2);
    }

    if (data.totalVariations !== undefined) {
      return formatCoverageReport(data);
    }

    if (data.url !== undefined) {
      return `Badge URL: ${data.url}\n\nSVG:\n${data.svg}`;
    }

    if (data.passed !== undefined) {
      return data.message;
    }

    return String(data);
  }
}

export const core = new PromptCoverageCore();
