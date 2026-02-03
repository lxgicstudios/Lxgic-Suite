import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from './config.js';

export type ClaudeModel =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20241022';

export interface ClaudeOptions {
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  stopReason: string | null;
}

let clientInstance: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic({
      apiKey: getApiKey(),
    });
  }
  return clientInstance;
}

export async function callClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<ClaudeResponse> {
  const client = getClaudeClient();
  const model = options.model ?? 'claude-3-5-sonnet-20241022';

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system: options.systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');

  return {
    content: textContent?.text ?? '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: response.model,
    stopReason: response.stop_reason,
  };
}

export async function streamClaude(
  prompt: string,
  options: ClaudeOptions = {},
  onChunk: (text: string) => void
): Promise<ClaudeResponse> {
  const client = getClaudeClient();
  const model = options.model ?? 'claude-3-5-sonnet-20241022';

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = await client.messages.stream({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    system: options.systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullContent += event.delta.text;
      onChunk(event.delta.text);
    }
    if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === 'message_start' && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  return {
    content: fullContent,
    usage: { inputTokens, outputTokens },
    model,
    stopReason: 'end_turn',
  };
}

export const MODEL_PRICING: Record<ClaudeModel, { input: number; output: number }> = {
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
};

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: ClaudeModel = 'claude-3-5-sonnet-20241022'
): number {
  const pricing = MODEL_PRICING[model];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
