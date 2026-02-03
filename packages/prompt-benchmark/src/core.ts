import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { calculateStats, tokensPerSecond, estimateCost, Statistics } from './stats.js';

/**
 * Benchmark configuration schema
 */
export const BenchmarkConfigSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  models: z.array(z.string()).min(1),
  iterations: z.number().positive().default(10),
  warmupIterations: z.number().nonnegative().default(1),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().positive().default(1024),
});

export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;

/**
 * Single iteration result
 */
export interface IterationResult {
  iteration: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  tokensPerSecond: number;
  cost: number;
  success: boolean;
  error?: string;
}

/**
 * Benchmark result for a single model
 */
export interface BenchmarkResult {
  model: string;
  config: {
    prompt: string;
    systemPrompt?: string;
    temperature: number;
    maxTokens: number;
    iterations: number;
  };
  iterations: IterationResult[];
  statistics: {
    latency: Statistics;
    inputTokens: Statistics;
    outputTokens: Statistics;
    tokensPerSecond: Statistics;
    cost: Statistics;
  };
  summary: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalCost: number;
    totalTime: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    averageTokensPerSecond: number;
  };
  timestamp: string;
}

/**
 * Progress callback
 */
export interface BenchmarkProgress {
  model: string;
  iteration: number;
  total: number;
  phase: 'warmup' | 'benchmark';
}

/**
 * Benchmark runner
 */
export class BenchmarkRunner {
  private client: Anthropic;
  private config: BenchmarkConfig;

  constructor(config: BenchmarkConfig) {
    this.config = BenchmarkConfigSchema.parse(config);
    this.client = new Anthropic();
  }

  /**
   * Run benchmark for all models
   */
  async run(
    onProgress?: (progress: BenchmarkProgress) => void
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const model of this.config.models) {
      const result = await this.runModel(model, onProgress);
      results.push(result);
    }

    return results;
  }

  /**
   * Run benchmark for a single model
   */
  private async runModel(
    model: string,
    onProgress?: (progress: BenchmarkProgress) => void
  ): Promise<BenchmarkResult> {
    const iterations: IterationResult[] = [];

    // Warmup runs
    for (let i = 0; i < this.config.warmupIterations; i++) {
      onProgress?.({
        model,
        iteration: i + 1,
        total: this.config.warmupIterations,
        phase: 'warmup',
      });

      await this.runIteration(model);
    }

    // Actual benchmark runs
    for (let i = 0; i < this.config.iterations; i++) {
      onProgress?.({
        model,
        iteration: i + 1,
        total: this.config.iterations,
        phase: 'benchmark',
      });

      const result = await this.runIteration(model, i + 1);
      iterations.push(result);
    }

    // Calculate statistics
    const successfulIterations = iterations.filter(i => i.success);
    const latencies = successfulIterations.map(i => i.latencyMs);
    const inputTokens = successfulIterations.map(i => i.inputTokens);
    const outputTokens = successfulIterations.map(i => i.outputTokens);
    const tps = successfulIterations.map(i => i.tokensPerSecond);
    const costs = successfulIterations.map(i => i.cost);

    const latencyStats = calculateStats(latencies);
    const inputStats = calculateStats(inputTokens);
    const outputStats = calculateStats(outputTokens);
    const tpsStats = calculateStats(tps);
    const costStats = calculateStats(costs);

    const totalCost = costs.reduce((sum, c) => sum + c, 0);
    const totalTime = latencies.reduce((sum, l) => sum + l, 0);

    return {
      model,
      config: {
        prompt: this.config.prompt,
        systemPrompt: this.config.systemPrompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        iterations: this.config.iterations,
      },
      iterations,
      statistics: {
        latency: latencyStats,
        inputTokens: inputStats,
        outputTokens: outputStats,
        tokensPerSecond: tpsStats,
        cost: costStats,
      },
      summary: {
        totalRuns: iterations.length,
        successfulRuns: successfulIterations.length,
        failedRuns: iterations.length - successfulIterations.length,
        totalCost,
        totalTime,
        averageLatency: latencyStats.mean,
        p50Latency: latencyStats.p50,
        p95Latency: latencyStats.p95,
        p99Latency: latencyStats.p99,
        averageTokensPerSecond: tpsStats.mean,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run a single iteration
   */
  private async runIteration(
    model: string,
    iterationNumber: number = 0
  ): Promise<IterationResult> {
    const startTime = performance.now();

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
        messages: [{ role: 'user', content: this.config.prompt }],
      });

      const latencyMs = performance.now() - startTime;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const tps = tokensPerSecond(outputTokens, latencyMs);
      const cost = estimateCost(model, inputTokens, outputTokens);

      return {
        iteration: iterationNumber,
        latencyMs,
        inputTokens,
        outputTokens,
        tokensPerSecond: tps,
        cost,
        success: true,
      };
    } catch (error) {
      const latencyMs = performance.now() - startTime;

      return {
        iteration: iterationNumber,
        latencyMs,
        inputTokens: 0,
        outputTokens: 0,
        tokensPerSecond: 0,
        cost: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export default BenchmarkRunner;
