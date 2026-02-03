// Simple token estimation (Claude uses a modified BPE tokenizer)
// This is an approximation - for exact counts, use the tiktoken library

export function estimateTokens(text: string): number {
  // Average: ~4 characters per token for English text
  // This is a rough estimate - Claude's tokenizer may vary
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Use a weighted average of character and word-based estimates
  const charEstimate = charCount / 4;
  const wordEstimate = wordCount * 1.3;

  return Math.ceil((charEstimate + wordEstimate) / 2);
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return String(tokens);
}

export interface TokenBreakdown {
  total: number;
  bySection: Map<string, number>;
}

export function analyzeTokenUsage(text: string): TokenBreakdown {
  const sections = new Map<string, number>();
  const lines = text.split('\n');

  let currentSection = 'content';
  let sectionText = '';

  for (const line of lines) {
    // Detect section headers (markdown style)
    const headerMatch = line.match(/^#+\s+(.+)$/);
    if (headerMatch) {
      if (sectionText) {
        sections.set(currentSection, estimateTokens(sectionText));
      }
      currentSection = headerMatch[1].toLowerCase().replace(/\s+/g, '-');
      sectionText = line + '\n';
    } else {
      sectionText += line + '\n';
    }
  }

  if (sectionText) {
    sections.set(currentSection, estimateTokens(sectionText));
  }

  return {
    total: estimateTokens(text),
    bySection: sections,
  };
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Estimate the character limit based on token ratio
  const charLimit = Math.floor((maxTokens / currentTokens) * text.length * 0.95);
  return text.slice(0, charLimit) + '...[truncated]';
}
