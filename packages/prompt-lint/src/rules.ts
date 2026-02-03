import { z } from 'zod';

/**
 * Severity levels for lint rules
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Schema for a lint rule
 */
export const LintRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  check: z.function().args(z.string()).returns(z.union([
    z.null(),
    z.object({
      message: z.string(),
      line: z.number().optional(),
      column: z.number().optional(),
      suggestion: z.string().optional(),
    })
  ]).or(z.array(z.object({
    message: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    suggestion: z.string().optional(),
  }))))
});

export type LintRule = {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  check: (prompt: string) => LintViolation | LintViolation[] | null;
};

export type LintViolation = {
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
};

export type LintResult = {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  violations: LintViolation[];
};

/**
 * Vague words that reduce prompt clarity
 */
const VAGUE_WORDS = [
  'stuff',
  'things',
  'etc',
  'and so on',
  'whatever',
  'somehow',
  'something',
  'anything',
  'everything',
  'kind of',
  'sort of',
  'maybe',
  'perhaps',
  'possibly',
  'probably',
  'I guess',
  'I think',
  'like',
  'basically',
  'actually',
  'really',
  'very',
  'quite',
  'pretty much',
];

/**
 * Ambiguous instruction patterns
 */
const AMBIGUOUS_PATTERNS = [
  { pattern: /do (it|this|that) (well|better|properly|correctly)/gi, message: 'Vague quality instruction' },
  { pattern: /make (it|this) (good|nice|better)/gi, message: 'Subjective quality instruction' },
  { pattern: /be (more )?creative/gi, message: 'Undefined creativity instruction' },
  { pattern: /improve (it|this|that)/gi, message: 'Unclear improvement instruction without specifics' },
  { pattern: /fix (it|this|that)/gi, message: 'Unclear fix instruction without specifics' },
  { pattern: /handle (it|this|that) (appropriately|properly)/gi, message: 'Vague handling instruction' },
  { pattern: /as (needed|necessary|appropriate)/gi, message: 'Undefined conditional instruction' },
  { pattern: /when (needed|necessary|appropriate)/gi, message: 'Undefined conditional trigger' },
  { pattern: /if (needed|necessary|appropriate)/gi, message: 'Undefined conditional' },
];

/**
 * Role definition patterns
 */
const ROLE_PATTERNS = [
  /you are (a|an)/i,
  /act as (a|an)/i,
  /pretend (to be|you're)/i,
  /imagine you('re| are)/i,
  /take (on )?the role of/i,
  /as (a|an) \w+,/i,
  /<role>/i,
  /\[role\]/i,
];

/**
 * Context marker patterns
 */
const CONTEXT_MARKERS = [
  /context:/i,
  /background:/i,
  /given (that|the following)/i,
  /here('s| is) (the|some) (context|background|information)/i,
  /for context/i,
  /<context>/i,
  /\[context\]/i,
  /## context/i,
  /### context/i,
];

/**
 * Built-in linting rules
 */
export const DEFAULT_RULES: LintRule[] = [
  {
    id: 'prompt-length-min',
    name: 'Minimum Prompt Length',
    description: 'Prompts should be at least 50 characters to provide sufficient context',
    severity: 'warning',
    check: (prompt: string) => {
      if (prompt.trim().length < 50) {
        return {
          message: `Prompt is too short (${prompt.trim().length} characters). Consider adding more context or details.`,
          suggestion: 'Add more context about your task, expected output format, or constraints.',
        };
      }
      return null;
    },
  },
  {
    id: 'prompt-length-max',
    name: 'Maximum Prompt Length',
    description: 'Prompts over 10000 characters may be hard to process efficiently',
    severity: 'warning',
    check: (prompt: string) => {
      if (prompt.trim().length > 10000) {
        return {
          message: `Prompt is very long (${prompt.trim().length} characters). Consider breaking it into smaller prompts.`,
          suggestion: 'Split the prompt into multiple focused prompts or use a hierarchical approach.',
        };
      }
      return null;
    },
  },
  {
    id: 'clarity-vague-words',
    name: 'Vague Words Detection',
    description: 'Detects vague or imprecise words that reduce prompt clarity',
    severity: 'warning',
    check: (prompt: string) => {
      const violations: LintViolation[] = [];
      const lines = prompt.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        for (const word of VAGUE_WORDS) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          let match;
          while ((match = regex.exec(line)) !== null) {
            violations.push({
              message: `Vague word detected: "${match[0]}"`,
              line: lineIndex + 1,
              column: match.index + 1,
              suggestion: `Replace "${match[0]}" with a more specific term`,
            });
          }
        }
      }

      return violations.length > 0 ? violations : null;
    },
  },
  {
    id: 'specificity-context',
    name: 'Context Markers',
    description: 'Suggests adding context markers for better prompt structure',
    severity: 'info',
    check: (prompt: string) => {
      const hasContextMarker = CONTEXT_MARKERS.some(pattern => pattern.test(prompt));

      if (!hasContextMarker && prompt.length > 200) {
        return {
          message: 'No explicit context section found in a longer prompt',
          suggestion: 'Consider adding a "Context:" section or using XML tags like <context></context> to clearly separate context from instructions',
        };
      }
      return null;
    },
  },
  {
    id: 'instruction-ambiguity',
    name: 'Ambiguous Instructions',
    description: 'Detects instructions that are too vague or subjective',
    severity: 'warning',
    check: (prompt: string) => {
      const violations: LintViolation[] = [];
      const lines = prompt.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        for (const { pattern, message } of AMBIGUOUS_PATTERNS) {
          let match;
          const regex = new RegExp(pattern.source, pattern.flags);
          while ((match = regex.exec(line)) !== null) {
            violations.push({
              message: `${message}: "${match[0]}"`,
              line: lineIndex + 1,
              column: match.index + 1,
              suggestion: 'Be specific about what you want. Define concrete criteria or examples.',
            });
          }
        }
      }

      return violations.length > 0 ? violations : null;
    },
  },
  {
    id: 'role-definition',
    name: 'Role Definition',
    description: 'Suggests adding a role definition for better prompt performance',
    severity: 'info',
    check: (prompt: string) => {
      const hasRole = ROLE_PATTERNS.some(pattern => pattern.test(prompt));

      if (!hasRole && prompt.length > 100) {
        return {
          message: 'No role definition found',
          suggestion: 'Consider starting with "You are a [role]..." to give the AI a clear persona and expertise area',
        };
      }
      return null;
    },
  },
  {
    id: 'output-format',
    name: 'Output Format Specification',
    description: 'Checks if output format is specified for longer prompts',
    severity: 'info',
    check: (prompt: string) => {
      const formatIndicators = [
        /output (format|as|in)/i,
        /format (your|the) (response|output|answer)/i,
        /respond (in|with|using)/i,
        /return (as|in|a)/i,
        /provide (your|the) (response|answer|output) (as|in)/i,
        /<output>/i,
        /\[output\]/i,
        /```/,
        /json/i,
        /markdown/i,
        /bullet points?/i,
        /numbered list/i,
        /table/i,
      ];

      const hasFormatSpec = formatIndicators.some(pattern => pattern.test(prompt));

      if (!hasFormatSpec && prompt.length > 150) {
        return {
          message: 'No explicit output format specified',
          suggestion: 'Consider specifying the desired output format (JSON, markdown, bullet points, etc.)',
        };
      }
      return null;
    },
  },
  {
    id: 'examples-present',
    name: 'Examples Check',
    description: 'Suggests adding examples for complex prompts',
    severity: 'info',
    check: (prompt: string) => {
      const exampleIndicators = [
        /for example/i,
        /example:/i,
        /e\.g\./i,
        /such as/i,
        /like this:/i,
        /here('s| is) an example/i,
        /<example>/i,
        /\[example\]/i,
        /input:.*output:/is,
        /## example/i,
      ];

      const hasExample = exampleIndicators.some(pattern => pattern.test(prompt));

      if (!hasExample && prompt.length > 300) {
        return {
          message: 'No examples found in a longer prompt',
          suggestion: 'Consider adding one or more examples to clarify expected behavior (few-shot prompting)',
        };
      }
      return null;
    },
  },
  {
    id: 'empty-prompt',
    name: 'Empty Prompt',
    description: 'Detects empty or whitespace-only prompts',
    severity: 'error',
    check: (prompt: string) => {
      if (prompt.trim().length === 0) {
        return {
          message: 'Prompt is empty or contains only whitespace',
          suggestion: 'Add content to your prompt',
        };
      }
      return null;
    },
  },
  {
    id: 'repeated-instructions',
    name: 'Repeated Instructions',
    description: 'Detects potentially repeated or redundant instructions',
    severity: 'warning',
    check: (prompt: string) => {
      const lines = prompt.split('\n').filter(line => line.trim().length > 10);
      const violations: LintViolation[] = [];

      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const similarity = calculateSimilarity(lines[i].trim().toLowerCase(), lines[j].trim().toLowerCase());
          if (similarity > 0.8) {
            violations.push({
              message: `Possible repeated instruction on lines ${i + 1} and ${j + 1}`,
              line: j + 1,
              suggestion: 'Remove duplicate instructions to improve clarity',
            });
          }
        }
      }

      return violations.length > 0 ? violations : null;
    },
  },
];

/**
 * Simple string similarity calculation (Jaccard similarity on words)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Get all available rule IDs
 */
export function getRuleIds(): string[] {
  return DEFAULT_RULES.map(rule => rule.id);
}

/**
 * Get a rule by ID
 */
export function getRuleById(id: string): LintRule | undefined {
  return DEFAULT_RULES.find(rule => rule.id === id);
}

/**
 * Filter rules by severity
 */
export function getRulesBySeverity(severity: Severity): LintRule[] {
  return DEFAULT_RULES.filter(rule => rule.severity === severity);
}
