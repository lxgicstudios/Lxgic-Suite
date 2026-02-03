import { z } from 'zod';

/**
 * Schema for template variables
 */
export const VariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  required: z.boolean().default(true),
});

export type Variable = z.infer<typeof VariableSchema>;

/**
 * Schema for a prompt template
 */
export const TemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  template: z.string().min(1),
  variables: z.array(VariableSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  examples: z.array(z.string()).optional(),
});

export type Template = z.infer<typeof TemplateSchema>;

/**
 * Regular expression to match Mustache-style variables {{variable}}
 */
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Extract variable names from a template string
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(VARIABLE_PATTERN);
  const variables = new Set<string>();

  for (const match of matches) {
    const varName = match[1].trim();
    if (varName && !varName.startsWith('#') && !varName.startsWith('/') && !varName.startsWith('^')) {
      variables.add(varName);
    }
  }

  return Array.from(variables);
}

/**
 * Validate that all required variables are provided
 */
export function validateVariables(
  template: Template,
  providedVars: Record<string, string>
): { valid: boolean; missing: string[]; extra: string[] } {
  const requiredVars = template.variables
    .filter(v => v.required)
    .map(v => v.name);

  const templateVars = template.variables.map(v => v.name);
  const providedKeys = Object.keys(providedVars);

  const missing = requiredVars.filter(v => !providedKeys.includes(v));
  const extra = providedKeys.filter(k => !templateVars.includes(k));

  return {
    valid: missing.length === 0,
    missing,
    extra,
  };
}

/**
 * Parse key=value pairs from command line arguments
 */
export function parseKeyValuePairs(pairs: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      throw new Error(`Invalid key=value pair: "${pair}". Expected format: key=value`);
    }

    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1).trim();

    if (!key) {
      throw new Error(`Empty key in pair: "${pair}"`);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Find common patterns between multiple example prompts
 */
export function findCommonPatterns(examples: string[]): {
  commonParts: string[];
  variableParts: Map<number, string[]>;
} {
  if (examples.length === 0) {
    return { commonParts: [], variableParts: new Map() };
  }

  if (examples.length === 1) {
    return { commonParts: [examples[0]], variableParts: new Map() };
  }

  // Split examples into words/tokens
  const tokenizedExamples = examples.map(e =>
    e.split(/(\s+)/).filter(t => t.length > 0)
  );

  // Find longest common subsequence patterns
  const minLength = Math.min(...tokenizedExamples.map(t => t.length));
  const commonParts: string[] = [];
  const variableParts = new Map<number, string[]>();

  for (let i = 0; i < minLength; i++) {
    const tokens = tokenizedExamples.map(t => t[i]);
    const allSame = tokens.every(t => t === tokens[0]);

    if (allSame) {
      commonParts.push(tokens[0]);
    } else {
      variableParts.set(i, tokens);
      commonParts.push(`{{var_${variableParts.size}}}`);
    }
  }

  return { commonParts, variableParts };
}

/**
 * Generate a template ID from a name
 */
export function generateTemplateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') +
    '-' +
    Date.now().toString(36);
}

/**
 * Escape special Mustache characters in a string
 */
export function escapeForMustache(str: string): string {
  return str
    .replace(/\{\{/g, '\\{\\{')
    .replace(/\}\}/g, '\\}\\}');
}

/**
 * Unescape Mustache characters
 */
export function unescapeForMustache(str: string): string {
  return str
    .replace(/\\\{\\{/g, '{{')
    .replace(/\\\}\\}/g, '}}');
}
