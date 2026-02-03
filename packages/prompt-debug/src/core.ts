import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import type { Ora } from 'ora';
import { BreakpointManager } from './breakpoints.js';

export interface PromptSegment {
  type: 'system' | 'user' | 'assistant' | 'example' | 'context';
  content: string;
  tokenCount: number;
  lineStart: number;
  lineEnd: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionStep {
  segmentIndex: number;
  segment: PromptSegment;
  cumulativeTokens: number;
  response?: string;
  responseTokens?: number;
  error?: string;
  duration?: number;
}

export interface DebugResult {
  steps: ExecutionStep[];
  finalResponse: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDuration: number;
}

export class DebugCore {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic();
    }
    return this.client;
  }

  /**
   * Estimate token count for a string
   * Uses a simple heuristic: ~4 characters per token on average
   */
  estimateTokens(text: string): number {
    // More accurate estimation based on common patterns
    const words = text.split(/\s+/).length;
    const chars = text.length;
    // Average of word-based and character-based estimates
    return Math.ceil((words * 1.3 + chars / 4) / 2);
  }

  /**
   * Parse a prompt file into segments
   */
  parsePrompt(content: string): PromptSegment[] {
    const segments: PromptSegment[] = [];
    const lines = content.split('\n');

    let currentSegment: Partial<PromptSegment> | null = null;
    let currentContent: string[] = [];
    let segmentStartLine = 1;

    const segmentMarkers: Record<string, PromptSegment['type']> = {
      '# system': 'system',
      '## system': 'system',
      '### system': 'system',
      '[system]': 'system',
      '<system>': 'system',
      '# user': 'user',
      '## user': 'user',
      '### user': 'user',
      '[user]': 'user',
      '<user>': 'user',
      '# assistant': 'assistant',
      '## assistant': 'assistant',
      '### assistant': 'assistant',
      '[assistant]': 'assistant',
      '<assistant>': 'assistant',
      '# example': 'example',
      '## example': 'example',
      '### example': 'example',
      '[example]': 'example',
      '<example>': 'example',
      '# context': 'context',
      '## context': 'context',
      '### context': 'context',
      '[context]': 'context',
      '<context>': 'context',
    };

    const closingTags = ['</system>', '</user>', '</assistant>', '</example>', '</context>'];

    const finalizeSegment = (endLine: number) => {
      if (currentSegment && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        if (content) {
          segments.push({
            type: currentSegment.type as PromptSegment['type'],
            content,
            tokenCount: this.estimateTokens(content),
            lineStart: segmentStartLine,
            lineEnd: endLine
          });
        }
      }
      currentSegment = null;
      currentContent = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase().trim();
      const lineNumber = i + 1;

      // Check for closing tags
      if (closingTags.some(tag => lineLower === tag)) {
        finalizeSegment(lineNumber - 1);
        continue;
      }

      // Check for segment markers
      let foundMarker = false;
      for (const [marker, type] of Object.entries(segmentMarkers)) {
        if (lineLower === marker || lineLower.startsWith(marker + ' ') || lineLower.startsWith(marker + ':')) {
          finalizeSegment(lineNumber - 1);
          currentSegment = { type };
          segmentStartLine = lineNumber;
          foundMarker = true;
          break;
        }
      }

      if (!foundMarker && currentSegment) {
        currentContent.push(line);
      } else if (!foundMarker && !currentSegment && line.trim()) {
        // Content without explicit segment marker - treat as user input
        currentSegment = { type: 'user' };
        segmentStartLine = lineNumber;
        currentContent.push(line);
      }
    }

    // Finalize last segment
    finalizeSegment(lines.length);

    // If no segments found, treat entire content as user input
    if (segments.length === 0 && content.trim()) {
      segments.push({
        type: 'user',
        content: content.trim(),
        tokenCount: this.estimateTokens(content),
        lineStart: 1,
        lineEnd: lines.length
      });
    }

    return segments;
  }

  /**
   * Execute a single segment and get response
   */
  async executeSegment(
    segments: PromptSegment[],
    upToIndex: number,
    model: string
  ): Promise<{ response: string; inputTokens: number; outputTokens: number; duration: number }> {
    const startTime = Date.now();
    const client = this.getClient();

    // Build messages from segments
    const systemContent: string[] = [];
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (let i = 0; i <= upToIndex; i++) {
      const segment = segments[i];

      switch (segment.type) {
        case 'system':
        case 'context':
          systemContent.push(segment.content);
          break;
        case 'user':
          messages.push({ role: 'user', content: segment.content });
          break;
        case 'assistant':
          messages.push({ role: 'assistant', content: segment.content });
          break;
        case 'example':
          // Examples are typically user-assistant pairs, add as user for now
          messages.push({ role: 'user', content: `Example:\n${segment.content}` });
          break;
      }
    }

    // Ensure we have at least one user message
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: 'Please respond based on the context above.' });
    }

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemContent.length > 0 ? systemContent.join('\n\n') : undefined,
        messages
      });

      const duration = Date.now() - startTime;
      const textContent = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('\n');

      return {
        response: textContent,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        duration
      };
    } catch (error) {
      throw new Error(`API execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute prompt with breakpoints
   */
  async executeWithBreakpoints(
    segments: PromptSegment[],
    breakpointManager: BreakpointManager,
    model: string,
    spinner: Ora,
    autoContinue: boolean = false
  ): Promise<DebugResult> {
    const steps: ExecutionStep[] = [];
    let cumulativeTokens = 0;
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalResponse = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      cumulativeTokens += segment.tokenCount;

      const step: ExecutionStep = {
        segmentIndex: i,
        segment,
        cumulativeTokens
      };

      const shouldBreak = breakpointManager.shouldBreak(i, segment.type);

      if (shouldBreak && !autoContinue) {
        spinner.stop();
        console.log(chalk.yellow(`\nBreakpoint hit at segment ${i} (${segment.type})`));
        console.log(chalk.gray(`Content preview: ${segment.content.substring(0, 100)}...`));
        console.log(chalk.gray(`Cumulative tokens: ${cumulativeTokens}`));
      }

      // Execute if this is a user segment or the last segment
      if (segment.type === 'user' || i === segments.length - 1) {
        spinner.text = `Executing segment ${i + 1}/${segments.length}...`;
        spinner.start();

        try {
          const result = await this.executeSegment(segments, i, model);
          step.response = result.response;
          step.responseTokens = result.outputTokens;
          step.duration = result.duration;
          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;
          finalResponse = result.response;
        } catch (error) {
          step.error = error instanceof Error ? error.message : String(error);
        }
      }

      steps.push(step);
    }

    return {
      steps,
      finalResponse,
      totalInputTokens,
      totalOutputTokens,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * Format segment for display
   */
  formatSegment(segment: PromptSegment, index: number): string {
    const typeColors: Record<string, (s: string) => string> = {
      system: chalk.blue,
      user: chalk.green,
      assistant: chalk.yellow,
      example: chalk.magenta,
      context: chalk.cyan
    };

    const colorFn = typeColors[segment.type] || chalk.white;
    const header = `${chalk.bold(`[${index}]`)} ${colorFn(segment.type.toUpperCase())}`;
    const meta = chalk.gray(`Lines ${segment.lineStart}-${segment.lineEnd} | ~${segment.tokenCount} tokens`);

    return `${header}\n${meta}\n${chalk.gray('─'.repeat(40))}\n${segment.content}`;
  }

  /**
   * Update a segment's content
   */
  updateSegment(segments: PromptSegment[], index: number, newContent: string): PromptSegment[] {
    const updated = [...segments];
    updated[index] = {
      ...updated[index],
      content: newContent,
      tokenCount: this.estimateTokens(newContent)
    };
    return updated;
  }
}
