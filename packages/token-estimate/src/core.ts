import * as fs from 'fs';
import * as path from 'path';
import { MODEL_PRICING, ModelPricing, calculateCost, formatCurrency, getModelPricing, getAllModels } from './pricing';

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  model: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface CompareResult {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  contextWindow: number;
}

export interface BatchResult {
  file: string;
  inputTokens: number;
  estimates: {
    model: string;
    cost: number;
  }[];
}

/**
 * Simple token estimation using character count
 * Approximation: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  // More sophisticated estimation
  // Count words and characters
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const chars = text.length;

  // Average tokens = roughly 0.75 * words for English
  // Or approximately chars / 4
  const wordBasedEstimate = Math.ceil(words * 0.75);
  const charBasedEstimate = Math.ceil(chars / 4);

  // Use average of both methods
  return Math.ceil((wordBasedEstimate + charBasedEstimate) / 2);
}

/**
 * Estimate tokens for code (different ratio)
 */
export function estimateCodeTokens(code: string): number {
  // Code typically has more tokens per character due to syntax
  const lines = code.split('\n').length;
  const chars = code.length;

  // Estimate based on code structure
  return Math.ceil(chars / 3.5);
}

/**
 * Read file and estimate tokens
 */
export function estimateFileTokens(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  const codeExtensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php'];

  if (codeExtensions.includes(ext)) {
    return estimateCodeTokens(content);
  }

  return estimateTokens(content);
}

/**
 * Estimate cost for a single model
 */
export function estimate(
  filePath: string,
  modelId: string,
  outputRatio: number = 1.5
): TokenEstimate | null {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const inputTokens = estimateFileTokens(filePath);
  const outputTokens = Math.ceil(inputTokens * outputRatio);

  const cost = calculateCost(inputTokens, outputTokens, modelId);
  if (!cost) {
    throw new Error(`Unknown model: ${modelId}. Available models: ${getAllModels().join(', ')}`);
  }

  return {
    inputTokens,
    outputTokens,
    model: modelId,
    inputCost: cost.inputCost,
    outputCost: cost.outputCost,
    totalCost: cost.totalCost
  };
}

/**
 * Compare costs across all models
 */
export function compare(
  filePath: string,
  outputRatio: number = 1.5
): CompareResult[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const inputTokens = estimateFileTokens(filePath);
  const outputTokens = Math.ceil(inputTokens * outputRatio);

  const results: CompareResult[] = [];

  for (const [modelId, pricing] of Object.entries(MODEL_PRICING)) {
    const cost = calculateCost(inputTokens, outputTokens, modelId);
    if (cost) {
      results.push({
        model: modelId,
        provider: pricing.provider,
        inputTokens,
        outputTokens,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
        contextWindow: pricing.contextWindow
      });
    }
  }

  // Sort by total cost
  return results.sort((a, b) => a.totalCost - b.totalCost);
}

/**
 * Batch estimate for all files in a directory
 */
export function batch(
  dirPath: string,
  recursive: boolean = false,
  outputRatio: number = 1.5
): BatchResult[] {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  const results: BatchResult[] = [];
  const files = getFiles(dirPath, recursive);

  for (const file of files) {
    try {
      const inputTokens = estimateFileTokens(file);
      const outputTokens = Math.ceil(inputTokens * outputRatio);

      const estimates: { model: string; cost: number }[] = [];

      // Get costs for top 3 popular models
      const popularModels = ['claude-3-haiku', 'gpt-4o-mini', 'claude-3.5-sonnet'];
      for (const modelId of popularModels) {
        const cost = calculateCost(inputTokens, outputTokens, modelId);
        if (cost) {
          estimates.push({ model: modelId, cost: cost.totalCost });
        }
      }

      results.push({
        file: path.relative(dirPath, file),
        inputTokens,
        estimates
      });
    } catch (e) {
      // Skip files that can't be read
    }
  }

  return results;
}

/**
 * Get all files in a directory
 */
function getFiles(dirPath: string, recursive: boolean): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  const textExtensions = ['.txt', '.md', '.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php', '.json', '.yaml', '.yml', '.xml', '.html', '.css'];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && recursive) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getFiles(fullPath, recursive));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (textExtensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Format estimate for display
 */
export function formatEstimate(estimate: TokenEstimate): string {
  const pricing = getModelPricing(estimate.model);
  const modelName = pricing?.name || estimate.model;

  return `
Model: ${modelName}
Provider: ${pricing?.provider || 'Unknown'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input Tokens:  ${estimate.inputTokens.toLocaleString()}
Output Tokens: ${estimate.outputTokens.toLocaleString()} (estimated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input Cost:    ${formatCurrency(estimate.inputCost)}
Output Cost:   ${formatCurrency(estimate.outputCost)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Cost:    ${formatCurrency(estimate.totalCost)}
`.trim();
}

/**
 * Format comparison table
 */
export function formatComparison(results: CompareResult[]): string {
  const lines: string[] = [
    '┌─────────────────────────┬──────────┬───────────────┬───────────────┬───────────────┐',
    '│ Model                   │ Provider │ Input Cost    │ Output Cost   │ Total Cost    │',
    '├─────────────────────────┼──────────┼───────────────┼───────────────┼───────────────┤'
  ];

  for (const r of results) {
    const model = r.model.padEnd(23);
    const provider = r.provider.padEnd(8);
    const inputCost = formatCurrency(r.inputCost).padStart(13);
    const outputCost = formatCurrency(r.outputCost).padStart(13);
    const totalCost = formatCurrency(r.totalCost).padStart(13);

    lines.push(`│ ${model} │ ${provider} │ ${inputCost} │ ${outputCost} │ ${totalCost} │`);
  }

  lines.push('└─────────────────────────┴──────────┴───────────────┴───────────────┴───────────────┘');

  const first = results[0];
  const last = results[results.length - 1];

  if (first && last && first !== last) {
    const savings = ((last.totalCost - first.totalCost) / last.totalCost * 100).toFixed(1);
    lines.push('');
    lines.push(`Cheapest: ${first.model} at ${formatCurrency(first.totalCost)}`);
    lines.push(`Most expensive: ${last.model} at ${formatCurrency(last.totalCost)}`);
    lines.push(`Potential savings: ${savings}% by choosing ${first.model}`);
  }

  return lines.join('\n');
}

/**
 * Format batch results
 */
export function formatBatchResults(results: BatchResult[]): string {
  const lines: string[] = [
    'Batch Token Estimation Results',
    '══════════════════════════════════════════════════════════════════════════════',
    ''
  ];

  let totalTokens = 0;
  const totalCosts: Record<string, number> = {};

  for (const r of results) {
    totalTokens += r.inputTokens;
    lines.push(`${r.file}`);
    lines.push(`  Tokens: ${r.inputTokens.toLocaleString()}`);

    for (const e of r.estimates) {
      lines.push(`  ${e.model}: ${formatCurrency(e.cost)}`);
      totalCosts[e.model] = (totalCosts[e.model] || 0) + e.cost;
    }
    lines.push('');
  }

  lines.push('══════════════════════════════════════════════════════════════════════════════');
  lines.push('Summary');
  lines.push(`Total Files: ${results.length}`);
  lines.push(`Total Tokens: ${totalTokens.toLocaleString()}`);
  lines.push('');
  lines.push('Total Estimated Costs:');

  for (const [model, cost] of Object.entries(totalCosts)) {
    lines.push(`  ${model}: ${formatCurrency(cost)}`);
  }

  return lines.join('\n');
}
