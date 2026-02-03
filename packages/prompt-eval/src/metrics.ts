/**
 * Metrics module for prompt-eval
 * Defines and manages evaluation metrics
 */

export interface MetricDefinition {
  name: string;
  description: string;
  type: 'relevance' | 'coherence' | 'accuracy' | 'custom';
  weight: number;
  minScore: number;
  maxScore: number;
  criteria?: string[];
  scoringFunction?: string;
}

export interface MetricResult {
  metric: string;
  score: number;
  normalizedScore: number;
  details?: Record<string, any>;
}

export const DEFAULT_METRICS: Record<string, MetricDefinition> = {
  relevance: {
    name: 'relevance',
    description: 'Measures how relevant the output is to the input prompt',
    type: 'relevance',
    weight: 1.0,
    minScore: 0,
    maxScore: 100,
    criteria: [
      'Directly addresses the question or prompt',
      'Contains information pertinent to the topic',
      'Avoids off-topic or irrelevant content',
      'Maintains focus throughout the response'
    ]
  },
  coherence: {
    name: 'coherence',
    description: 'Measures the logical flow and consistency of the output',
    type: 'coherence',
    weight: 1.0,
    minScore: 0,
    maxScore: 100,
    criteria: [
      'Ideas flow logically from one to the next',
      'Consistent tone and style throughout',
      'Proper use of transitions',
      'Clear structure and organization'
    ]
  },
  accuracy: {
    name: 'accuracy',
    description: 'Measures factual correctness of the output',
    type: 'accuracy',
    weight: 1.0,
    minScore: 0,
    maxScore: 100,
    criteria: [
      'Statements are factually correct',
      'No contradictions within the response',
      'Proper use of technical terms',
      'Correct attribution of sources'
    ]
  }
};

export class MetricsManager {
  private metrics: Map<string, MetricDefinition> = new Map();

  constructor() {
    // Load default metrics
    Object.entries(DEFAULT_METRICS).forEach(([name, metric]) => {
      this.metrics.set(name, metric);
    });
  }

  defineMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
  }

  getMetric(name: string): MetricDefinition | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): MetricDefinition[] {
    return Array.from(this.metrics.values());
  }

  removeMetric(name: string): boolean {
    return this.metrics.delete(name);
  }

  /**
   * Score an output against a specific metric
   * In a real implementation, this would use AI or heuristics
   */
  scoreOutput(output: string, input: string, metricName: string): MetricResult {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      throw new Error(`Unknown metric: ${metricName}`);
    }

    // Simulate scoring based on heuristics
    const score = this.calculateHeuristicScore(output, input, metric);
    const normalizedScore = this.normalizeScore(score, metric);

    return {
      metric: metricName,
      score,
      normalizedScore,
      details: {
        inputLength: input.length,
        outputLength: output.length,
        criteria: metric.criteria
      }
    };
  }

  /**
   * Calculate a heuristic score for demonstration
   * In production, this would use more sophisticated methods
   */
  private calculateHeuristicScore(output: string, input: string, metric: MetricDefinition): number {
    let score = 50; // Base score

    // Length-based adjustments
    if (output.length > 0) {
      score += 10;
    }
    if (output.length > 50) {
      score += 10;
    }
    if (output.length > 200) {
      score += 10;
    }

    // Input relevance check
    const inputWords = input.toLowerCase().split(/\s+/);
    const outputWords = output.toLowerCase().split(/\s+/);
    const matchingWords = inputWords.filter(w => outputWords.includes(w));
    const relevanceBonus = Math.min(20, (matchingWords.length / Math.max(1, inputWords.length)) * 20);
    score += relevanceBonus;

    // Apply metric-specific adjustments
    switch (metric.type) {
      case 'coherence':
        // Check for sentence endings and proper structure
        const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 1) {
          score += 5;
        }
        break;
      case 'accuracy':
        // Penalize very short responses for accuracy
        if (output.length < 20) {
          score -= 10;
        }
        break;
    }

    return Math.max(metric.minScore, Math.min(metric.maxScore, score));
  }

  private normalizeScore(score: number, metric: MetricDefinition): number {
    const range = metric.maxScore - metric.minScore;
    return ((score - metric.minScore) / range) * 100;
  }

  /**
   * Calculate weighted aggregate score from multiple metric results
   */
  aggregateScores(results: MetricResult[]): number {
    if (results.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of results) {
      const metric = this.metrics.get(result.metric);
      const weight = metric?.weight ?? 1.0;
      weightedSum += result.normalizedScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  exportMetrics(): Record<string, MetricDefinition> {
    const exported: Record<string, MetricDefinition> = {};
    this.metrics.forEach((metric, name) => {
      exported[name] = metric;
    });
    return exported;
  }

  importMetrics(metrics: Record<string, MetricDefinition>): void {
    Object.entries(metrics).forEach(([name, metric]) => {
      this.metrics.set(name, metric);
    });
  }
}

export default MetricsManager;
