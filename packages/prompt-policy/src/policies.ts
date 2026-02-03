export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  type: 'maxTokens' | 'minTokens' | 'requiredSection' | 'forbiddenWord' | 'pattern' | 'maxLineLength' | 'custom';
  value: string | number | string[];
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
}

export interface Policy {
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
}

// Strict policy - for production and sensitive environments
export const STRICT_POLICY: Policy = {
  name: 'strict',
  description: 'Strict policy for production environments with maximum security',
  version: '1.0.0',
  rules: [
    {
      id: 'max-tokens',
      name: 'Maximum Token Limit',
      description: 'Prompts must not exceed maximum token count',
      type: 'maxTokens',
      value: 2000,
      severity: 'error',
      enabled: true
    },
    {
      id: 'min-tokens',
      name: 'Minimum Token Count',
      description: 'Prompts must have minimum content',
      type: 'minTokens',
      value: 10,
      severity: 'error',
      enabled: true
    },
    {
      id: 'max-line-length',
      name: 'Maximum Line Length',
      description: 'Lines should not exceed maximum character count',
      type: 'maxLineLength',
      value: 500,
      severity: 'warning',
      enabled: true
    },
    {
      id: 'require-context',
      name: 'Context Section Required',
      description: 'Prompts must include a context section',
      type: 'requiredSection',
      value: ['context', 'background', 'Context:', 'Background:'],
      severity: 'error',
      enabled: true
    },
    {
      id: 'require-instruction',
      name: 'Instruction Section Required',
      description: 'Prompts must include clear instructions',
      type: 'requiredSection',
      value: ['instruction', 'task', 'Instruction:', 'Task:', 'Instructions:'],
      severity: 'error',
      enabled: true
    },
    {
      id: 'no-pii-patterns',
      name: 'No PII Patterns',
      description: 'Prompts must not contain PII patterns',
      type: 'pattern',
      value: '\\b\\d{3}-\\d{2}-\\d{4}\\b|\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
      severity: 'error',
      enabled: true
    },
    {
      id: 'forbidden-jailbreak',
      name: 'No Jailbreak Keywords',
      description: 'Prompts must not contain jailbreak keywords',
      type: 'forbiddenWord',
      value: ['ignore previous', 'forget instructions', 'DAN', 'jailbreak', 'bypass', 'unrestricted'],
      severity: 'error',
      enabled: true
    },
    {
      id: 'forbidden-harmful',
      name: 'No Harmful Content Keywords',
      description: 'Prompts must not request harmful content',
      type: 'forbiddenWord',
      value: ['hack', 'exploit', 'malware', 'ransomware', 'phishing', 'illegal'],
      severity: 'error',
      enabled: true
    }
  ]
};

// Moderate policy - balanced for general use
export const MODERATE_POLICY: Policy = {
  name: 'moderate',
  description: 'Balanced policy for general development use',
  version: '1.0.0',
  rules: [
    {
      id: 'max-tokens',
      name: 'Maximum Token Limit',
      description: 'Prompts must not exceed maximum token count',
      type: 'maxTokens',
      value: 4000,
      severity: 'error',
      enabled: true
    },
    {
      id: 'min-tokens',
      name: 'Minimum Token Count',
      description: 'Prompts must have minimum content',
      type: 'minTokens',
      value: 5,
      severity: 'warning',
      enabled: true
    },
    {
      id: 'max-line-length',
      name: 'Maximum Line Length',
      description: 'Lines should not exceed maximum character count',
      type: 'maxLineLength',
      value: 1000,
      severity: 'info',
      enabled: true
    },
    {
      id: 'no-pii-patterns',
      name: 'No PII Patterns',
      description: 'Prompts should not contain obvious PII',
      type: 'pattern',
      value: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
      severity: 'warning',
      enabled: true
    },
    {
      id: 'forbidden-jailbreak',
      name: 'No Jailbreak Keywords',
      description: 'Prompts must not contain jailbreak keywords',
      type: 'forbiddenWord',
      value: ['ignore previous', 'forget instructions', 'DAN', 'jailbreak'],
      severity: 'error',
      enabled: true
    }
  ]
};

// Permissive policy - for testing and development
export const PERMISSIVE_POLICY: Policy = {
  name: 'permissive',
  description: 'Permissive policy for testing and development',
  version: '1.0.0',
  rules: [
    {
      id: 'max-tokens',
      name: 'Maximum Token Limit',
      description: 'Prompts must not exceed maximum token count',
      type: 'maxTokens',
      value: 8000,
      severity: 'warning',
      enabled: true
    },
    {
      id: 'forbidden-jailbreak',
      name: 'No Jailbreak Keywords',
      description: 'Prompts should not contain obvious jailbreak keywords',
      type: 'forbiddenWord',
      value: ['DAN', 'jailbreak'],
      severity: 'warning',
      enabled: true
    }
  ]
};

export const BUILT_IN_POLICIES: Record<string, Policy> = {
  strict: STRICT_POLICY,
  moderate: MODERATE_POLICY,
  permissive: PERMISSIVE_POLICY
};

export function getPolicy(name: string): Policy | undefined {
  return BUILT_IN_POLICIES[name];
}

export function listPolicies(): string[] {
  return Object.keys(BUILT_IN_POLICIES);
}

export function createCustomPolicy(
  name: string,
  description: string,
  rules: PolicyRule[]
): Policy {
  return {
    name,
    description,
    version: '1.0.0',
    rules
  };
}

export function mergePolices(base: Policy, override: Partial<Policy>): Policy {
  return {
    ...base,
    ...override,
    rules: override.rules ? [...base.rules, ...override.rules] : base.rules
  };
}
