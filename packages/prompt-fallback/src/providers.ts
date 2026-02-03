/**
 * Provider implementations for AI services
 */

import { ProviderConfig, ProviderResponse, ProviderHealthStatus, calculateCost } from './core';

/**
 * Base provider interface
 */
export interface AIProvider {
  name: string;
  call(prompt: string, config: ProviderConfig): Promise<ProviderResponse>;
  healthCheck(config: ProviderConfig): Promise<ProviderHealthStatus>;
}

/**
 * Claude (Anthropic) provider
 */
export class ClaudeProvider implements AIProvider {
  name = 'claude';

  async call(prompt: string, config: ProviderConfig): Promise<ProviderResponse> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic();

    const startTime = Date.now();

    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const durationMs = Date.now() - startTime;
    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      provider: 'claude',
      model: config.model,
      content,
      inputTokens,
      outputTokens,
      durationMs,
      cost: calculateCost(config, inputTokens, outputTokens)
    };
  }

  async healthCheck(config: ProviderConfig): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic();

      await client.messages.create({
        model: config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      });

      return {
        provider: 'claude',
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: Date.now()
      };
    } catch (error) {
      return {
        provider: 'claude',
        healthy: false,
        lastChecked: Date.now(),
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * OpenAI provider
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai';

  async call(prompt: string, config: ProviderConfig): Promise<ProviderResponse> {
    let OpenAI;
    try {
      OpenAI = (await import('openai')).default;
    } catch {
      throw new Error('OpenAI package not installed. Run: npm install openai');
    }

    const client = new OpenAI();
    const startTime = Date.now();

    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const durationMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    return {
      provider: 'openai',
      model: config.model,
      content,
      inputTokens,
      outputTokens,
      durationMs,
      cost: calculateCost(config, inputTokens, outputTokens)
    };
  }

  async healthCheck(config: ProviderConfig): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      let OpenAI;
      try {
        OpenAI = (await import('openai')).default;
      } catch {
        throw new Error('OpenAI package not installed');
      }

      const client = new OpenAI();

      await client.chat.completions.create({
        model: config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      });

      return {
        provider: 'openai',
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: Date.now()
      };
    } catch (error) {
      return {
        provider: 'openai',
        healthy: false,
        lastChecked: Date.now(),
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Mock provider for testing
 */
export class MockProvider implements AIProvider {
  name = 'mock';

  async call(prompt: string, config: ProviderConfig): Promise<ProviderResponse> {
    const startTime = Date.now();

    // Simulate some latency
    await new Promise(resolve => setTimeout(resolve, 100));

    const content = `[Mock Response] Received prompt: "${prompt.substring(0, 50)}..."`;

    return {
      provider: 'mock',
      model: config.model,
      content,
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil(content.length / 4),
      durationMs: Date.now() - startTime,
      cost: 0
    };
  }

  async healthCheck(_config: ProviderConfig): Promise<ProviderHealthStatus> {
    return {
      provider: 'mock',
      healthy: true,
      latencyMs: 1,
      lastChecked: Date.now()
    };
  }
}

/**
 * Get provider instance by name
 */
export function getProvider(name: string): AIProvider {
  switch (name) {
    case 'claude':
      return new ClaudeProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): string[] {
  return ['claude', 'openai', 'mock'];
}
