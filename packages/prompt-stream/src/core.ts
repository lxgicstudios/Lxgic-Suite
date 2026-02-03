/**
 * Core types and configuration for prompt-stream
 */

export interface StreamConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  format: OutputFormat;
  showTokens: boolean;
}

export type OutputFormat = 'text' | 'json' | 'markdown' | 'raw';

export interface StreamResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  finishReason: string;
  durationMs: number;
}

export interface StreamStats {
  startTime: number;
  tokensReceived: number;
  chunksReceived: number;
}

export const DEFAULT_CONFIG: StreamConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  format: 'text',
  showTokens: false
};

export function getConfig(overrides: Partial<StreamConfig> = {}): StreamConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

export function formatOutput(content: string, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify({ content }, null, 2);
    case 'markdown':
      return content; // Already markdown from Claude
    case 'raw':
      return content;
    case 'text':
    default:
      return content;
  }
}

export function validateApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set.\n' +
      'Please set it with: export ANTHROPIC_API_KEY=your-api-key'
    );
  }
  return apiKey;
}
