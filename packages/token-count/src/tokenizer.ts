/**
 * Token counting utilities for various AI models
 */

export interface TokenCount {
  total: number;
  characters: number;
  words: number;
  lines: number;
  ratio: number; // characters per token
}

export interface ModelTokenCount {
  model: string;
  tokens: number;
  estimatedCost?: number;
}

export interface SectionBreakdown {
  name: string;
  content: string;
  tokens: number;
  percentage: number;
}

// Pricing per 1K tokens (approximate as of 2024)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

// Model-specific token multipliers (relative to base GPT tokenization)
const MODEL_MULTIPLIERS: Record<string, number> = {
  'claude-3-opus': 1.0,
  'claude-3-sonnet': 1.0,
  'claude-3-haiku': 1.0,
  'claude-3.5-sonnet': 1.0,
  'gpt-4': 1.0,
  'gpt-4-turbo': 1.0,
  'gpt-3.5-turbo': 1.0,
};

/**
 * Simple tokenizer that approximates BPE tokenization
 * Uses heuristics based on common patterns
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Base estimation: roughly 4 characters per token for English
  let baseTokens = text.length / 4;

  // Adjust for whitespace (whitespace often merges with adjacent tokens)
  const whitespaceMatches = text.match(/\s+/g);
  const whitespaceCount = whitespaceMatches ? whitespaceMatches.length : 0;
  baseTokens -= whitespaceCount * 0.3;

  // Adjust for punctuation (often separate tokens)
  const punctuationMatches = text.match(/[.,!?;:'"()\[\]{}]/g);
  const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
  baseTokens += punctuationCount * 0.2;

  // Adjust for numbers (often split differently)
  const numberMatches = text.match(/\d+/g);
  const numberCount = numberMatches ? numberMatches.reduce((acc, n) => acc + Math.ceil(n.length / 2), 0) : 0;
  baseTokens += numberCount * 0.1;

  // Adjust for code-like content
  const codeIndicators = text.match(/[{}\[\]();=><]+/g);
  if (codeIndicators && codeIndicators.length > 10) {
    baseTokens *= 1.1; // Code typically has more tokens
  }

  // Adjust for special characters
  const specialChars = text.match(/[@#$%^&*_+=|\\/<>~`]/g);
  const specialCount = specialChars ? specialChars.length : 0;
  baseTokens += specialCount * 0.3;

  return Math.max(1, Math.round(baseTokens));
}

/**
 * Count basic text statistics
 */
export function countTextStats(text: string): TokenCount {
  const tokens = estimateTokens(text);
  const characters = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const lines = text.split('\n').length;
  const ratio = characters / Math.max(1, tokens);

  return {
    total: tokens,
    characters,
    words,
    lines,
    ratio: Math.round(ratio * 100) / 100,
  };
}

/**
 * Get token counts for multiple models
 */
export function getModelComparison(text: string): ModelTokenCount[] {
  const baseTokens = estimateTokens(text);
  const models = Object.keys(MODEL_MULTIPLIERS);

  return models.map(model => {
    const tokens = Math.round(baseTokens * MODEL_MULTIPLIERS[model]);
    const pricing = MODEL_PRICING[model];
    const estimatedCost = pricing ? (tokens / 1000) * pricing.input : undefined;

    return {
      model,
      tokens,
      estimatedCost,
    };
  });
}

/**
 * Break down text into sections and count tokens for each
 */
export function getSectionBreakdown(text: string): SectionBreakdown[] {
  const sections: SectionBreakdown[] = [];

  // Try to identify sections by common patterns
  // Headers (markdown style)
  const headerPattern = /^(#{1,6})\s+(.+)$/gm;
  // XML-like tags
  const tagPattern = /<([a-zA-Z_][a-zA-Z0-9_-]*)>/g;
  // Numbered lists
  const numberedPattern = /^\d+\.\s+/gm;

  // Split by double newlines as basic sections
  const rawSections = text.split(/\n\n+/);

  let totalTokens = estimateTokens(text);

  rawSections.forEach((section, index) => {
    if (section.trim().length === 0) return;

    const sectionTokens = estimateTokens(section);
    let sectionName = `Section ${index + 1}`;

    // Try to extract a meaningful name
    const headerMatch = section.match(/^#{1,6}\s+(.+)/);
    if (headerMatch) {
      sectionName = headerMatch[1].trim();
    } else if (section.startsWith('<')) {
      const tagMatch = section.match(/<([a-zA-Z_][a-zA-Z0-9_-]*)/);
      if (tagMatch) {
        sectionName = `<${tagMatch[1]}>`;
      }
    } else {
      // Use first few words
      const firstWords = section.trim().split(/\s+/).slice(0, 5).join(' ');
      if (firstWords.length > 0) {
        sectionName = firstWords.length > 40 ? firstWords.substring(0, 40) + '...' : firstWords;
      }
    }

    sections.push({
      name: sectionName,
      content: section.length > 100 ? section.substring(0, 100) + '...' : section,
      tokens: sectionTokens,
      percentage: Math.round((sectionTokens / totalTokens) * 100),
    });
  });

  return sections;
}

/**
 * Process multiple files and aggregate results
 */
export interface BatchResult {
  file: string;
  tokens: number;
  characters: number;
  words: number;
  error?: string;
}

export interface BatchSummary {
  files: BatchResult[];
  totalTokens: number;
  totalCharacters: number;
  totalWords: number;
  errorCount: number;
}
