import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Schemas
export const PromptConfigSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
  variables: z.record(z.string()).optional(),
});

export const TestConfigSchema = z.object({
  prompts: z.array(PromptConfigSchema).min(1),
  defaults: z.object({
    model: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
  }).optional(),
});

export type PromptConfig = z.infer<typeof PromptConfigSchema>;
export type TestConfig = z.infer<typeof TestConfigSchema>;

export interface RequestResult {
  promptIndex: number;
  success: boolean;
  latency: number;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  timestamp: number;
}

export interface LoadTestConfig {
  rps: number;
  duration: number;
  prompts: PromptConfig[];
  defaults?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  onProgress?: (progress: LoadTestProgress) => void;
  onResult?: (result: RequestResult) => void;
}

export interface LoadTestProgress {
  elapsed: number;
  totalRequests: number;
  completedRequests: number;
  successCount: number;
  errorCount: number;
  currentRps: number;
}

export interface LoadTestResults {
  config: {
    rps: number;
    duration: number;
    promptCount: number;
  };
  summary: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    errorRate: number;
    actualDuration: number;
    actualRps: number;
  };
  latency: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  tokens: {
    totalInput: number;
    totalOutput: number;
    avgInputPerRequest: number;
    avgOutputPerRequest: number;
  };
  errors: {
    [key: string]: number;
  };
  timeline: {
    timestamp: number;
    rps: number;
    avgLatency: number;
    errorRate: number;
  }[];
  startTime: string;
  endTime: string;
}

export class LoadTester {
  private client: Anthropic;
  private results: RequestResult[] = [];
  private running = false;
  private startTime = 0;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async runTest(config: LoadTestConfig): Promise<LoadTestResults> {
    this.results = [];
    this.running = true;
    this.startTime = Date.now();

    const { rps, duration, prompts, defaults, onProgress, onResult } = config;
    const intervalMs = 1000 / rps;
    const endTime = this.startTime + duration * 1000;

    let requestIndex = 0;
    const pendingRequests: Promise<void>[] = [];
    const timelineSnapshots: { timestamp: number; results: RequestResult[] }[] = [];

    // Schedule requests at the specified rate
    const scheduleLoop = async () => {
      while (this.running && Date.now() < endTime) {
        const promptIndex = requestIndex % prompts.length;
        const promptConfig = prompts[promptIndex];

        const requestPromise = this.executeRequest(
          promptConfig,
          defaults,
          promptIndex
        ).then(result => {
          this.results.push(result);
          if (onResult) onResult(result);
        });

        pendingRequests.push(requestPromise);
        requestIndex++;

        // Report progress every 100ms
        if (requestIndex % Math.max(1, Math.floor(rps / 10)) === 0) {
          const elapsed = (Date.now() - this.startTime) / 1000;
          const completed = this.results.length;
          const successes = this.results.filter(r => r.success).length;

          if (onProgress) {
            onProgress({
              elapsed,
              totalRequests: requestIndex,
              completedRequests: completed,
              successCount: successes,
              errorCount: completed - successes,
              currentRps: completed / elapsed,
            });
          }

          // Take timeline snapshot every second
          if (Math.floor(elapsed) > timelineSnapshots.length) {
            timelineSnapshots.push({
              timestamp: Date.now(),
              results: [...this.results],
            });
          }
        }

        // Wait for next request slot
        await this.delay(intervalMs);
      }
    };

    await scheduleLoop();
    this.running = false;

    // Wait for all pending requests to complete (with timeout)
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 30000));
    await Promise.race([Promise.all(pendingRequests), timeout]);

    return this.computeResults(config, timelineSnapshots);
  }

  stop(): void {
    this.running = false;
  }

  private async executeRequest(
    promptConfig: PromptConfig,
    defaults?: LoadTestConfig['defaults'],
    promptIndex: number = 0
  ): Promise<RequestResult> {
    const startTime = Date.now();

    try {
      // Interpolate variables if present
      let prompt = promptConfig.prompt;
      if (promptConfig.variables) {
        for (const [key, value] of Object.entries(promptConfig.variables)) {
          prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
      }

      const model = promptConfig.model || defaults?.model || 'claude-sonnet-4-20250514';
      const maxTokens = promptConfig.maxTokens || defaults?.maxTokens || 1024;

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        messages,
        ...(promptConfig.systemPrompt && { system: promptConfig.systemPrompt }),
        ...(promptConfig.temperature !== undefined && { temperature: promptConfig.temperature }),
      });

      const latency = Date.now() - startTime;

      return {
        promptIndex,
        success: true,
        latency,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        timestamp: startTime,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        promptIndex,
        success: false,
        latency,
        error: errorMessage,
        timestamp: startTime,
      };
    }
  }

  private computeResults(
    config: LoadTestConfig,
    timelineSnapshots: { timestamp: number; results: RequestResult[] }[]
  ): LoadTestResults {
    const endTime = Date.now();
    const actualDuration = (endTime - this.startTime) / 1000;

    const successResults = this.results.filter(r => r.success);
    const errorResults = this.results.filter(r => !r.success);

    // Calculate latency percentiles
    const latencies = this.results.map(r => r.latency).sort((a, b) => a - b);
    const successLatencies = successResults.map(r => r.latency).sort((a, b) => a - b);

    // Error categorization
    const errorCounts: { [key: string]: number } = {};
    for (const result of errorResults) {
      const errorKey = this.categorizeError(result.error || 'Unknown');
      errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
    }

    // Token statistics
    const totalInputTokens = successResults.reduce((sum, r) => sum + (r.inputTokens || 0), 0);
    const totalOutputTokens = successResults.reduce((sum, r) => sum + (r.outputTokens || 0), 0);

    // Timeline
    const timeline = timelineSnapshots.map((snapshot, index) => {
      const prevSnapshot = index > 0 ? timelineSnapshots[index - 1] : null;
      const recentResults = prevSnapshot
        ? snapshot.results.filter(r => r.timestamp > prevSnapshot.timestamp)
        : snapshot.results;

      const successes = recentResults.filter(r => r.success);
      const avgLatency = successes.length > 0
        ? successes.reduce((sum, r) => sum + r.latency, 0) / successes.length
        : 0;

      return {
        timestamp: snapshot.timestamp,
        rps: recentResults.length,
        avgLatency: Math.round(avgLatency),
        errorRate: recentResults.length > 0
          ? (recentResults.filter(r => !r.success).length / recentResults.length) * 100
          : 0,
      };
    });

    return {
      config: {
        rps: config.rps,
        duration: config.duration,
        promptCount: config.prompts.length,
      },
      summary: {
        totalRequests: this.results.length,
        successCount: successResults.length,
        errorCount: errorResults.length,
        errorRate: this.results.length > 0
          ? (errorResults.length / this.results.length) * 100
          : 0,
        actualDuration: Math.round(actualDuration * 100) / 100,
        actualRps: Math.round((this.results.length / actualDuration) * 100) / 100,
      },
      latency: {
        min: Math.min(...latencies, 0),
        max: Math.max(...latencies, 0),
        mean: this.mean(latencies),
        median: this.percentile(latencies, 50),
        p50: this.percentile(successLatencies, 50),
        p90: this.percentile(successLatencies, 90),
        p95: this.percentile(successLatencies, 95),
        p99: this.percentile(successLatencies, 99),
        stdDev: this.stdDev(latencies),
      },
      tokens: {
        totalInput: totalInputTokens,
        totalOutput: totalOutputTokens,
        avgInputPerRequest: successResults.length > 0
          ? Math.round(totalInputTokens / successResults.length)
          : 0,
        avgOutputPerRequest: successResults.length > 0
          ? Math.round(totalOutputTokens / successResults.length)
          : 0,
      },
      errors: errorCounts,
      timeline,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    };
  }

  private categorizeError(error: string): string {
    if (error.includes('rate_limit') || error.includes('429')) {
      return 'rate_limit';
    }
    if (error.includes('timeout') || error.includes('ETIMEDOUT')) {
      return 'timeout';
    }
    if (error.includes('401') || error.includes('authentication')) {
      return 'authentication';
    }
    if (error.includes('500') || error.includes('502') || error.includes('503')) {
      return 'server_error';
    }
    if (error.includes('network') || error.includes('ECONNREFUSED')) {
      return 'network_error';
    }
    return 'other';
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  private mean(arr: number[]): number {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  private stdDev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const avg = this.mean(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.round(Math.sqrt(this.mean(squareDiffs)));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
