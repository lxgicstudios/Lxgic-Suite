/**
 * Token optimization utilities for prompt compression
 */

export interface OptimizationResult {
  original: string;
  optimized: string;
  originalTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  percentSaved: number;
  appliedOptimizations: string[];
}

export interface Suggestion {
  type: 'whitespace' | 'redundancy' | 'verbose' | 'structure' | 'abbreviation';
  description: string;
  original: string;
  suggested: string;
  tokenSavings: number;
  line?: number;
}

export interface AnalysisResult {
  tokenCount: number;
  characterCount: number;
  lineCount: number;
  whitespaceRatio: number;
  avgLineLength: number;
  redundantPhrases: string[];
  verbosePhrases: string[];
  optimizationPotential: 'low' | 'medium' | 'high';
  estimatedSavings: number;
}

// Common verbose phrases and their shorter alternatives
const VERBOSE_REPLACEMENTS: [RegExp, string][] = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bfor the purpose of\b/gi, 'for'],
  [/\bin the event that\b/gi, 'if'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bin close proximity to\b/gi, 'near'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba small number of\b/gi, 'few'],
  [/\bis able to\b/gi, 'can'],
  [/\bis unable to\b/gi, 'cannot'],
  [/\bmake sure that\b/gi, 'ensure'],
  [/\bin the process of\b/gi, 'currently'],
  [/\bwith the exception of\b/gi, 'except'],
  [/\bin spite of\b/gi, 'despite'],
  [/\bfor the reason that\b/gi, 'because'],
  [/\bby means of\b/gi, 'by'],
  [/\bin accordance with\b/gi, 'per'],
  [/\buntil such time as\b/gi, 'until'],
  [/\bIt is important to note that\b/gi, 'Note:'],
  [/\bPlease be advised that\b/gi, ''],
  [/\bI would like to\b/gi, 'I'],
  [/\bI am going to\b/gi, "I'll"],
  [/\bYou will need to\b/gi, 'You must'],
  [/\bIn this case,?\b/gi, 'Here,'],
  [/\bAs a matter of fact\b/gi, 'Actually'],
  [/\bAt the end of the day\b/gi, 'Ultimately'],
  [/\bTake into consideration\b/gi, 'Consider'],
  [/\bMake a decision\b/gi, 'Decide'],
  [/\bReach a conclusion\b/gi, 'Conclude'],
  [/\bGive assistance to\b/gi, 'Help'],
  [/\bHave a discussion about\b/gi, 'Discuss'],
];

// Common redundant patterns
const REDUNDANT_PATTERNS: [RegExp, string][] = [
  [/\bactual fact\b/gi, 'fact'],
  [/\badvance planning\b/gi, 'planning'],
  [/\bbasic fundamentals\b/gi, 'fundamentals'],
  [/\bcompletely eliminate\b/gi, 'eliminate'],
  [/\bcurrently existing\b/gi, 'existing'],
  [/\bend result\b/gi, 'result'],
  [/\bexact same\b/gi, 'same'],
  [/\bfinal outcome\b/gi, 'outcome'],
  [/\bfuture plans\b/gi, 'plans'],
  [/\bpast history\b/gi, 'history'],
  [/\bpossible potential\b/gi, 'potential'],
  [/\brevert back\b/gi, 'revert'],
  [/\btrue fact\b/gi, 'fact'],
  [/\bunexpected surprise\b/gi, 'surprise'],
  [/\bvery unique\b/gi, 'unique'],
  [/\bclose proximity\b/gi, 'proximity'],
  [/\beach and every\b/gi, 'each'],
  [/\bfirst and foremost\b/gi, 'first'],
  [/\bone and only\b/gi, 'only'],
];

/**
 * Estimate token count for text
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;

  // Base estimation: roughly 4 characters per token
  let tokens = text.length / 4;

  // Adjust for whitespace
  const whitespaceMatches = text.match(/\s+/g);
  const whitespaceCount = whitespaceMatches ? whitespaceMatches.length : 0;
  tokens -= whitespaceCount * 0.3;

  // Adjust for punctuation
  const punctuationMatches = text.match(/[.,!?;:'"()\[\]{}]/g);
  const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;
  tokens += punctuationCount * 0.2;

  return Math.max(1, Math.round(tokens));
}

/**
 * Remove redundant whitespace
 */
export function removeRedundantWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')           // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n')        // More than 2 newlines to 2
    .replace(/[ \t]+\n/g, '\n')        // Trailing spaces before newlines
    .replace(/\n[ \t]+/g, '\n')        // Leading spaces after newlines
    .trim();
}

/**
 * Apply verbose phrase replacements
 */
export function shortenVerbosePhrases(text: string): { text: string; applied: string[] } {
  let result = text;
  const applied: string[] = [];

  for (const [pattern, replacement] of VERBOSE_REPLACEMENTS) {
    if (pattern.test(result)) {
      applied.push(`"${pattern.source}" -> "${replacement}"`);
      result = result.replace(pattern, replacement);
    }
  }

  return { text: result, applied };
}

/**
 * Remove redundant phrases
 */
export function removeRedundantPhrases(text: string): { text: string; applied: string[] } {
  let result = text;
  const applied: string[] = [];

  for (const [pattern, replacement] of REDUNDANT_PATTERNS) {
    if (pattern.test(result)) {
      applied.push(`"${pattern.source}" -> "${replacement}"`);
      result = result.replace(pattern, replacement);
    }
  }

  return { text: result, applied };
}

/**
 * Optimize XML/markdown structure
 */
export function optimizeStructure(text: string): { text: string; applied: string[] } {
  let result = text;
  const applied: string[] = [];

  // Remove unnecessary blank lines within XML tags
  const xmlTagPattern = /<([a-zA-Z_][a-zA-Z0-9_-]*)>\s*\n\s*\n+/g;
  if (xmlTagPattern.test(result)) {
    applied.push('Removed blank lines after opening XML tags');
    result = result.replace(/<([a-zA-Z_][a-zA-Z0-9_-]*)>\s*\n\s*\n+/g, '<$1>\n');
  }

  // Remove unnecessary blank lines before closing XML tags
  const closingXmlPattern = /\n\s*\n+\s*<\/([a-zA-Z_][a-zA-Z0-9_-]*)>/g;
  if (closingXmlPattern.test(result)) {
    applied.push('Removed blank lines before closing XML tags');
    result = result.replace(/\n\s*\n+\s*<\/([a-zA-Z_][a-zA-Z0-9_-]*)>/g, '\n</$1>');
  }

  // Simplify markdown headers with extra whitespace
  const mdHeaderPattern = /^(#{1,6})[ \t]+/gm;
  const mdHeaderMatch = result.match(mdHeaderPattern);
  if (mdHeaderMatch && mdHeaderMatch.some(m => m.length > 3)) {
    applied.push('Normalized markdown header spacing');
    result = result.replace(/^(#{1,6})[ \t]+/gm, '$1 ');
  }

  return { text: result, applied };
}

/**
 * Compress text by applying all optimizations
 */
export function compressText(text: string): OptimizationResult {
  const originalTokens = estimateTokens(text);
  const appliedOptimizations: string[] = [];

  // Apply optimizations in sequence
  let result = text;

  // 1. Remove redundant whitespace
  const whitespaceOptimized = removeRedundantWhitespace(result);
  if (whitespaceOptimized !== result) {
    appliedOptimizations.push('Removed redundant whitespace');
    result = whitespaceOptimized;
  }

  // 2. Apply verbose phrase replacements
  const verboseResult = shortenVerbosePhrases(result);
  if (verboseResult.applied.length > 0) {
    appliedOptimizations.push(`Shortened ${verboseResult.applied.length} verbose phrases`);
    result = verboseResult.text;
  }

  // 3. Remove redundant phrases
  const redundantResult = removeRedundantPhrases(result);
  if (redundantResult.applied.length > 0) {
    appliedOptimizations.push(`Removed ${redundantResult.applied.length} redundancies`);
    result = redundantResult.text;
  }

  // 4. Optimize structure
  const structureResult = optimizeStructure(result);
  if (structureResult.applied.length > 0) {
    appliedOptimizations.push(...structureResult.applied);
    result = structureResult.text;
  }

  const optimizedTokens = estimateTokens(result);
  const tokensSaved = originalTokens - optimizedTokens;
  const percentSaved = originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0;

  return {
    original: text,
    optimized: result,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    percentSaved,
    appliedOptimizations,
  };
}

/**
 * Analyze text for optimization opportunities
 */
export function analyzeText(text: string): AnalysisResult {
  const tokenCount = estimateTokens(text);
  const characterCount = text.length;
  const lines = text.split('\n');
  const lineCount = lines.length;

  // Calculate whitespace ratio
  const whitespaceMatches = text.match(/\s/g);
  const whitespaceCount = whitespaceMatches ? whitespaceMatches.length : 0;
  const whitespaceRatio = characterCount > 0 ? whitespaceCount / characterCount : 0;

  // Calculate average line length
  const avgLineLength = lineCount > 0 ? characterCount / lineCount : 0;

  // Find verbose phrases
  const verbosePhrases: string[] = [];
  for (const [pattern] of VERBOSE_REPLACEMENTS) {
    const matches = text.match(pattern);
    if (matches) {
      verbosePhrases.push(...matches);
    }
  }

  // Find redundant phrases
  const redundantPhrases: string[] = [];
  for (const [pattern] of REDUNDANT_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      redundantPhrases.push(...matches);
    }
  }

  // Estimate potential savings
  const compressed = compressText(text);
  const estimatedSavings = compressed.percentSaved;

  // Determine optimization potential
  let optimizationPotential: 'low' | 'medium' | 'high';
  if (estimatedSavings < 5) {
    optimizationPotential = 'low';
  } else if (estimatedSavings < 15) {
    optimizationPotential = 'medium';
  } else {
    optimizationPotential = 'high';
  }

  return {
    tokenCount,
    characterCount,
    lineCount,
    whitespaceRatio,
    avgLineLength,
    redundantPhrases: [...new Set(redundantPhrases)],
    verbosePhrases: [...new Set(verbosePhrases)],
    optimizationPotential,
    estimatedSavings,
  };
}

/**
 * Get detailed suggestions for optimization
 */
export function getSuggestions(text: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lines = text.split('\n');

  // Check for verbose phrases
  for (const [pattern, replacement] of VERBOSE_REPLACEMENTS) {
    let match;
    const globalPattern = new RegExp(pattern.source, 'gi');
    while ((match = globalPattern.exec(text)) !== null) {
      const lineIndex = text.substring(0, match.index).split('\n').length;
      const tokenSavings = estimateTokens(match[0]) - estimateTokens(replacement);

      suggestions.push({
        type: 'verbose',
        description: `Replace verbose phrase "${match[0]}" with "${replacement}"`,
        original: match[0],
        suggested: replacement,
        tokenSavings,
        line: lineIndex,
      });
    }
  }

  // Check for redundant phrases
  for (const [pattern, replacement] of REDUNDANT_PATTERNS) {
    let match;
    const globalPattern = new RegExp(pattern.source, 'gi');
    while ((match = globalPattern.exec(text)) !== null) {
      const lineIndex = text.substring(0, match.index).split('\n').length;
      const tokenSavings = estimateTokens(match[0]) - estimateTokens(replacement);

      suggestions.push({
        type: 'redundancy',
        description: `Remove redundancy: "${match[0]}" -> "${replacement}"`,
        original: match[0],
        suggested: replacement,
        tokenSavings,
        line: lineIndex,
      });
    }
  }

  // Check for whitespace issues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Multiple consecutive spaces
    if (/  +/.test(line)) {
      suggestions.push({
        type: 'whitespace',
        description: 'Multiple consecutive spaces found',
        original: line.match(/  +/)?.[0] || '  ',
        suggested: ' ',
        tokenSavings: 1,
        line: i + 1,
      });
    }

    // Trailing whitespace
    if (/\s+$/.test(line)) {
      suggestions.push({
        type: 'whitespace',
        description: 'Trailing whitespace found',
        original: line,
        suggested: line.trimEnd(),
        tokenSavings: 1,
        line: i + 1,
      });
    }
  }

  // Check for consecutive blank lines
  const blankLinePattern = /\n\n\n+/g;
  let match;
  while ((match = blankLinePattern.exec(text)) !== null) {
    suggestions.push({
      type: 'whitespace',
      description: `${match[0].split('\n').length - 1} consecutive blank lines could be reduced to 1`,
      original: match[0],
      suggested: '\n\n',
      tokenSavings: match[0].split('\n').length - 2,
    });
  }

  return suggestions.sort((a, b) => b.tokenSavings - a.tokenSavings);
}
