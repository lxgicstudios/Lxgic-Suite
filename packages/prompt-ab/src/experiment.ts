/**
 * Experiment module for prompt-ab
 * Handles experimental design and statistical analysis
 */

export interface VariantResult {
  variantId: string;
  inputId: string;
  input: string;
  output: string;
  metrics: {
    quality: number;
    relevance: number;
    coherence: number;
    length: number;
    responseTime?: number;
  };
  timestamp: string;
}

export interface ExperimentConfig {
  name: string;
  description?: string;
  variantA: {
    name: string;
    prompt: string;
  };
  variantB: {
    name: string;
    prompt: string;
  };
  sampleSize: number;
  confidenceLevel: number;
  metrics: string[];
}

export interface StatisticalResult {
  metric: string;
  variantAMean: number;
  variantBMean: number;
  variantAStdDev: number;
  variantBStdDev: number;
  difference: number;
  percentChange: number;
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: [number, number];
  winner: 'A' | 'B' | 'tie';
}

export interface ExperimentSummary {
  name: string;
  variantA: string;
  variantB: string;
  sampleSize: number;
  totalSamples: number;
  statisticalResults: StatisticalResult[];
  overallWinner: 'A' | 'B' | 'tie';
  confidence: number;
  recommendation: string;
  timestamp: string;
}

export class StatisticsEngine {
  /**
   * Calculate mean of an array
   */
  mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
  }

  /**
   * Calculate variance
   */
  variance(values: number[]): number {
    const std = this.stdDev(values);
    return std * std;
  }

  /**
   * Welch's t-test for unequal variances
   */
  welchTTest(sample1: number[], sample2: number[]): { tStatistic: number; degreesOfFreedom: number } {
    const n1 = sample1.length;
    const n2 = sample2.length;
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const var1 = this.variance(sample1);
    const var2 = this.variance(sample2);

    const se1 = var1 / n1;
    const se2 = var2 / n2;
    const sePooled = Math.sqrt(se1 + se2);

    if (sePooled === 0) {
      return { tStatistic: 0, degreesOfFreedom: n1 + n2 - 2 };
    }

    const tStatistic = (mean1 - mean2) / sePooled;

    // Welch-Satterthwaite degrees of freedom
    const df = Math.pow(se1 + se2, 2) / (
      Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1)
    );

    return { tStatistic, degreesOfFreedom: Math.floor(df) };
  }

  /**
   * Approximate p-value from t-statistic
   * Using approximation for two-tailed test
   */
  approximatePValue(tStatistic: number, df: number): number {
    const absT = Math.abs(tStatistic);

    // Using approximation based on normal distribution for large df
    if (df > 30) {
      // Standard normal approximation
      const z = absT;
      // Approximation of CDF using error function approximation
      const p = 1 - this.normalCDF(z);
      return 2 * p; // Two-tailed
    }

    // For smaller df, use a rougher approximation
    // This is simplified - in production use a proper t-distribution
    const x = df / (df + absT * absT);
    const beta = this.incompleteBeta(x, df / 2, 0.5);
    return beta; // Two-tailed approximation
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Incomplete beta function approximation
   */
  private incompleteBeta(x: number, a: number, b: number): number {
    // Simple approximation for t-test p-values
    if (x === 0) return 0;
    if (x === 1) return 1;

    // Continued fraction approximation (simplified)
    let result = Math.pow(x, a) * Math.pow(1 - x, b) / a;
    return Math.min(1, result * 10); // Rough approximation
  }

  /**
   * Calculate confidence interval for difference in means
   */
  confidenceInterval(
    sample1: number[],
    sample2: number[],
    confidenceLevel: number = 0.95
  ): [number, number] {
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const diff = mean1 - mean2;

    const se1 = this.variance(sample1) / sample1.length;
    const se2 = this.variance(sample2) / sample2.length;
    const sePooled = Math.sqrt(se1 + se2);

    // Z-score for confidence level (approximation)
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    const z = zScores[confidenceLevel] || 1.96;

    const margin = z * sePooled;
    return [diff - margin, diff + margin];
  }

  /**
   * Calculate effect size (Cohen's d)
   */
  cohensD(sample1: number[], sample2: number[]): number {
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const pooledStd = Math.sqrt(
      (this.variance(sample1) + this.variance(sample2)) / 2
    );

    if (pooledStd === 0) return 0;
    return (mean1 - mean2) / pooledStd;
  }

  /**
   * Interpret effect size
   */
  interpretEffectSize(d: number): string {
    const absD = Math.abs(d);
    if (absD < 0.2) return 'negligible';
    if (absD < 0.5) return 'small';
    if (absD < 0.8) return 'medium';
    return 'large';
  }
}

export class ExperimentAnalyzer {
  private stats: StatisticsEngine;

  constructor() {
    this.stats = new StatisticsEngine();
  }

  /**
   * Analyze experiment results
   */
  analyze(
    variantAResults: VariantResult[],
    variantBResults: VariantResult[],
    config: ExperimentConfig
  ): ExperimentSummary {
    const statisticalResults: StatisticalResult[] = [];
    let aWins = 0;
    let bWins = 0;

    for (const metric of config.metrics) {
      const aValues = this.extractMetricValues(variantAResults, metric);
      const bValues = this.extractMetricValues(variantBResults, metric);

      const result = this.analyzeMetric(metric, aValues, bValues, config.confidenceLevel);
      statisticalResults.push(result);

      if (result.isSignificant) {
        if (result.winner === 'A') aWins++;
        else if (result.winner === 'B') bWins++;
      }
    }

    const overallWinner: 'A' | 'B' | 'tie' =
      aWins > bWins ? 'A' :
        bWins > aWins ? 'B' : 'tie';

    return {
      name: config.name,
      variantA: config.variantA.name,
      variantB: config.variantB.name,
      sampleSize: config.sampleSize,
      totalSamples: variantAResults.length + variantBResults.length,
      statisticalResults,
      overallWinner,
      confidence: config.confidenceLevel,
      recommendation: this.generateRecommendation(overallWinner, statisticalResults),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract metric values from results
   */
  private extractMetricValues(results: VariantResult[], metric: string): number[] {
    return results.map(r => {
      const metrics = r.metrics as Record<string, number>;
      return metrics[metric] ?? 0;
    });
  }

  /**
   * Analyze a single metric
   */
  private analyzeMetric(
    metric: string,
    aValues: number[],
    bValues: number[],
    confidenceLevel: number
  ): StatisticalResult {
    const aMean = this.stats.mean(aValues);
    const bMean = this.stats.mean(bValues);
    const aStdDev = this.stats.stdDev(aValues);
    const bStdDev = this.stats.stdDev(bValues);

    const difference = aMean - bMean;
    const percentChange = bMean !== 0 ? ((aMean - bMean) / bMean) * 100 : 0;

    const { tStatistic, degreesOfFreedom } = this.stats.welchTTest(aValues, bValues);
    const pValue = this.stats.approximatePValue(tStatistic, degreesOfFreedom);
    const alpha = 1 - confidenceLevel;
    const isSignificant = pValue < alpha;

    const ci = this.stats.confidenceInterval(aValues, bValues, confidenceLevel);

    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (isSignificant) {
      winner = difference > 0 ? 'A' : 'B';
    }

    return {
      metric,
      variantAMean: aMean,
      variantBMean: bMean,
      variantAStdDev: aStdDev,
      variantBStdDev: bStdDev,
      difference,
      percentChange,
      tStatistic,
      pValue,
      isSignificant,
      confidenceInterval: ci,
      winner
    };
  }

  /**
   * Generate recommendation based on results
   */
  private generateRecommendation(
    winner: 'A' | 'B' | 'tie',
    results: StatisticalResult[]
  ): string {
    const significantResults = results.filter(r => r.isSignificant);

    if (significantResults.length === 0) {
      return 'No statistically significant differences found. Consider increasing sample size or continuing the experiment.';
    }

    if (winner === 'tie') {
      return 'Results are mixed. Some metrics favor A, others favor B. Consider which metrics are most important for your use case.';
    }

    const winningMetrics = significantResults
      .filter(r => r.winner === winner)
      .map(r => r.metric);

    return `Variant ${winner} is the winner based on ${winningMetrics.join(', ')}. Recommend deploying Variant ${winner}.`;
  }

  /**
   * Calculate required sample size for desired power
   */
  calculateRequiredSampleSize(
    expectedEffect: number,
    alpha: number = 0.05,
    power: number = 0.8
  ): number {
    // Using simplified formula for two-sample t-test
    // n = 2 * ((z_alpha + z_beta) / effect)^2

    const zAlpha = 1.96; // For alpha = 0.05
    const zBeta = 0.84; // For power = 0.8

    const n = 2 * Math.pow((zAlpha + zBeta) / expectedEffect, 2);
    return Math.ceil(n);
  }
}

export default ExperimentAnalyzer;
