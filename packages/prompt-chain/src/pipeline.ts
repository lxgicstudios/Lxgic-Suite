import { z } from 'zod';
import yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Schema for conditional branching
 */
export const ConditionSchema = z.object({
  if: z.string().describe('JavaScript expression to evaluate'),
  then: z.string().describe('Step name to execute if condition is true'),
  else: z.string().optional().describe('Step name to execute if condition is false'),
});

export type Condition = z.infer<typeof ConditionSchema>;

/**
 * Schema for loop configuration
 */
export const LoopSchema = z.object({
  over: z.string().describe('Variable name containing array to iterate over'),
  as: z.string().describe('Variable name for current item'),
  maxIterations: z.number().optional().default(100).describe('Maximum iterations to prevent infinite loops'),
});

export type Loop = z.infer<typeof LoopSchema>;

/**
 * Schema for a pipeline step
 */
export const StepSchema = z.object({
  name: z.string().min(1).describe('Unique identifier for this step'),
  prompt: z.string().min(1).describe('Prompt template with {{variable}} placeholders'),
  input: z.union([z.string(), z.record(z.string())]).optional().describe('Input from previous step or variables'),
  output: z.string().min(1).describe('Variable name to store the result'),
  condition: ConditionSchema.optional().describe('Conditional execution'),
  loop: LoopSchema.optional().describe('Loop configuration'),
  model: z.string().optional().default('claude-sonnet-4-20250514').describe('Model to use for this step'),
  maxTokens: z.number().optional().default(2000).describe('Maximum tokens for response'),
  temperature: z.number().min(0).max(1).optional().describe('Temperature for response'),
  continueOnError: z.boolean().optional().default(false).describe('Continue pipeline if this step fails'),
});

export type Step = z.infer<typeof StepSchema>;

/**
 * Schema for pipeline configuration
 */
export const PipelineSchema = z.object({
  name: z.string().min(1).describe('Pipeline name'),
  description: z.string().optional().describe('Pipeline description'),
  version: z.string().optional().default('1.0.0'),
  variables: z.record(z.string()).optional().describe('Initial variables'),
  steps: z.array(StepSchema).min(1).describe('Pipeline steps'),
  onError: z.enum(['stop', 'continue', 'retry']).optional().default('stop'),
  maxRetries: z.number().optional().default(3),
});

export type Pipeline = z.infer<typeof PipelineSchema>;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Load and parse a pipeline from a YAML file
 */
export async function loadPipeline(filePath: string): Promise<Pipeline> {
  const resolvedPath = path.resolve(filePath);

  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const parsed = yaml.load(content);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML: expected an object');
    }

    return PipelineSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Pipeline validation failed:\n${messages}`);
    }
    throw error;
  }
}

/**
 * Validate a pipeline configuration
 */
export function validatePipeline(pipeline: Pipeline): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check for unique step names
  const stepNames = new Set<string>();
  for (const step of pipeline.steps) {
    if (stepNames.has(step.name)) {
      errors.push({
        path: `steps.${step.name}`,
        message: `Duplicate step name: ${step.name}`,
        severity: 'error',
      });
    }
    stepNames.add(step.name);
  }

  // Check for unique output names
  const outputNames = new Set<string>();
  for (const step of pipeline.steps) {
    if (outputNames.has(step.output)) {
      warnings.push(`Multiple steps write to the same output variable: ${step.output}`);
    }
    outputNames.add(step.output);
  }

  // Validate step references
  for (const step of pipeline.steps) {
    // Check input references
    if (typeof step.input === 'string' && step.input.startsWith('$')) {
      const refName = step.input.slice(1);
      if (!outputNames.has(refName) && !pipeline.variables?.[refName]) {
        errors.push({
          path: `steps.${step.name}.input`,
          message: `Referenced variable not defined: ${refName}`,
          severity: 'error',
        });
      }
    }

    // Check condition references
    if (step.condition) {
      if (!stepNames.has(step.condition.then)) {
        errors.push({
          path: `steps.${step.name}.condition.then`,
          message: `Referenced step not found: ${step.condition.then}`,
          severity: 'error',
        });
      }
      if (step.condition.else && !stepNames.has(step.condition.else)) {
        errors.push({
          path: `steps.${step.name}.condition.else`,
          message: `Referenced step not found: ${step.condition.else}`,
          severity: 'error',
        });
      }
    }

    // Check loop references
    if (step.loop) {
      if (!outputNames.has(step.loop.over) && !pipeline.variables?.[step.loop.over]) {
        warnings.push(`Loop variable may not exist at runtime: ${step.loop.over}`);
      }
    }
  }

  // Check for potential infinite loops
  const loopSteps = pipeline.steps.filter(s => s.loop);
  for (const step of loopSteps) {
    if (!step.loop?.maxIterations || step.loop.maxIterations > 1000) {
      warnings.push(`Step "${step.name}" loop has high or no iteration limit`);
    }
  }

  // Check for unused outputs
  const usedOutputs = new Set<string>();
  for (const step of pipeline.steps) {
    // Extract variable references from prompt
    const matches = step.prompt.matchAll(/\{\{(\w+)\}\}/g);
    for (const match of matches) {
      usedOutputs.add(match[1]);
    }

    // Check input references
    if (typeof step.input === 'string' && step.input.startsWith('$')) {
      usedOutputs.add(step.input.slice(1));
    }
  }

  for (const step of pipeline.steps) {
    if (!usedOutputs.has(step.output) && step !== pipeline.steps[pipeline.steps.length - 1]) {
      warnings.push(`Output "${step.output}" from step "${step.name}" is never used`);
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    warnings,
  };
}

/**
 * Extract all variable placeholders from a prompt
 */
export function extractPromptVariables(prompt: string): string[] {
  const matches = prompt.matchAll(/\{\{(\w+)\}\}/g);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Get the execution order of steps considering conditions and loops
 */
export function getExecutionOrder(pipeline: Pipeline): string[] {
  // For now, simple linear order
  // Could be enhanced to build a dependency graph
  return pipeline.steps.map(s => s.name);
}

/**
 * Serialize a pipeline back to YAML
 */
export function serializePipeline(pipeline: Pipeline): string {
  return yaml.dump(pipeline, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
  });
}

/**
 * Create an empty pipeline template
 */
export function createEmptyPipeline(name: string): Pipeline {
  return {
    name,
    version: '1.0.0',
    steps: [
      {
        name: 'step1',
        prompt: 'Your prompt here with {{input}}',
        output: 'result',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2000,
        continueOnError: false,
      },
    ],
    onError: 'stop',
    maxRetries: 3,
  };
}

/**
 * Merge initial variables with step outputs
 */
export function buildContext(
  initialVars: Record<string, string> = {},
  stepOutputs: Record<string, string> = {}
): Record<string, string> {
  return {
    ...initialVars,
    ...stepOutputs,
  };
}
