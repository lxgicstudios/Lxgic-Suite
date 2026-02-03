/**
 * Core module for prompt-eval
 * Handles evaluation logic and result management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MetricsManager, MetricResult, MetricDefinition } from './metrics';

export interface EvalConfig {
  name: string;
  description?: string;
  metrics: string[];
  testCases: TestCase[];
  options?: EvalOptions;
}

export interface TestCase {
  id: string;
  input: string;
  output: string;
  expectedScore?: number;
  metadata?: Record<string, any>;
}

export interface EvalOptions {
  minScore?: number;
  passThreshold?: number;
  aggregationMethod?: 'average' | 'weighted' | 'min' | 'max';
}

export interface EvalResult {
  testCaseId: string;
  input: string;
  output: string;
  metricResults: MetricResult[];
  aggregateScore: number;
  passed: boolean;
  timestamp: string;
}

export interface EvalSummary {
  name: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  metricAverages: Record<string, number>;
  results: EvalResult[];
  timestamp: string;
}

export class PromptEvaluator {
  private metricsManager: MetricsManager;
  private config: EvalConfig | null = null;
  private results: EvalResult[] = [];

  constructor() {
    this.metricsManager = new MetricsManager();
  }

  /**
   * Load evaluation configuration from YAML file
   */
  loadConfig(configPath: string): EvalConfig {
    const fullPath = path.resolve(configPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const config = yaml.load(content) as EvalConfig;

    // Validate config
    this.validateConfig(config);
    this.config = config;

    return config;
  }

  private validateConfig(config: EvalConfig): void {
    if (!config.name) {
      throw new Error('Configuration must have a name');
    }
    if (!config.metrics || config.metrics.length === 0) {
      throw new Error('Configuration must specify at least one metric');
    }
    if (!config.testCases || config.testCases.length === 0) {
      throw new Error('Configuration must include at least one test case');
    }

    // Validate metrics exist
    for (const metricName of config.metrics) {
      if (!this.metricsManager.getMetric(metricName)) {
        throw new Error(`Unknown metric: ${metricName}`);
      }
    }
  }

  /**
   * Run evaluation on all test cases
   */
  runEvaluation(config?: EvalConfig): EvalSummary {
    const evalConfig = config || this.config;
    if (!evalConfig) {
      throw new Error('No configuration loaded');
    }

    const passThreshold = evalConfig.options?.passThreshold ?? 60;
    this.results = [];

    for (const testCase of evalConfig.testCases) {
      const metricResults: MetricResult[] = [];

      for (const metricName of evalConfig.metrics) {
        const result = this.metricsManager.scoreOutput(
          testCase.output,
          testCase.input,
          metricName
        );
        metricResults.push(result);
      }

      const aggregateScore = this.metricsManager.aggregateScores(metricResults);
      const passed = aggregateScore >= passThreshold;

      this.results.push({
        testCaseId: testCase.id,
        input: testCase.input,
        output: testCase.output,
        metricResults,
        aggregateScore,
        passed,
        timestamp: new Date().toISOString()
      });
    }

    return this.generateSummary(evalConfig);
  }

  private generateSummary(config: EvalConfig): EvalSummary {
    const scores = this.results.map(r => r.aggregateScore);
    const passedTests = this.results.filter(r => r.passed).length;

    // Calculate per-metric averages
    const metricAverages: Record<string, number> = {};
    for (const metricName of config.metrics) {
      const metricScores = this.results
        .flatMap(r => r.metricResults)
        .filter(mr => mr.metric === metricName)
        .map(mr => mr.normalizedScore);

      metricAverages[metricName] = metricScores.length > 0
        ? metricScores.reduce((a, b) => a + b, 0) / metricScores.length
        : 0;
    }

    return {
      name: config.name,
      totalTests: this.results.length,
      passedTests,
      failedTests: this.results.length - passedTests,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      metricAverages,
      results: this.results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Score a single output file
   */
  scoreOutputFile(outputPath: string, metrics?: string[]): EvalResult[] {
    const fullPath = path.resolve(outputPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Output file not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    let outputs: Array<{ input: string; output: string; id?: string }>;

    try {
      outputs = JSON.parse(content);
      if (!Array.isArray(outputs)) {
        outputs = [outputs];
      }
    } catch {
      // Treat as single plain text output
      outputs = [{ input: '', output: content, id: 'single' }];
    }

    const metricsToUse = metrics || ['relevance', 'coherence', 'accuracy'];
    const results: EvalResult[] = [];

    for (let i = 0; i < outputs.length; i++) {
      const item = outputs[i];
      const metricResults: MetricResult[] = [];

      for (const metricName of metricsToUse) {
        const result = this.metricsManager.scoreOutput(
          item.output,
          item.input || '',
          metricName
        );
        metricResults.push(result);
      }

      const aggregateScore = this.metricsManager.aggregateScores(metricResults);

      results.push({
        testCaseId: item.id || `output-${i + 1}`,
        input: item.input || '',
        output: item.output,
        metricResults,
        aggregateScore,
        passed: aggregateScore >= 60,
        timestamp: new Date().toISOString()
      });
    }

    return results;
  }

  /**
   * Define a custom metric
   */
  defineMetric(definition: MetricDefinition): void {
    this.metricsManager.defineMetric(definition);
  }

  /**
   * Get available metrics
   */
  getAvailableMetrics(): MetricDefinition[] {
    return this.metricsManager.getAllMetrics();
  }

  /**
   * Export results to file
   */
  exportResults(outputPath: string, summary: EvalSummary): void {
    const fullPath = path.resolve(outputPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, JSON.stringify(summary, null, 2));
  }

  /**
   * Create sample evaluation config
   */
  static createSampleConfig(): EvalConfig {
    return {
      name: 'Sample Evaluation',
      description: 'A sample evaluation configuration',
      metrics: ['relevance', 'coherence', 'accuracy'],
      testCases: [
        {
          id: 'test-1',
          input: 'What is the capital of France?',
          output: 'The capital of France is Paris. Paris is known for the Eiffel Tower and is a major cultural and economic center in Europe.',
          expectedScore: 85
        },
        {
          id: 'test-2',
          input: 'Explain photosynthesis briefly.',
          output: 'Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen.',
          expectedScore: 90
        }
      ],
      options: {
        passThreshold: 60,
        aggregationMethod: 'weighted'
      }
    };
  }

  /**
   * Save sample config to file
   */
  static saveSampleConfig(outputPath: string): void {
    const config = PromptEvaluator.createSampleConfig();
    const yamlContent = yaml.dump(config);
    fs.writeFileSync(path.resolve(outputPath), yamlContent);
  }
}

export default PromptEvaluator;
