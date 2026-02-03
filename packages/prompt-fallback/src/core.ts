/**
 * Core types and configuration for prompt-fallback
 */

export type ProviderName = 'claude' | 'openai' | 'gemini' | 'mock';

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  priority: number;
  envKey?: string;
  enabled: boolean;
  maxTokens?: number;
  temperature?: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export interface FallbackConfig {
  providers: ProviderConfig[];
  timeout: number;
  retryAttempts: number;
  costAware: boolean;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  cost?: number;
}

export interface FallbackResult {
  success: boolean;
  response?: ProviderResponse;
  attemptedProviders: string[];
  errors: ProviderError[];
}

export interface ProviderError {
  provider: ProviderName;
  error: string;
  timestamp: number;
}

export interface ProviderHealthStatus {
  provider: ProviderName;
  healthy: boolean;
  latencyMs?: number;
  lastChecked: number;
  errorMessage?: string;
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: 'claude',
    model: 'claude-sonnet-4-20250514',
    priority: 1,
    envKey: 'ANTHROPIC_API_KEY',
    enabled: true,
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015
  },
  {
    name: 'openai',
    model: 'gpt-4',
    priority: 2,
    envKey: 'OPENAI_API_KEY',
    enabled: true,
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kInput: 0.03,
    costPer1kOutput: 0.06
  },
  {
    name: 'mock',
    model: 'mock-model',
    priority: 99,
    enabled: true,
    maxTokens: 4096,
    temperature: 0.7
  }
];

export const DEFAULT_CONFIG: FallbackConfig = {
  providers: DEFAULT_PROVIDERS,
  timeout: 30000,
  retryAttempts: 1,
  costAware: false
};

export function getDefaultConfig(): FallbackConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/**
 * Parse provider list from comma-separated string
 */
export function parseProviders(providerList: string): ProviderName[] {
  return providerList.split(',').map(p => p.trim() as ProviderName);
}

/**
 * Sort providers by priority (lower number = higher priority)
 */
export function sortByPriority(providers: ProviderConfig[]): ProviderConfig[] {
  return [...providers].sort((a, b) => a.priority - b.priority);
}

/**
 * Sort providers by cost (lower cost = higher priority)
 */
export function sortByCost(providers: ProviderConfig[]): ProviderConfig[] {
  return [...providers].sort((a, b) => {
    const costA = (a.costPer1kInput || 0) + (a.costPer1kOutput || 0);
    const costB = (b.costPer1kInput || 0) + (b.costPer1kOutput || 0);
    return costA - costB;
  });
}

/**
 * Calculate cost for a response
 */
export function calculateCost(
  provider: ProviderConfig,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1000) * (provider.costPer1kInput || 0);
  const outputCost = (outputTokens / 1000) * (provider.costPer1kOutput || 0);
  return inputCost + outputCost;
}

/**
 * Check if provider has valid API key configured
 */
export function hasApiKey(provider: ProviderConfig): boolean {
  if (provider.name === 'mock') {
    return true;
  }
  if (!provider.envKey) {
    return false;
  }
  return !!process.env[provider.envKey];
}
