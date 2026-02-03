/**
 * Core module for prompt-ab
 * Handles A/B experiment execution and management
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ExperimentAnalyzer,
  ExperimentConfig,
  ExperimentSummary,
  VariantResult,
  StatisticalResult
} from './experiment';

export interface ABTestInput {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface ABTestConfig {
  name: string;
  description?: string;
  promptA: string;
  promptB: string;
  samples: number;
  confidenceLevel: number;
  metrics: string[];
}

export interface ExperimentResults {
  config: ABTestConfig;
  variantAResults: VariantResult[];
  variantBResults: VariantResult[];
  summary?: ExperimentSummary;
  timestamp: string;
}

export class ABTester {
  private analyzer: ExperimentAnalyzer;
  private results: ExperimentResults | null = null;

  constructor() {
    this.analyzer = new ExperimentAnalyzer();
  }

  /**
   * Load prompt from file
   */
  loadPrompt(filePath: string): string {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Prompt file not found: ${fullPath}`);
    }

    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * Load inputs from file
   */
  loadInputs(filePath: string): ABTestInput[] {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Inputs file not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        id: item.id || `input-${index + 1}`,
        text: item.text || item.input || item,
        metadata: item.metadata
      }));
    }

    throw new Error('Inputs file must contain an array');
  }

  /**
   * Generate simulated output and metrics
   * In production, this would call actual AI models
   */
  private simulateOutput(prompt: string, input: string): { output: string; metrics: VariantResult['metrics'] } {
    // Simulate output based on prompt and input
    const combinedLength = prompt.length + input.length;
    const outputLength = Math.floor(50 + Math.random() * 150);

    const output = `Simulated response for: "${input.slice(0, 50)}..." using prompt variant. ` +
      'Lorem ipsum '.repeat(Math.floor(outputLength / 12));

    // Simulate metrics with some variance based on prompt characteristics
    const baseQuality = 60 + Math.random() * 30;
    const promptBonus = prompt.length > 100 ? 5 : 0;

    return {
      output: output.trim(),
      metrics: {
        quality: Math.min(100, baseQuality + promptBonus + (Math.random() * 10 - 5)),
        relevance: Math.min(100, 65 + Math.random() * 30),
        coherence: Math.min(100, 70 + Math.random() * 25),
        length: output.length,
        responseTime: 100 + Math.random() * 500
      }
    };
  }

  /**
   * Run A/B experiment
   */
  runExperiment(config: ABTestConfig, inputs?: ABTestInput[]): ExperimentResults {
    const testInputs = inputs || this.generateSampleInputs(config.samples);
    const variantAResults: VariantResult[] = [];
    const variantBResults: VariantResult[] = [];

    // Run variant A
    for (const input of testInputs) {
      const { output, metrics } = this.simulateOutput(config.promptA, input.text);
      variantAResults.push({
        variantId: 'A',
        inputId: input.id,
        input: input.text,
        output,
        metrics,
        timestamp: new Date().toISOString()
      });
    }

    // Run variant B
    for (const input of testInputs) {
      const { output, metrics } = this.simulateOutput(config.promptB, input.text);
      variantBResults.push({
        variantId: 'B',
        inputId: input.id,
        input: input.text,
        output,
        metrics,
        timestamp: new Date().toISOString()
      });
    }

    this.results = {
      config,
      variantAResults,
      variantBResults,
      timestamp: new Date().toISOString()
    };

    return this.results;
  }

  /**
   * Generate sample inputs for testing
   */
  private generateSampleInputs(count: number): ABTestInput[] {
    const templates = [
      'What is the meaning of',
      'Explain the concept of',
      'How does',
      'Why is',
      'Describe',
      'Compare and contrast',
      'What are the benefits of',
      'How can I improve',
      'What is the difference between',
      'Summarize'
    ];

    const topics = [
      'machine learning',
      'artificial intelligence',
      'data science',
      'cloud computing',
      'software engineering',
      'product management',
      'user experience',
      'system design',
      'algorithms',
      'databases'
    ];

    const inputs: ABTestInput[] = [];
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const topic = topics[i % topics.length];
      inputs.push({
        id: `sample-${i + 1}`,
        text: `${template} ${topic}?`
      });
    }

    return inputs;
  }

  /**
   * Analyze experiment results
   */
  analyzeResults(results?: ExperimentResults): ExperimentSummary {
    const experimentResults = results || this.results;

    if (!experimentResults) {
      throw new Error('No experiment results available. Run an experiment first.');
    }

    const experimentConfig: ExperimentConfig = {
      name: experimentResults.config.name,
      description: experimentResults.config.description,
      variantA: {
        name: 'Variant A',
        prompt: experimentResults.config.promptA
      },
      variantB: {
        name: 'Variant B',
        prompt: experimentResults.config.promptB
      },
      sampleSize: experimentResults.config.samples,
      confidenceLevel: experimentResults.config.confidenceLevel,
      metrics: experimentResults.config.metrics
    };

    const summary = this.analyzer.analyze(
      experimentResults.variantAResults,
      experimentResults.variantBResults,
      experimentConfig
    );

    if (this.results) {
      this.results.summary = summary;
    }

    return summary;
  }

  /**
   * Load results from file
   */
  loadResults(filePath: string): ExperimentResults {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Results file not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    this.results = JSON.parse(content);
    return this.results!;
  }

  /**
   * Export results to file
   */
  exportResults(filePath: string, results?: ExperimentResults): void {
    const experimentResults = results || this.results;

    if (!experimentResults) {
      throw new Error('No results to export');
    }

    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, JSON.stringify(experimentResults, null, 2));
  }

  /**
   * Generate human-readable report
   */
  generateReport(summary: ExperimentSummary): string {
    const lines: string[] = [];

    lines.push('='.repeat(70));
    lines.push('A/B TEST REPORT');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`Experiment: ${summary.name}`);
    lines.push(`Timestamp: ${summary.timestamp}`);
    lines.push(`Confidence Level: ${(summary.confidence * 100).toFixed(0)}%`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('VARIANTS');
    lines.push('-'.repeat(70));
    lines.push(`Variant A: ${summary.variantA}`);
    lines.push(`Variant B: ${summary.variantB}`);
    lines.push(`Sample Size: ${summary.sampleSize} per variant`);
    lines.push(`Total Samples: ${summary.totalSamples}`);
    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('RESULTS');
    lines.push('-'.repeat(70));
    lines.push('');

    for (const result of summary.statisticalResults) {
      lines.push(`Metric: ${result.metric.toUpperCase()}`);
      lines.push(`  Variant A Mean: ${result.variantAMean.toFixed(2)} (SD: ${result.variantAStdDev.toFixed(2)})`);
      lines.push(`  Variant B Mean: ${result.variantBMean.toFixed(2)} (SD: ${result.variantBStdDev.toFixed(2)})`);
      lines.push(`  Difference: ${result.difference.toFixed(2)} (${result.percentChange.toFixed(1)}%)`);
      lines.push(`  t-statistic: ${result.tStatistic.toFixed(3)}`);
      lines.push(`  p-value: ${result.pValue.toFixed(4)}`);
      lines.push(`  Significant: ${result.isSignificant ? 'YES' : 'NO'}`);
      lines.push(`  95% CI: [${result.confidenceInterval[0].toFixed(2)}, ${result.confidenceInterval[1].toFixed(2)}]`);
      lines.push(`  Winner: ${result.winner === 'tie' ? 'TIE' : `Variant ${result.winner}`}`);
      lines.push('');
    }

    lines.push('-'.repeat(70));
    lines.push('CONCLUSION');
    lines.push('-'.repeat(70));
    lines.push('');
    lines.push(`Overall Winner: ${summary.overallWinner === 'tie' ? 'TIE (No Clear Winner)' : `Variant ${summary.overallWinner}`}`);
    lines.push('');
    lines.push('Recommendation:');
    lines.push(summary.recommendation);
    lines.push('');
    lines.push('='.repeat(70));

    return lines.join('\n');
  }

  /**
   * Get current results
   */
  getResults(): ExperimentResults | null {
    return this.results;
  }

  /**
   * Calculate required sample size
   */
  calculateSampleSize(expectedEffect: number): number {
    return this.analyzer.calculateRequiredSampleSize(expectedEffect);
  }
}

export default ABTester;
