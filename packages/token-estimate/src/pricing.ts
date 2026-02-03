/**
 * AI Model Pricing Data
 * Prices are per 1M tokens (as of 2024)
 */

export interface ModelPricing {
  name: string;
  provider: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextWindow: number;
  description?: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude Models
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
    description: 'Most powerful Claude model for complex tasks'
  },
  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    description: 'Balanced performance and cost'
  },
  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    contextWindow: 200000,
    description: 'Fastest and most affordable Claude model'
  },
  'claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    description: 'Enhanced Sonnet with improved capabilities'
  },

  // OpenAI GPT Models
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    inputPricePerMillion: 10.00,
    outputPricePerMillion: 30.00,
    contextWindow: 128000,
    description: 'Latest GPT-4 with improved performance'
  },
  'gpt-4': {
    name: 'GPT-4',
    provider: 'OpenAI',
    inputPricePerMillion: 30.00,
    outputPricePerMillion: 60.00,
    contextWindow: 8192,
    description: 'Original GPT-4 model'
  },
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'OpenAI',
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 15.00,
    contextWindow: 128000,
    description: 'Optimized GPT-4 for faster responses'
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    contextWindow: 128000,
    description: 'Cost-effective GPT-4o variant'
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    contextWindow: 16385,
    description: 'Fast and affordable for simple tasks'
  },

  // Google Models
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    inputPricePerMillion: 3.50,
    outputPricePerMillion: 10.50,
    contextWindow: 1000000,
    description: 'Google\'s advanced multimodal model'
  },
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    contextWindow: 1000000,
    description: 'Fast and efficient Gemini variant'
  }
};

export function getModelPricing(modelId: string): ModelPricing | undefined {
  return MODEL_PRICING[modelId.toLowerCase()];
}

export function getAllModels(): string[] {
  return Object.keys(MODEL_PRICING);
}

export function getModelsByProvider(provider: string): ModelPricing[] {
  return Object.values(MODEL_PRICING).filter(
    m => m.provider.toLowerCase() === provider.toLowerCase()
  );
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): { inputCost: number; outputCost: number; totalCost: number } | null {
  const pricing = getModelPricing(modelId);
  if (!pricing) return null;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

export function formatCurrency(amount: number): string {
  if (amount < 0.01) {
    return `$${amount.toFixed(6)}`;
  }
  return `$${amount.toFixed(4)}`;
}
