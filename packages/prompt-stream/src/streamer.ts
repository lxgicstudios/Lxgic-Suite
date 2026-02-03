/**
 * Streaming functionality for AI responses
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  StreamConfig,
  StreamResult,
  StreamStats,
  formatOutput,
  validateApiKey
} from './core';

export class AIStreamer {
  private client: Anthropic;
  private config: StreamConfig;
  private abortController: AbortController | null = null;
  private stats: StreamStats = {
    startTime: 0,
    tokensReceived: 0,
    chunksReceived: 0
  };

  constructor(config: StreamConfig) {
    validateApiKey();
    this.client = new Anthropic();
    this.config = config;
  }

  /**
   * Stream a prompt to stdout
   */
  async stream(prompt: string): Promise<StreamResult> {
    this.stats = {
      startTime: Date.now(),
      tokensReceived: 0,
      chunksReceived: 0
    };

    this.abortController = new AbortController();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason = 'unknown';

    // Set up interrupt handling
    const interruptHandler = () => {
      this.abort();
      if (this.config.showTokens) {
        process.stderr.write('\n[Interrupted]\n');
        this.printStats();
      }
      process.exit(130); // Standard exit code for SIGINT
    };

    process.on('SIGINT', interruptHandler);
    process.on('SIGTERM', interruptHandler);

    try {
      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt }
      ];

      const streamParams: Anthropic.MessageCreateParams = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages,
        stream: true
      };

      if (this.config.systemPrompt) {
        streamParams.system = this.config.systemPrompt;
      }

      const stream = this.client.messages.stream(streamParams);

      for await (const event of stream) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            const text = delta.text;
            fullContent += text;
            this.stats.chunksReceived++;

            // Write to stdout in real-time
            process.stdout.write(text);
          }
        } else if (event.type === 'message_start') {
          if (event.message.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
        } else if (event.type === 'message_delta') {
          if ('usage' in event && event.usage) {
            outputTokens = event.usage.output_tokens;
          }
          if ('delta' in event && event.delta && 'stop_reason' in event.delta) {
            finishReason = event.delta.stop_reason || 'unknown';
          }
        }
      }

      // Ensure newline at end of output
      if (this.config.format === 'text' && !fullContent.endsWith('\n')) {
        process.stdout.write('\n');
      }

      const durationMs = Date.now() - this.stats.startTime;

      if (this.config.showTokens) {
        this.printStats(inputTokens, outputTokens, durationMs);
      }

      return {
        content: fullContent,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        finishReason,
        durationMs
      };
    } finally {
      process.removeListener('SIGINT', interruptHandler);
      process.removeListener('SIGTERM', interruptHandler);
    }
  }

  /**
   * Abort the current stream
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Print streaming statistics to stderr
   */
  private printStats(inputTokens?: number, outputTokens?: number, durationMs?: number): void {
    const duration = durationMs || (Date.now() - this.stats.startTime);
    const tokensPerSecond = outputTokens
      ? ((outputTokens / duration) * 1000).toFixed(1)
      : 'N/A';

    process.stderr.write('\n---\n');
    process.stderr.write(`Input tokens: ${inputTokens || 'N/A'}\n`);
    process.stderr.write(`Output tokens: ${outputTokens || 'N/A'}\n`);
    process.stderr.write(`Duration: ${(duration / 1000).toFixed(2)}s\n`);
    process.stderr.write(`Speed: ${tokensPerSecond} tokens/sec\n`);
  }
}

/**
 * Read prompt from stdin
 */
export async function readStdin(): Promise<string> {
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
      resolve(data.trim());
    });

    process.stdin.on('error', (err) => {
      reject(err);
    });

    // Handle case where stdin is a TTY
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

/**
 * Read prompt from file
 */
export async function readFile(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf8');
  return content.trim();
}
