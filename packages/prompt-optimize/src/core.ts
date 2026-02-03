import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Schemas
export const OptimizeOptionsSchema = z.object({
  model: z.string().default('claude-sonnet-4-20250514'),
  goal: z.enum(['clarity', 'tokens', 'performance']).optional(),
  detailed: z.boolean().optional(),
  numSuggestions: z.number().default(5),
  preserveVariables: z.boolean().optional(),
  aggressive: z.boolean().optional(),
  outputFile: z.string().optional(),
  sampleInput: z.string().optional(),
});

export type OptimizeOptions = z.infer<typeof OptimizeOptionsSchema>;

export interface AnalysisResult {
  file: string;
  content: string;
  stats: {
    characters: number;
    words: number;
    lines: number;
    estimatedTokens: number;
  };
  structure: {
    hasSystemContext: boolean;
    hasExamples: boolean;
    hasConstraints: boolean;
    hasOutputFormat: boolean;
    variableCount: number;
    variables: string[];
  };
  issues: AnalysisIssue[];
  score: number;
  aiAnalysis?: string;
}

export interface AnalysisIssue {
  type: 'warning' | 'suggestion' | 'error';
  category: string;
  message: string;
  line?: number;
}

export interface Suggestion {
  id: number;
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  example?: string;
}

export interface SuggestionsResult {
  file: string;
  goal?: string;
  suggestions: Suggestion[];
  summary: string;
}

export interface RewriteResult {
  file: string;
  original: string;
  rewritten: string;
  goal: string;
  changes: string[];
  tokensBefore: number;
  tokensAfter: number;
  savedTo?: string;
}

export interface ComparisonResult {
  original: string;
  optimized: string;
  originalTokens: number;
  optimizedTokens: number;
  tokenSavings: number;
  savingsPercent: number;
  testResults?: {
    originalTime: number;
    optimizedTime: number;
    originalOutput?: string;
    optimizedOutput?: string;
  };
}

/**
 * Estimate token count
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Read a prompt file
 */
async function readPromptFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return await readFile(filePath, 'utf-8');
}

/**
 * Extract variables from prompt
 */
function extractVariables(content: string): string[] {
  const patterns = [
    /\{\{(\w+)\}\}/g,
    /\{(\w+)\}/g,
    /\$\{(\w+)\}/g,
    /<(\w+)>/g,
  ];

  const variables = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}

/**
 * Analyze prompt structure
 */
function analyzeStructure(content: string): AnalysisResult['structure'] {
  const lowerContent = content.toLowerCase();
  const variables = extractVariables(content);

  return {
    hasSystemContext: lowerContent.includes('you are') ||
      lowerContent.includes('your role') ||
      lowerContent.includes('act as'),
    hasExamples: lowerContent.includes('example:') ||
      lowerContent.includes('for example') ||
      lowerContent.includes('e.g.') ||
      content.includes('```'),
    hasConstraints: lowerContent.includes('do not') ||
      lowerContent.includes('don\'t') ||
      lowerContent.includes('must not') ||
      lowerContent.includes('never'),
    hasOutputFormat: lowerContent.includes('format:') ||
      lowerContent.includes('output format') ||
      lowerContent.includes('respond in') ||
      lowerContent.includes('return as'),
    variableCount: variables.length,
    variables,
  };
}

/**
 * Identify issues in the prompt
 */
function identifyIssues(content: string): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const lines = content.split('\n');

  // Check for common issues
  if (content.length > 4000) {
    issues.push({
      type: 'warning',
      category: 'length',
      message: 'Prompt is very long. Consider breaking it into smaller parts or reducing verbosity.',
    });
  }

  if (!content.toLowerCase().includes('you are') && !content.toLowerCase().includes('your role')) {
    issues.push({
      type: 'suggestion',
      category: 'context',
      message: 'Consider adding a clear role/context statement at the beginning.',
    });
  }

  // Check for repeated phrases
  const words = content.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    if (word.length > 4) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  });

  for (const [word, count] of wordCounts) {
    if (count > 5 && word.length > 5) {
      issues.push({
        type: 'suggestion',
        category: 'redundancy',
        message: `The word "${word}" appears ${count} times. Consider reducing repetition.`,
      });
      break; // Only report one redundancy issue
    }
  }

  // Check for vague instructions
  const vagueWords = ['maybe', 'perhaps', 'might', 'could possibly', 'try to'];
  for (const vague of vagueWords) {
    if (content.toLowerCase().includes(vague)) {
      issues.push({
        type: 'suggestion',
        category: 'clarity',
        message: `Found vague language: "${vague}". Consider using more direct instructions.`,
      });
      break;
    }
  }

  // Check for very long lines
  lines.forEach((line, index) => {
    if (line.length > 200) {
      issues.push({
        type: 'suggestion',
        category: 'readability',
        message: `Line ${index + 1} is very long (${line.length} chars). Consider breaking it up.`,
        line: index + 1,
      });
    }
  });

  return issues;
}

/**
 * Calculate optimization score
 */
function calculateScore(structure: AnalysisResult['structure'], issues: AnalysisIssue[]): number {
  let score = 50;

  // Structure bonuses
  if (structure.hasSystemContext) score += 15;
  if (structure.hasExamples) score += 15;
  if (structure.hasConstraints) score += 10;
  if (structure.hasOutputFormat) score += 10;

  // Issue penalties
  for (const issue of issues) {
    if (issue.type === 'error') score -= 15;
    if (issue.type === 'warning') score -= 10;
    if (issue.type === 'suggestion') score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Analyze a prompt file
 */
export async function analyzePrompt(
  filePath: string,
  options: OptimizeOptions
): Promise<AnalysisResult> {
  const content = await readPromptFile(filePath);
  const structure = analyzeStructure(content);
  const issues = identifyIssues(content);
  const score = calculateScore(structure, issues);

  const result: AnalysisResult = {
    file: filePath,
    content,
    stats: {
      characters: content.length,
      words: content.split(/\s+/).filter(w => w.length > 0).length,
      lines: content.split('\n').length,
      estimatedTokens: estimateTokens(content),
    },
    structure,
    issues,
    score,
  };

  // If detailed analysis requested, use Claude
  if (options.detailed) {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: options.model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analyze this prompt and provide a detailed assessment of its effectiveness. Focus on:
1. Clarity of instructions
2. Potential ambiguities
3. Missing context or examples
4. Optimization opportunities

Prompt to analyze:
"""
${content}
"""

Provide a concise analysis in 2-3 paragraphs.`
      }],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (textContent && textContent.type === 'text') {
      result.aiAnalysis = textContent.text;
    }
  }

  return result;
}

/**
 * Get suggestions for improving a prompt
 */
export async function getSuggestions(
  filePath: string,
  options: OptimizeOptions
): Promise<SuggestionsResult> {
  const content = await readPromptFile(filePath);

  const client = new Anthropic();

  const goalContext = options.goal
    ? `Focus on optimizing for: ${options.goal}`
    : 'Provide general optimization suggestions';

  const response = await client.messages.create({
    model: options.model,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Analyze this prompt and provide ${options.numSuggestions} specific suggestions for improvement.
${goalContext}

For each suggestion, provide:
1. A category (clarity, tokens, structure, examples, constraints)
2. A clear description of the improvement
3. Impact level (high/medium/low)
4. Effort level (high/medium/low)
5. An example of the improvement if applicable

Prompt to analyze:
"""
${content}
"""

Format your response as JSON with this structure:
{
  "suggestions": [
    {
      "id": 1,
      "category": "string",
      "description": "string",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "example": "optional string"
    }
  ],
  "summary": "brief overall summary"
}`
    }],
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    // Extract JSON from the response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      file: filePath,
      goal: options.goal,
      suggestions: parsed.suggestions || [],
      summary: parsed.summary || '',
    };
  } catch {
    // If parsing fails, return a structured error response
    return {
      file: filePath,
      goal: options.goal,
      suggestions: [{
        id: 1,
        category: 'general',
        description: textContent.text,
        impact: 'medium',
        effort: 'medium',
      }],
      summary: 'Could not parse structured suggestions. See description for raw analysis.',
    };
  }
}

/**
 * Rewrite a prompt for better performance
 */
export async function rewritePrompt(
  filePath: string,
  options: OptimizeOptions
): Promise<RewriteResult> {
  const content = await readPromptFile(filePath);
  const variables = extractVariables(content);

  const client = new Anthropic();

  const variableContext = options.preserveVariables && variables.length > 0
    ? `IMPORTANT: Preserve these variable placeholders exactly as they appear: ${variables.join(', ')}`
    : '';

  const aggressiveContext = options.aggressive
    ? 'Apply aggressive optimizations - significantly reduce length while maintaining functionality.'
    : 'Balance optimization with preserving the original intent and style.';

  const goalInstructions = {
    clarity: 'Focus on making instructions clearer and more unambiguous.',
    tokens: 'Focus on reducing token count while maintaining effectiveness.',
    performance: 'Focus on improving overall prompt effectiveness and response quality.',
  };

  const response = await client.messages.create({
    model: options.model,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Rewrite this prompt to improve it.

Goal: ${goalInstructions[options.goal || 'performance']}
${aggressiveContext}
${variableContext}

Original prompt:
"""
${content}
"""

Provide your response as JSON with this structure:
{
  "rewritten": "the improved prompt text",
  "changes": ["list of changes made"]
}`
    }],
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let rewritten: string;
  let changes: string[];

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }
    const parsed = JSON.parse(jsonMatch[0]);
    rewritten = parsed.rewritten || content;
    changes = parsed.changes || [];
  } catch {
    // Fallback: use the entire response as the rewritten prompt
    rewritten = textContent.text;
    changes = ['Rewritten by AI'];
  }

  const result: RewriteResult = {
    file: filePath,
    original: content,
    rewritten,
    goal: options.goal || 'performance',
    changes,
    tokensBefore: estimateTokens(content),
    tokensAfter: estimateTokens(rewritten),
  };

  // Save to output file if specified
  if (options.outputFile) {
    await writeFile(options.outputFile, rewritten, 'utf-8');
    result.savedTo = options.outputFile;
  }

  return result;
}

/**
 * Compare original and optimized prompt performance
 */
export async function compareOptimized(
  filePath: string,
  options: { model: string; sampleInput?: string }
): Promise<ComparisonResult> {
  const original = await readPromptFile(filePath);

  // First, optimize the prompt
  const rewriteResult = await rewritePrompt(filePath, {
    model: options.model,
    goal: 'performance',
    numSuggestions: 5,
  });

  const result: ComparisonResult = {
    original,
    optimized: rewriteResult.rewritten,
    originalTokens: estimateTokens(original),
    optimizedTokens: estimateTokens(rewriteResult.rewritten),
    tokenSavings: estimateTokens(original) - estimateTokens(rewriteResult.rewritten),
    savingsPercent: Math.round(
      ((estimateTokens(original) - estimateTokens(rewriteResult.rewritten)) /
        estimateTokens(original)) * 100
    ),
  };

  // If sample input provided, test both prompts
  if (options.sampleInput) {
    const client = new Anthropic();

    const startOriginal = Date.now();
    const originalResponse = await client.messages.create({
      model: options.model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${original}\n\nInput: ${options.sampleInput}`
      }],
    });
    const endOriginal = Date.now();

    const startOptimized = Date.now();
    const optimizedResponse = await client.messages.create({
      model: options.model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${rewriteResult.rewritten}\n\nInput: ${options.sampleInput}`
      }],
    });
    const endOptimized = Date.now();

    const getTextContent = (response: Anthropic.Message): string => {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text : '';
    };

    result.testResults = {
      originalTime: endOriginal - startOriginal,
      optimizedTime: endOptimized - startOptimized,
      originalOutput: getTextContent(originalResponse),
      optimizedOutput: getTextContent(optimizedResponse),
    };
  }

  return result;
}
