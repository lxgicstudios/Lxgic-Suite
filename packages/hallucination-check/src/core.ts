import * as fs from 'fs';
import Conf from 'conf';
import { z } from 'zod';
import { HallucinationDetector, VerificationResult, formatVerificationReport } from './detector';

const ConfigSchema = z.object({
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  strictMode: z.boolean().default(false),
  confidenceThreshold: z.number().default(0.7),
  maxClaimsPerBatch: z.number().default(50)
});

export type Config = z.infer<typeof ConfigSchema>;

export interface VerifyOptions {
  output: string;
  sources?: string;
  model?: string;
  strictMode?: boolean;
  json?: boolean;
}

export interface CheckOptions {
  output: string;
  model?: string;
  json?: boolean;
}

export class HallucinationCheckCore {
  private config: Conf<Config>;
  private detector: HallucinationDetector;
  private lastResult: VerificationResult | null = null;

  constructor() {
    this.config = new Conf<Config>({
      projectName: 'hallucination-check',
      defaults: {
        defaultModel: 'claude-sonnet-4-20250514',
        strictMode: false,
        confidenceThreshold: 0.7,
        maxClaimsPerBatch: 50
      }
    });
    this.detector = new HallucinationDetector();
  }

  getConfig(): Config {
    return this.config.store;
  }

  setConfig(key: keyof Config, value: any): void {
    this.config.set(key, value);
  }

  async verify(options: VerifyOptions): Promise<VerificationResult> {
    let outputText: string;

    if (fs.existsSync(options.output)) {
      outputText = fs.readFileSync(options.output, 'utf-8');
    } else {
      outputText = options.output;
    }

    const config = this.getConfig();

    const result = await this.detector.verify(outputText, {
      sources: options.sources,
      model: options.model || config.defaultModel,
      strictMode: options.strictMode ?? config.strictMode
    });

    this.lastResult = result;
    return result;
  }

  async check(options: CheckOptions): Promise<VerificationResult> {
    let outputText: string;

    if (fs.existsSync(options.output)) {
      outputText = fs.readFileSync(options.output, 'utf-8');
    } else {
      outputText = options.output;
    }

    const config = this.getConfig();

    const result = await this.detector.verify(outputText, {
      model: options.model || config.defaultModel
    });

    this.lastResult = result;
    return result;
  }

  getLastResult(): VerificationResult | null {
    return this.lastResult;
  }

  formatOutput(data: any, json: boolean): string {
    if (json) {
      return JSON.stringify(data, null, 2);
    }

    if (data.hallucinationScore !== undefined) {
      return formatVerificationReport(data);
    }

    return String(data);
  }
}

export const core = new HallucinationCheckCore();
