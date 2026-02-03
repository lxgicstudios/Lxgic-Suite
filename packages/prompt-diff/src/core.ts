import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as Diff from 'diff';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Schemas
export const DiffOptionsSchema = z.object({
  model: z.string().default('claude-sonnet-4-20250514'),
  sampleInput: z.string().optional(),
  contextLines: z.number().default(3),
});

export type DiffOptions = z.infer<typeof DiffOptionsSchema>;

export interface DiffResult {
  file1: string;
  file2: string;
  prompt1Content: string;
  prompt2Content: string;
  changes: Diff.Change[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
  tokenDiff: {
    prompt1Tokens: number;
    prompt2Tokens: number;
    difference: number;
    percentChange: number;
  };
}

export interface ComparisonResult {
  input: string;
  output1: string;
  output2: string;
  outputDiff: Diff.Change[];
  model: string;
  timing: {
    prompt1Time: number;
    prompt2Time: number;
  };
  usage: {
    prompt1InputTokens: number;
    prompt1OutputTokens: number;
    prompt2InputTokens: number;
    prompt2OutputTokens: number;
  };
}

export interface PromptStats {
  characters: number;
  words: number;
  lines: number;
  estimatedTokens: number;
  hasVariables: boolean;
  variables: string[];
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Read a prompt file and return its content
 */
async function readPromptFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  return content;
}

/**
 * Extract variables from a prompt (looks for {{variable}} or {variable} patterns)
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
 * Get statistics for a prompt file
 */
export async function getPromptStats(filePath: string): Promise<PromptStats> {
  const content = await readPromptFile(filePath);
  const variables = extractVariables(content);

  return {
    characters: content.length,
    words: content.split(/\s+/).filter(w => w.length > 0).length,
    lines: content.split('\n').length,
    estimatedTokens: estimateTokens(content),
    hasVariables: variables.length > 0,
    variables,
  };
}

/**
 * Compare two prompt files and return the diff
 */
export async function diffPrompts(
  file1: string,
  file2: string,
  options: DiffOptions
): Promise<DiffResult> {
  const [prompt1Content, prompt2Content] = await Promise.all([
    readPromptFile(file1),
    readPromptFile(file2),
  ]);

  const changes = Diff.diffLines(prompt1Content, prompt2Content, {
    newlineIsToken: false,
  });

  // Calculate stats
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const change of changes) {
    const lineCount = (change.value.match(/\n/g) || []).length + (change.value.endsWith('\n') ? 0 : 1);
    if (change.added) {
      additions += lineCount;
    } else if (change.removed) {
      deletions += lineCount;
    } else {
      unchanged += lineCount;
    }
  }

  const prompt1Tokens = estimateTokens(prompt1Content);
  const prompt2Tokens = estimateTokens(prompt2Content);
  const tokenDifference = prompt2Tokens - prompt1Tokens;
  const percentChange = prompt1Tokens > 0
    ? ((tokenDifference / prompt1Tokens) * 100)
    : 0;

  return {
    file1,
    file2,
    prompt1Content,
    prompt2Content,
    changes,
    stats: {
      additions,
      deletions,
      unchanged,
    },
    tokenDiff: {
      prompt1Tokens,
      prompt2Tokens,
      difference: tokenDifference,
      percentChange: Math.round(percentChange * 100) / 100,
    },
  };
}

/**
 * Run both prompts through Claude and compare outputs
 */
export async function runComparison(
  file1: string,
  file2: string,
  options: DiffOptions
): Promise<ComparisonResult> {
  const [prompt1Content, prompt2Content] = await Promise.all([
    readPromptFile(file1),
    readPromptFile(file2),
  ]);

  const client = new Anthropic();
  const input = options.sampleInput || '';

  // Prepare the full prompts
  const fullPrompt1 = input ? `${prompt1Content}\n\nInput: ${input}` : prompt1Content;
  const fullPrompt2 = input ? `${prompt2Content}\n\nInput: ${input}` : prompt2Content;

  // Run both prompts
  const startTime1 = Date.now();
  const response1 = await client.messages.create({
    model: options.model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: fullPrompt1 }],
  });
  const endTime1 = Date.now();

  const startTime2 = Date.now();
  const response2 = await client.messages.create({
    model: options.model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: fullPrompt2 }],
  });
  const endTime2 = Date.now();

  // Extract text content
  const output1 = response1.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('\n');

  const output2 = response2.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('\n');

  // Diff the outputs
  const outputDiff = Diff.diffLines(output1, output2);

  return {
    input,
    output1,
    output2,
    outputDiff,
    model: options.model,
    timing: {
      prompt1Time: endTime1 - startTime1,
      prompt2Time: endTime2 - startTime2,
    },
    usage: {
      prompt1InputTokens: response1.usage.input_tokens,
      prompt1OutputTokens: response1.usage.output_tokens,
      prompt2InputTokens: response2.usage.input_tokens,
      prompt2OutputTokens: response2.usage.output_tokens,
    },
  };
}
