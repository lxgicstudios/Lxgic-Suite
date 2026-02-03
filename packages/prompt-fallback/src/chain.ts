/**
 * Fallback chain execution
 */

import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import {
  FallbackConfig,
  FallbackResult,
  ProviderConfig,
  ProviderError,
  ProviderHealthStatus,
  ProviderName,
  sortByPriority,
  sortByCost,
  hasApiKey,
  getDefaultConfig
} from './core';
import { getProvider, getAvailableProviders } from './providers';

export class FallbackChain {
  private config: FallbackConfig;
  private verbose: boolean;

  constructor(config?: Partial<FallbackConfig>, verbose: boolean = false) {
    this.config = { ...getDefaultConfig(), ...config };
    this.verbose = verbose;
  }

  /**
   * Execute prompt through fallback chain
   */
  async execute(prompt: string, providerNames?: ProviderName[]): Promise<FallbackResult> {
    const errors: ProviderError[] = [];
    const attemptedProviders: string[] = [];

    // Get providers to try
    let providers = this.getProvidersToTry(providerNames);

    // Sort by cost if cost-aware mode is enabled
    if (this.config.costAware) {
      providers = sortByCost(providers);
    } else {
      providers = sortByPriority(providers);
    }

    for (const providerConfig of providers) {
      // Check if provider has API key configured
      if (!hasApiKey(providerConfig)) {
        if (this.verbose) {
          console.error(`[Fallback] Skipping ${providerConfig.name}: No API key configured`);
        }
        continue;
      }

      attemptedProviders.push(providerConfig.name);

      if (this.verbose) {
        console.error(`[Fallback] Trying ${providerConfig.name} (${providerConfig.model})...`);
      }

      try {
        const provider = getProvider(providerConfig.name);
        const response = await this.executeWithTimeout(
          provider.call(prompt, providerConfig),
          this.config.timeout
        );

        if (this.verbose) {
          console.error(`[Fallback] Success with ${providerConfig.name} in ${response.durationMs}ms`);
        }

        return {
          success: true,
          response,
          attemptedProviders,
          errors
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (this.verbose) {
          console.error(`[Fallback] ${providerConfig.name} failed: ${errorMessage}`);
        }

        errors.push({
          provider: providerConfig.name,
          error: errorMessage,
          timestamp: Date.now()
        });
      }
    }

    return {
      success: false,
      attemptedProviders,
      errors
    };
  }

  /**
   * Test health of all configured providers
   */
  async testProviders(providerNames?: ProviderName[]): Promise<ProviderHealthStatus[]> {
    const providers = this.getProvidersToTry(providerNames);
    const results: ProviderHealthStatus[] = [];

    for (const providerConfig of providers) {
      if (!hasApiKey(providerConfig)) {
        results.push({
          provider: providerConfig.name,
          healthy: false,
          lastChecked: Date.now(),
          errorMessage: 'No API key configured'
        });
        continue;
      }

      if (this.verbose) {
        console.error(`[Health] Testing ${providerConfig.name}...`);
      }

      try {
        const provider = getProvider(providerConfig.name);
        const status = await this.executeWithTimeout(
          provider.healthCheck(providerConfig),
          this.config.timeout
        );
        results.push(status);

        if (this.verbose) {
          console.error(`[Health] ${providerConfig.name}: ${status.healthy ? 'OK' : 'FAILED'}`);
        }
      } catch (error) {
        results.push({
          provider: providerConfig.name,
          healthy: false,
          lastChecked: Date.now(),
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Get providers to try based on configuration
   */
  private getProvidersToTry(providerNames?: ProviderName[]): ProviderConfig[] {
    if (providerNames && providerNames.length > 0) {
      // Filter to only specified providers, maintaining their order
      return providerNames
        .map((name, index) => {
          const existing = this.config.providers.find(p => p.name === name);
          if (existing) {
            return { ...existing, priority: index + 1 };
          }
          // Create default config for provider
          return {
            name,
            model: getDefaultModel(name),
            priority: index + 1,
            envKey: getDefaultEnvKey(name),
            enabled: true
          };
        })
        .filter((p): p is ProviderConfig => p !== undefined);
    }

    return this.config.providers.filter(p => p.enabled);
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Load configuration from YAML file
   */
  static async loadConfig(filePath: string): Promise<FallbackConfig> {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.parse(content);

    const config = getDefaultConfig();

    if (parsed.providers) {
      config.providers = parsed.providers.map((p: Partial<ProviderConfig>, index: number) => ({
        name: p.name || 'unknown',
        model: p.model || getDefaultModel(p.name as ProviderName),
        priority: p.priority || index + 1,
        envKey: p.envKey || getDefaultEnvKey(p.name as ProviderName),
        enabled: p.enabled !== false,
        maxTokens: p.maxTokens || 4096,
        temperature: p.temperature || 0.7,
        costPer1kInput: p.costPer1kInput,
        costPer1kOutput: p.costPer1kOutput
      }));
    }

    if (parsed.timeout) {
      config.timeout = parsed.timeout;
    }

    if (parsed.retryAttempts) {
      config.retryAttempts = parsed.retryAttempts;
    }

    if (parsed.costAware) {
      config.costAware = parsed.costAware;
    }

    return config;
  }

  /**
   * Get current configuration
   */
  getConfig(): FallbackConfig {
    return this.config;
  }
}

/**
 * Get default model for a provider
 */
function getDefaultModel(provider: ProviderName | string): string {
  switch (provider) {
    case 'claude':
      return 'claude-sonnet-4-20250514';
    case 'openai':
      return 'gpt-4';
    case 'gemini':
      return 'gemini-pro';
    case 'mock':
      return 'mock-model';
    default:
      return 'unknown';
  }
}

/**
 * Get default environment variable key for a provider
 */
function getDefaultEnvKey(provider: ProviderName | string): string | undefined {
  switch (provider) {
    case 'claude':
      return 'ANTHROPIC_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'gemini':
      return 'GOOGLE_API_KEY';
    default:
      return undefined;
  }
}

export { getAvailableProviders };
