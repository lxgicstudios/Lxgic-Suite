import * as fs from 'fs';
import * as path from 'path';
import {
  OptimizationResult,
  AnalysisResult,
  Suggestion,
  compressText,
  analyzeText,
  getSuggestions,
  estimateTokens,
} from './optimizer';

export interface CompressOptions {
  preserveStructure?: boolean;
  aggressive?: boolean;
}

export interface FileCompressResult extends OptimizationResult {
  filePath: string;
  outputPath?: string;
}

/**
 * Compress text content
 */
export function compress(text: string, options: CompressOptions = {}): OptimizationResult {
  return compressText(text);
}

/**
 * Compress a file
 */
export function compressFile(filePath: string, options: CompressOptions = {}): FileCompressResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const result = compressText(content);

  return {
    ...result,
    filePath: absolutePath,
  };
}

/**
 * Compress and save to file
 */
export function compressAndSave(inputPath: string, outputPath?: string, options: CompressOptions = {}): FileCompressResult {
  const absoluteInput = path.resolve(inputPath);
  const result = compressFile(absoluteInput, options);

  const absoluteOutput = outputPath
    ? path.resolve(outputPath)
    : absoluteInput.replace(/(\.[^.]+)$/, '.optimized$1');

  fs.writeFileSync(absoluteOutput, result.optimized, 'utf-8');

  return {
    ...result,
    outputPath: absoluteOutput,
  };
}

/**
 * Analyze text for optimization opportunities
 */
export function analyze(text: string): AnalysisResult {
  return analyzeText(text);
}

/**
 * Analyze a file
 */
export function analyzeFile(filePath: string): AnalysisResult & { filePath: string } {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const result = analyzeText(content);

  return {
    ...result,
    filePath: absolutePath,
  };
}

/**
 * Get suggestions for text
 */
export function suggestions(text: string): Suggestion[] {
  return getSuggestions(text);
}

/**
 * Get suggestions for a file
 */
export function suggestionsForFile(filePath: string): { filePath: string; suggestions: Suggestion[] } {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const fileSuggestions = getSuggestions(content);

  return {
    filePath: absolutePath,
    suggestions: fileSuggestions,
  };
}

/**
 * Batch compress multiple files
 */
export interface BatchResult {
  files: FileCompressResult[];
  totalOriginalTokens: number;
  totalOptimizedTokens: number;
  totalSaved: number;
  percentSaved: number;
}

export function compressBatch(filePaths: string[], options: CompressOptions = {}): BatchResult {
  const results: FileCompressResult[] = [];
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const filePath of filePaths) {
    try {
      const result = compressFile(filePath, options);
      results.push(result);
      totalOriginal += result.originalTokens;
      totalOptimized += result.optimizedTokens;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        filePath,
        original: '',
        optimized: '',
        originalTokens: 0,
        optimizedTokens: 0,
        tokensSaved: 0,
        percentSaved: 0,
        appliedOptimizations: [`Error: ${message}`],
      });
    }
  }

  const totalSaved = totalOriginal - totalOptimized;
  const percentSaved = totalOriginal > 0 ? (totalSaved / totalOriginal) * 100 : 0;

  return {
    files: results,
    totalOriginalTokens: totalOriginal,
    totalOptimizedTokens: totalOptimized,
    totalSaved,
    percentSaved,
  };
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(2) + 'M';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
}

/**
 * Estimate cost savings
 */
export function estimateCostSavings(tokensSaved: number, pricePerThousand: number = 0.003): number {
  return (tokensSaved / 1000) * pricePerThousand;
}

// Re-export types
export { OptimizationResult, AnalysisResult, Suggestion };
