import * as fs from 'fs';
import * as path from 'path';
import {
  TokenCount,
  ModelTokenCount,
  SectionBreakdown,
  BatchResult,
  BatchSummary,
  countTextStats,
  getModelComparison,
  getSectionBreakdown,
  estimateTokens,
} from './tokenizer';

export interface CountOptions {
  breakdown?: boolean;
  compare?: boolean;
  json?: boolean;
}

export interface CountResult {
  input: string;
  stats: TokenCount;
  sections?: SectionBreakdown[];
  modelComparison?: ModelTokenCount[];
}

/**
 * Count tokens in a text string
 */
export function countText(text: string, options: CountOptions = {}): CountResult {
  const stats = countTextStats(text);
  const result: CountResult = {
    input: 'text',
    stats,
  };

  if (options.breakdown) {
    result.sections = getSectionBreakdown(text);
  }

  if (options.compare) {
    result.modelComparison = getModelComparison(text);
  }

  return result;
}

/**
 * Count tokens in a file
 */
export function countFile(filePath: string, options: CountOptions = {}): CountResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const result = countText(content, options);
  result.input = absolutePath;

  return result;
}

/**
 * Process multiple files in batch
 */
export function countBatch(filePaths: string[], options: CountOptions = {}): BatchSummary {
  const results: BatchResult[] = [];
  let totalTokens = 0;
  let totalCharacters = 0;
  let totalWords = 0;
  let errorCount = 0;

  for (const filePath of filePaths) {
    try {
      const result = countFile(filePath, { breakdown: false, compare: false });
      results.push({
        file: filePath,
        tokens: result.stats.total,
        characters: result.stats.characters,
        words: result.stats.words,
      });
      totalTokens += result.stats.total;
      totalCharacters += result.stats.characters;
      totalWords += result.stats.words;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        file: filePath,
        tokens: 0,
        characters: 0,
        words: 0,
        error: errorMessage,
      });
      errorCount++;
    }
  }

  return {
    files: results,
    totalTokens,
    totalCharacters,
    totalWords,
    errorCount,
  };
}

/**
 * Read from stdin and count tokens
 */
export async function countStdin(options: CountOptions = {}): Promise<CountResult> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      try {
        const result = countText(data, options);
        result.input = 'stdin';
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Expand glob patterns to file paths
 */
export function expandGlobPatterns(patterns: string[]): string[] {
  const files: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Simple glob expansion
      const dir = path.dirname(pattern);
      const filePattern = path.basename(pattern);
      const regex = new RegExp('^' + filePattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');

      try {
        const dirPath = path.resolve(dir);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          const entries = fs.readdirSync(dirPath);
          for (const entry of entries) {
            if (regex.test(entry)) {
              files.push(path.join(dir, entry));
            }
          }
        }
      } catch {
        // Skip invalid paths
      }
    } else {
      files.push(pattern);
    }
  }

  return files;
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
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return '$' + cost.toFixed(4);
  }
  return '$' + cost.toFixed(2);
}
