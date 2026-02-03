/**
 * Core module for ai-regression
 * Handles baseline management and regression testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { SimilarityTester, ComparisonResult, RegressionConfig, DEFAULT_CONFIG } from './tester';

export interface BaselineEntry {
  id: string;
  input: string;
  output: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface BaselineManifest {
  version: string;
  created: string;
  updated: string;
  entryCount: number;
  config: RegressionConfig;
}

export interface TestResult {
  id: string;
  passed: boolean;
  comparison: ComparisonResult;
  baselineEntry: BaselineEntry;
  currentOutput: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  regressions: number;
  passRate: number;
  results: TestResult[];
  timestamp: string;
  config: RegressionConfig;
}

export class RegressionTester {
  private tester: SimilarityTester;
  private baselines: Map<string, BaselineEntry> = new Map();
  private baselineDir: string | null = null;

  constructor(config: Partial<RegressionConfig> = {}) {
    this.tester = new SimilarityTester(config);
  }

  /**
   * Save baselines to a directory
   */
  saveBaseline(dir: string, entries: BaselineEntry[]): void {
    const fullDir = path.resolve(dir);

    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    // Save manifest
    const manifest: BaselineManifest = {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      entryCount: entries.length,
      config: this.tester.getConfig()
    };

    fs.writeFileSync(
      path.join(fullDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Save entries
    const entriesPath = path.join(fullDir, 'baselines.json');
    fs.writeFileSync(entriesPath, JSON.stringify(entries, null, 2));

    // Also save individual files for each entry
    const entriesDir = path.join(fullDir, 'entries');
    if (!fs.existsSync(entriesDir)) {
      fs.mkdirSync(entriesDir, { recursive: true });
    }

    entries.forEach(entry => {
      const entryPath = path.join(entriesDir, `${entry.id}.json`);
      fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2));
    });

    this.baselineDir = fullDir;
    entries.forEach(entry => this.baselines.set(entry.id, entry));
  }

  /**
   * Load baselines from a directory
   */
  loadBaseline(dir: string): BaselineEntry[] {
    const fullDir = path.resolve(dir);

    if (!fs.existsSync(fullDir)) {
      throw new Error(`Baseline directory not found: ${fullDir}`);
    }

    const entriesPath = path.join(fullDir, 'baselines.json');

    if (!fs.existsSync(entriesPath)) {
      throw new Error(`Baselines file not found: ${entriesPath}`);
    }

    const content = fs.readFileSync(entriesPath, 'utf-8');
    const entries: BaselineEntry[] = JSON.parse(content);

    // Load manifest if exists
    const manifestPath = path.join(fullDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: BaselineManifest = JSON.parse(manifestContent);
      if (manifest.config) {
        this.tester.setConfig(manifest.config);
      }
    }

    this.baselineDir = fullDir;
    this.baselines.clear();
    entries.forEach(entry => this.baselines.set(entry.id, entry));

    return entries;
  }

  /**
   * Load current outputs from file or directory
   */
  loadCurrentOutputs(source: string): Array<{ id: string; output: string }> {
    const fullPath = path.resolve(source);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Current outputs not found: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Load from directory
      const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
      const outputs: Array<{ id: string; output: string }> = [];

      files.forEach(file => {
        const filePath = path.join(fullPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
          outputs.push(...data);
        } else if (data.output) {
          outputs.push({
            id: data.id || path.basename(file, '.json'),
            output: data.output
          });
        }
      });

      return outputs;
    } else {
      // Load from single file
      const content = fs.readFileSync(fullPath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        return data;
      } else if (data.output) {
        return [{
          id: data.id || 'single',
          output: data.output
        }];
      }

      throw new Error('Invalid output file format');
    }
  }

  /**
   * Run regression tests
   */
  runTests(
    currentOutputs: Array<{ id: string; output: string }>,
    threshold?: number
  ): TestSummary {
    const results: TestResult[] = [];
    let regressions = 0;

    for (const current of currentOutputs) {
      const baseline = this.baselines.get(current.id);

      if (!baseline) {
        console.warn(`Warning: No baseline found for id: ${current.id}`);
        continue;
      }

      const comparison = this.tester.compare(
        current.id,
        baseline.output,
        current.output,
        threshold
      );

      const passed = !comparison.isRegression;

      if (!passed) {
        regressions++;
      }

      results.push({
        id: current.id,
        passed,
        comparison,
        baselineEntry: baseline,
        currentOutput: current.output
      });
    }

    const total = results.length;
    const passed = results.filter(r => r.passed).length;

    return {
      total,
      passed,
      failed: total - passed,
      regressions,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      results,
      timestamp: new Date().toISOString(),
      config: this.tester.getConfig()
    };
  }

  /**
   * Compare two directories of outputs
   */
  compareDirectories(
    baselineDir: string,
    currentDir: string,
    threshold?: number
  ): TestSummary {
    this.loadBaseline(baselineDir);
    const currentOutputs = this.loadCurrentOutputs(currentDir);
    return this.runTests(currentOutputs, threshold);
  }

  /**
   * Generate report from test summary
   */
  generateReport(summary: TestSummary): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('AI REGRESSION TEST REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Timestamp: ${summary.timestamp}`);
    lines.push(`Similarity Threshold: ${(summary.config.similarityThreshold * 100).toFixed(0)}%`);
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('SUMMARY');
    lines.push('-'.repeat(60));
    lines.push(`Total Tests: ${summary.total}`);
    lines.push(`Passed: ${summary.passed}`);
    lines.push(`Failed: ${summary.failed}`);
    lines.push(`Regressions Detected: ${summary.regressions}`);
    lines.push(`Pass Rate: ${summary.passRate.toFixed(1)}%`);
    lines.push('');

    if (summary.regressions > 0) {
      lines.push('-'.repeat(60));
      lines.push('REGRESSIONS');
      lines.push('-'.repeat(60));

      const regressions = summary.results.filter(r => !r.passed);
      regressions.forEach(r => {
        lines.push('');
        lines.push(`ID: ${r.id}`);
        lines.push(`Similarity: ${(r.comparison.similarity.score * 100).toFixed(1)}%`);
        lines.push(`Threshold: ${(r.comparison.threshold * 100).toFixed(0)}%`);
        lines.push(`Baseline (truncated): ${r.baselineEntry.output.slice(0, 100)}...`);
        lines.push(`Current (truncated): ${r.currentOutput.slice(0, 100)}...`);
      });
    }

    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('DETAILED RESULTS');
    lines.push('-'.repeat(60));

    summary.results.forEach(r => {
      const status = r.passed ? 'PASS' : 'FAIL';
      const similarity = (r.comparison.similarity.score * 100).toFixed(1);
      lines.push(`[${status}] ${r.id}: ${similarity}% similarity`);
    });

    lines.push('');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  /**
   * Export test summary to JSON
   */
  exportSummary(summary: TestSummary, outputPath: string): void {
    const fullPath = path.resolve(outputPath);
    fs.writeFileSync(fullPath, JSON.stringify(summary, null, 2));
  }

  /**
   * Create sample baseline entries
   */
  static createSampleBaselines(): BaselineEntry[] {
    return [
      {
        id: 'test-1',
        input: 'What is machine learning?',
        output: 'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.',
        timestamp: new Date().toISOString()
      },
      {
        id: 'test-2',
        input: 'Explain neural networks.',
        output: 'Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes that process information using connectionist approaches.',
        timestamp: new Date().toISOString()
      }
    ];
  }

  /**
   * Get baseline count
   */
  getBaselineCount(): number {
    return this.baselines.size;
  }

  /**
   * Get all baseline IDs
   */
  getBaselineIds(): string[] {
    return Array.from(this.baselines.keys());
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RegressionConfig>): void {
    this.tester.setConfig(config);
  }
}

export default RegressionTester;
