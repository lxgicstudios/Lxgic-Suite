import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import Conf from 'conf';
import * as fs from 'fs/promises';

/**
 * Configuration schema for the playground
 */
export const PlaygroundConfigSchema = z.object({
  model: z.string().default('claude-3-5-sonnet-20241022'),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().positive().default(4096),
  systemPrompt: z.string().optional(),
  jsonOutput: z.boolean().default(false),
});

export type PlaygroundConfig = z.infer<typeof PlaygroundConfigSchema>;

/**
 * Message in conversation history
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  latencyMs?: number;
}

/**
 * Session state
 */
export interface Session {
  id: string;
  config: PlaygroundConfig;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Token counting utility (approximate)
 */
export function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Main playground class
 */
export class PromptPlayground {
  private client: Anthropic;
  private config: PlaygroundConfig;
  private messages: Message[] = [];
  private sessionId: string;
  private store: Conf<{ sessions: Record<string, Session> }>;

  constructor(config: Partial<PlaygroundConfig> = {}) {
    this.config = PlaygroundConfigSchema.parse(config);
    this.client = new Anthropic();
    this.sessionId = this.generateSessionId();
    this.store = new Conf({
      projectName: 'prompt-playground',
      defaults: { sessions: {} },
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current configuration
   */
  getConfig(): PlaygroundConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PlaygroundConfig>): PlaygroundConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  /**
   * Set the model
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Set temperature
   */
  setTemperature(temperature: number): void {
    if (temperature < 0 || temperature > 1) {
      throw new Error('Temperature must be between 0 and 1');
    }
    this.config.temperature = temperature;
  }

  /**
   * Set system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * Run a prompt and get response (streaming)
   */
  async *runStream(prompt: string): AsyncGenerator<string, Message, unknown> {
    const startTime = Date.now();
    const userMessage: Message = {
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      tokenCount: estimateTokens(prompt),
    };
    this.messages.push(userMessage);

    const anthropicMessages = this.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    let fullResponse = '';

    try {
      const stream = await this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text;
          yield event.delta.text;
        }
      }

      const latencyMs = Date.now() - startTime;
      const assistantMessage: Message = {
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
        tokenCount: estimateTokens(fullResponse),
        latencyMs,
      };
      this.messages.push(assistantMessage);

      return assistantMessage;
    } catch (error) {
      // Remove the user message if the request failed
      this.messages.pop();
      throw error;
    }
  }

  /**
   * Run a prompt without streaming
   */
  async run(prompt: string): Promise<Message> {
    const startTime = Date.now();
    const userMessage: Message = {
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      tokenCount: estimateTokens(prompt),
    };
    this.messages.push(userMessage);

    const anthropicMessages = this.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
        messages: anthropicMessages,
      });

      const latencyMs = Date.now() - startTime;
      const content = response.content[0].type === 'text' ? response.content[0].text : '';

      const assistantMessage: Message = {
        role: 'assistant',
        content,
        timestamp: new Date(),
        tokenCount: response.usage.output_tokens,
        latencyMs,
      };
      this.messages.push(assistantMessage);

      return assistantMessage;
    } catch (error) {
      this.messages.pop();
      throw error;
    }
  }

  /**
   * Save current session
   */
  async saveSession(filename?: string): Promise<string> {
    const session: Session = {
      id: this.sessionId,
      config: this.config,
      messages: this.messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (filename) {
      // Save to file
      await fs.writeFile(filename, JSON.stringify(session, null, 2), 'utf-8');
      return filename;
    } else {
      // Save to store
      const sessions = this.store.get('sessions') || {};
      sessions[this.sessionId] = session;
      this.store.set('sessions', sessions);
      return this.sessionId;
    }
  }

  /**
   * Load session from file or store
   */
  async loadSession(source: string): Promise<void> {
    let session: Session;

    try {
      // Try to load from file first
      const content = await fs.readFile(source, 'utf-8');
      session = JSON.parse(content) as Session;
    } catch {
      // Try to load from store
      const sessions = this.store.get('sessions') || {};
      session = sessions[source];
      if (!session) {
        throw new Error(`Session not found: ${source}`);
      }
    }

    this.sessionId = session.id;
    this.config = { ...this.config, ...session.config };
    this.messages = session.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  }

  /**
   * List saved sessions
   */
  listSessions(): Array<{ id: string; createdAt: Date; messageCount: number }> {
    const sessions = this.store.get('sessions') || {};
    return Object.values(sessions).map(session => ({
      id: session.id,
      createdAt: new Date(session.createdAt),
      messageCount: session.messages.length,
    }));
  }

  /**
   * Get session statistics
   */
  getStats(): {
    messageCount: number;
    totalUserTokens: number;
    totalAssistantTokens: number;
    averageLatencyMs: number;
  } {
    const userMessages = this.messages.filter(m => m.role === 'user');
    const assistantMessages = this.messages.filter(m => m.role === 'assistant');

    const totalUserTokens = userMessages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    const totalAssistantTokens = assistantMessages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    const latencies = assistantMessages.filter(m => m.latencyMs).map(m => m.latencyMs!);
    const averageLatencyMs = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    return {
      messageCount: this.messages.length,
      totalUserTokens,
      totalAssistantTokens,
      averageLatencyMs: Math.round(averageLatencyMs),
    };
  }
}

export default PromptPlayground;
