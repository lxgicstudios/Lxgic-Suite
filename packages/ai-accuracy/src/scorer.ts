/**
 * Scorer module for ai-accuracy
 * Handles accuracy calculations and metrics
 */

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  specificity: number;
  support: number;
}

export interface ClassMetrics extends ClassificationMetrics {
  className: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
  totalSamples: number;
}

export interface GenerationMetrics {
  exactMatch: number;
  partialMatch: number;
  bleuScore: number;
  rougeL: number;
  semanticSimilarity: number;
}

export class AccuracyScorer {
  /**
   * Calculate classification metrics for binary classification
   */
  calculateBinaryMetrics(
    predictions: string[],
    groundTruth: string[],
    positiveClass: string
  ): ClassificationMetrics {
    if (predictions.length !== groundTruth.length) {
      throw new Error('Predictions and ground truth must have the same length');
    }

    let tp = 0, fp = 0, fn = 0, tn = 0;

    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i];
      const actual = groundTruth[i];

      if (pred === positiveClass && actual === positiveClass) {
        tp++;
      } else if (pred === positiveClass && actual !== positiveClass) {
        fp++;
      } else if (pred !== positiveClass && actual === positiveClass) {
        fn++;
      } else {
        tn++;
      }
    }

    return this.computeMetrics(tp, fp, fn, tn);
  }

  /**
   * Calculate metrics for multi-class classification
   */
  calculateMultiClassMetrics(
    predictions: string[],
    groundTruth: string[]
  ): { overall: ClassificationMetrics; perClass: ClassMetrics[] } {
    if (predictions.length !== groundTruth.length) {
      throw new Error('Predictions and ground truth must have the same length');
    }

    const classes = [...new Set([...predictions, ...groundTruth])];
    const perClassMetrics: ClassMetrics[] = [];

    // Calculate per-class metrics
    for (const className of classes) {
      let tp = 0, fp = 0, fn = 0, tn = 0;

      for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];
        const actual = groundTruth[i];

        if (pred === className && actual === className) {
          tp++;
        } else if (pred === className && actual !== className) {
          fp++;
        } else if (pred !== className && actual === className) {
          fn++;
        } else {
          tn++;
        }
      }

      const metrics = this.computeMetrics(tp, fp, fn, tn);
      perClassMetrics.push({
        className,
        ...metrics,
        truePositives: tp,
        falsePositives: fp,
        falseNegatives: fn,
        trueNegatives: tn
      });
    }

    // Calculate macro-averaged metrics
    const macroMetrics = this.calculateMacroAverage(perClassMetrics);

    return {
      overall: macroMetrics,
      perClass: perClassMetrics
    };
  }

  /**
   * Compute metrics from TP, FP, FN, TN
   */
  private computeMetrics(tp: number, fp: number, fn: number, tn: number): ClassificationMetrics {
    const total = tp + fp + fn + tn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      specificity,
      support: tp + fn
    };
  }

  /**
   * Calculate macro-averaged metrics
   */
  private calculateMacroAverage(classMetrics: ClassMetrics[]): ClassificationMetrics {
    if (classMetrics.length === 0) {
      return { accuracy: 0, precision: 0, recall: 0, f1Score: 0, specificity: 0, support: 0 };
    }

    const sum = classMetrics.reduce((acc, m) => ({
      accuracy: acc.accuracy + m.accuracy,
      precision: acc.precision + m.precision,
      recall: acc.recall + m.recall,
      f1Score: acc.f1Score + m.f1Score,
      specificity: acc.specificity + m.specificity,
      support: acc.support + m.support
    }), { accuracy: 0, precision: 0, recall: 0, f1Score: 0, specificity: 0, support: 0 });

    const n = classMetrics.length;
    return {
      accuracy: sum.accuracy / n,
      precision: sum.precision / n,
      recall: sum.recall / n,
      f1Score: sum.f1Score / n,
      specificity: sum.specificity / n,
      support: sum.support
    };
  }

  /**
   * Generate confusion matrix
   */
  generateConfusionMatrix(predictions: string[], groundTruth: string[]): ConfusionMatrix {
    if (predictions.length !== groundTruth.length) {
      throw new Error('Predictions and ground truth must have the same length');
    }

    const labels = [...new Set([...groundTruth, ...predictions])].sort();
    const labelIndex = new Map(labels.map((l, i) => [l, i]));
    const n = labels.length;

    // Initialize matrix
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    // Fill matrix
    for (let i = 0; i < predictions.length; i++) {
      const actualIdx = labelIndex.get(groundTruth[i])!;
      const predIdx = labelIndex.get(predictions[i])!;
      matrix[actualIdx][predIdx]++;
    }

    return {
      labels,
      matrix,
      totalSamples: predictions.length
    };
  }

  /**
   * Calculate generation/text metrics
   */
  calculateGenerationMetrics(
    outputs: string[],
    references: string[]
  ): GenerationMetrics {
    if (outputs.length !== references.length) {
      throw new Error('Outputs and references must have the same length');
    }

    let exactMatches = 0;
    let partialMatches = 0;
    let totalBleu = 0;
    let totalRougeL = 0;
    let totalSimilarity = 0;

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i].toLowerCase().trim();
      const reference = references[i].toLowerCase().trim();

      // Exact match
      if (output === reference) {
        exactMatches++;
        partialMatches++;
      } else if (output.includes(reference) || reference.includes(output)) {
        partialMatches++;
      }

      // BLEU-like score (simplified 1-gram)
      totalBleu += this.calculateSimplifiedBleu(output, reference);

      // ROUGE-L (longest common subsequence)
      totalRougeL += this.calculateRougeL(output, reference);

      // Semantic similarity (word overlap)
      totalSimilarity += this.calculateWordOverlap(output, reference);
    }

    const n = outputs.length;
    return {
      exactMatch: n > 0 ? exactMatches / n : 0,
      partialMatch: n > 0 ? partialMatches / n : 0,
      bleuScore: n > 0 ? totalBleu / n : 0,
      rougeL: n > 0 ? totalRougeL / n : 0,
      semanticSimilarity: n > 0 ? totalSimilarity / n : 0
    };
  }

  /**
   * Simplified BLEU score (1-gram precision with brevity penalty)
   */
  private calculateSimplifiedBleu(output: string, reference: string): number {
    const outputWords = output.split(/\s+/).filter(w => w.length > 0);
    const refWords = reference.split(/\s+/).filter(w => w.length > 0);

    if (outputWords.length === 0) return 0;

    const refWordSet = new Set(refWords);
    let matches = 0;

    for (const word of outputWords) {
      if (refWordSet.has(word)) {
        matches++;
      }
    }

    const precision = matches / outputWords.length;

    // Brevity penalty
    const bp = outputWords.length >= refWords.length
      ? 1
      : Math.exp(1 - refWords.length / outputWords.length);

    return bp * precision;
  }

  /**
   * ROUGE-L score (longest common subsequence)
   */
  private calculateRougeL(output: string, reference: string): number {
    const outputWords = output.split(/\s+/).filter(w => w.length > 0);
    const refWords = reference.split(/\s+/).filter(w => w.length > 0);

    if (outputWords.length === 0 || refWords.length === 0) return 0;

    const lcs = this.longestCommonSubsequence(outputWords, refWords);

    const precision = lcs / outputWords.length;
    const recall = lcs / refWords.length;

    if (precision + recall === 0) return 0;
    return 2 * precision * recall / (precision + recall);
  }

  /**
   * Calculate LCS length
   */
  private longestCommonSubsequence(a: string[], b: string[]): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate word overlap (Jaccard similarity)
   */
  private calculateWordOverlap(output: string, reference: string): number {
    const outputWords = new Set(output.split(/\s+/).filter(w => w.length > 0));
    const refWords = new Set(reference.split(/\s+/).filter(w => w.length > 0));

    if (outputWords.size === 0 && refWords.size === 0) return 1;
    if (outputWords.size === 0 || refWords.size === 0) return 0;

    const intersection = new Set([...outputWords].filter(w => refWords.has(w)));
    const union = new Set([...outputWords, ...refWords]);

    return intersection.size / union.size;
  }

  /**
   * Analyze errors in predictions
   */
  analyzeErrors(
    predictions: string[],
    groundTruth: string[],
    inputs?: string[]
  ): Array<{
    index: number;
    input?: string;
    predicted: string;
    actual: string;
    errorType: string;
  }> {
    const errors: Array<{
      index: number;
      input?: string;
      predicted: string;
      actual: string;
      errorType: string;
    }> = [];

    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] !== groundTruth[i]) {
        errors.push({
          index: i,
          input: inputs?.[i],
          predicted: predictions[i],
          actual: groundTruth[i],
          errorType: this.categorizeError(predictions[i], groundTruth[i])
        });
      }
    }

    return errors;
  }

  /**
   * Categorize type of error
   */
  private categorizeError(predicted: string, actual: string): string {
    const predLower = predicted.toLowerCase();
    const actualLower = actual.toLowerCase();

    if (predLower === actualLower) {
      return 'case_mismatch';
    }

    if (predLower.includes(actualLower) || actualLower.includes(predLower)) {
      return 'partial_match';
    }

    const predWords = new Set(predLower.split(/\s+/));
    const actualWords = new Set(actualLower.split(/\s+/));
    const overlap = [...predWords].filter(w => actualWords.has(w)).length;

    if (overlap > 0) {
      return 'related';
    }

    return 'complete_mismatch';
  }
}

export default AccuracyScorer;
