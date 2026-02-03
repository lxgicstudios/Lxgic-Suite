#!/usr/bin/env node

/**
 * prompt-stream - Stream AI responses to stdout
 *
 * Real-time streaming output from Claude AI with pipe-friendly output,
 * token counting, and interrupt handling.
 */

import { Command } from 'commander';
import { AIStreamer, readStdin, readFile } from './streamer';
import { getConfig, OutputFormat, StreamResult } from './core';

const program = new Command();

interface StreamOptions {
  file?: string;
  stdin?: boolean;
  model?: string;
  maxTokens?: string;
  temperature?: string;
  system?: string;
  format?: OutputFormat;
  tokens?: boolean;
  json?: boolean;
}

program
  .name('prompt-stream')
  .description('Stream AI responses to stdout with real-time output')
  .version('1.0.0')
  .argument('[query]', 'The prompt to send to the AI')
  .option('-f, --file <path>', 'Read prompt from file')
  .option('-s, --stdin', 'Read prompt from stdin')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet-4-20250514')
  .option('--max-tokens <number>', 'Maximum tokens in response', '4096')
  .option('-t, --temperature <number>', 'Temperature (0-1)', '0.7')
  .option('--system <prompt>', 'System prompt')
  .option('--format <format>', 'Output format: text, json, markdown, raw', 'text')
  .option('--tokens', 'Show token count and statistics')
  .option('--json', 'Output result as JSON (includes metadata)')
  .action(async (query: string | undefined, options: StreamOptions) => {
    try {
      let prompt: string;

      // Determine prompt source
      if (options.stdin) {
        prompt = await readStdin();
        if (!prompt) {
          console.error('Error: No input received from stdin');
          process.exit(1);
        }
      } else if (options.file) {
        prompt = await readFile(options.file);
      } else if (query) {
        prompt = query;
      } else {
        // Check if there's piped input
        const stdinPrompt = await readStdin();
        if (stdinPrompt) {
          prompt = stdinPrompt;
        } else {
          program.help();
          return;
        }
      }

      const config = getConfig({
        model: options.model,
        maxTokens: parseInt(options.maxTokens || '4096', 10),
        temperature: parseFloat(options.temperature || '0.7'),
        systemPrompt: options.system,
        format: (options.format as OutputFormat) || 'text',
        showTokens: options.tokens || false
      });

      const streamer = new AIStreamer(config);

      if (options.json) {
        // For JSON output, we need to capture everything first
        const result = await streamWithCapture(streamer, prompt);
        console.log(JSON.stringify({
          success: true,
          prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
          result: {
            content: result.content,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
            finishReason: result.finishReason,
            durationMs: result.durationMs
          }
        }, null, 2));
      } else {
        await streamer.stream(prompt);
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2));
      } else {
        console.error('Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

/**
 * Stream with output capture (for JSON mode)
 */
async function streamWithCapture(
  streamer: AIStreamer,
  prompt: string
): Promise<StreamResult> {
  // Temporarily redirect stdout to capture output
  const originalWrite = process.stdout.write.bind(process.stdout);
  let capturedOutput = '';

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') {
      capturedOutput += chunk;
    }
    return true;
  }) as typeof process.stdout.write;

  try {
    const result = await streamer.stream(prompt);
    return result;
  } finally {
    process.stdout.write = originalWrite;
  }
}

// Parse and execute
program.parse();
