/**
 * Tester module for ai-regression
 * Handles similarity calculations and comparison logic
 */

export interface SimilarityResult {
  score: number;
  method: string;
  details: {
    exactMatch: boolean;
    lengthRatio: number;
    wordOverlap: number;
    characterSimilarity: number;
  };
}

export interface ComparisonResult {
  id: string;
  baseline: string;
  current: string;
  similarity: SimilarityResult;
  isRegression: boolean;
  threshold: number;
}

export interface RegressionConfig {
  similarityThreshold: number;
  methods: ('exact' | 'levenshtein' | 'jaccard' | 'cosine')[];
  caseSensitive: boolean;
  ignoreWhitespace: boolean;
}

export const DEFAULT_CONFIG: RegressionConfig = {
  similarityThreshold: 0.85,
  methods: ['jaccard', 'levenshtein'],
  caseSensitive: false,
  ignoreWhitespace: true
};

export class SimilarityTester {
  private config: RegressionConfig;

  constructor(config: Partial<RegressionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Normalize text based on configuration
   */
  private normalizeText(text: string): string {
    let normalized = text;

    if (!this.config.caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    if (this.config.ignoreWhitespace) {
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    return normalized;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate Levenshtein similarity (0-1)
   */
  levenshteinSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);

    if (s1 === s2) return 1;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(s1, s2);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate Jaccard similarity based on word tokens
   */
  jaccardSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);

    const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 0));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity based on character n-grams
   */
  cosineSimilarity(str1: string, str2: string, n: number = 2): number {
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);

    const getNgrams = (s: string): Map<string, number> => {
      const ngrams = new Map<string, number>();
      for (let i = 0; i <= s.length - n; i++) {
        const ngram = s.slice(i, i + n);
        ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
      }
      return ngrams;
    };

    const ngrams1 = getNgrams(s1);
    const ngrams2 = getNgrams(s2);

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    ngrams1.forEach((count, ngram) => {
      norm1 += count * count;
      if (ngrams2.has(ngram)) {
        dotProduct += count * ngrams2.get(ngram)!;
      }
    });

    ngrams2.forEach(count => {
      norm2 += count * count;
    });

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Check for exact match
   */
  exactMatch(str1: string, str2: string): boolean {
    return this.normalizeText(str1) === this.normalizeText(str2);
  }

  /**
   * Calculate comprehensive similarity
   */
  calculateSimilarity(baseline: string, current: string): SimilarityResult {
    const s1 = this.normalizeText(baseline);
    const s2 = this.normalizeText(current);

    const exact = this.exactMatch(baseline, current);
    const lengthRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length || 1);

    // Calculate using configured methods
    const scores: number[] = [];

    if (this.config.methods.includes('levenshtein')) {
      scores.push(this.levenshteinSimilarity(baseline, current));
    }
    if (this.config.methods.includes('jaccard')) {
      scores.push(this.jaccardSimilarity(baseline, current));
    }
    if (this.config.methods.includes('cosine')) {
      scores.push(this.cosineSimilarity(baseline, current));
    }

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : exact ? 1 : 0;

    return {
      score: avgScore,
      method: this.config.methods.join('+'),
      details: {
        exactMatch: exact,
        lengthRatio,
        wordOverlap: this.jaccardSimilarity(baseline, current),
        characterSimilarity: this.levenshteinSimilarity(baseline, current)
      }
    };
  }

  /**
   * Compare baseline and current outputs
   */
  compare(
    id: string,
    baseline: string,
    current: string,
    threshold?: number
  ): ComparisonResult {
    const actualThreshold = threshold ?? this.config.similarityThreshold;
    const similarity = this.calculateSimilarity(baseline, current);

    return {
      id,
      baseline,
      current,
      similarity,
      isRegression: similarity.score < actualThreshold,
      threshold: actualThreshold
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RegressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RegressionConfig {
    return { ...this.config };
  }
}

export default SimilarityTester;
