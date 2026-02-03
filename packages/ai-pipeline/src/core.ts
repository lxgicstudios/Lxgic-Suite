import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface PipelineStep {
  id: string;
  type: 'prompt' | 'transform' | 'filter' | 'branch' | 'merge';
  template?: string;
  input?: string;
  transform?: string;
  condition?: string;
  branches?: { condition: string; steps: string[] }[];
  sources?: string[];
  retries?: number;
  parallel?: boolean;
  timeout?: number;
}

export interface PipelineConfig {
  name: string;
  description?: string;
  version?: string;
  variables?: Record<string, any>;
  steps: PipelineStep[];
  errorHandling?: {
    strategy: 'stop' | 'continue' | 'retry';
    maxRetries?: number;
  };
}

export interface StepResult {
  id: string;
  output: any;
  success: boolean;
  error?: string;
  duration: number;
  retries: number;
}

export interface PipelineContext {
  variables: Record<string, any>;
  results: Map<string, StepResult>;
  input: any;
}

export function loadPipeline(filePath: string): PipelineConfig {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Pipeline file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const config = yaml.load(content) as PipelineConfig;

  if (!config.name) {
    throw new Error('Pipeline must have a name');
  }

  if (!config.steps || !Array.isArray(config.steps) || config.steps.length === 0) {
    throw new Error('Pipeline must have at least one step');
  }

  return config;
}

export function validatePipeline(config: PipelineConfig): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stepIds = new Set<string>();

  // Validate name
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Pipeline name is required and must be a string');
  }

  // Validate steps
  if (!config.steps || !Array.isArray(config.steps)) {
    errors.push('Pipeline must have a steps array');
    return { valid: false, errors, warnings };
  }

  for (const step of config.steps) {
    // Validate step ID
    if (!step.id) {
      errors.push('Each step must have an id');
      continue;
    }

    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    }
    stepIds.add(step.id);

    // Validate step type
    const validTypes = ['prompt', 'transform', 'filter', 'branch', 'merge'];
    if (!step.type || !validTypes.includes(step.type)) {
      errors.push(`Step "${step.id}" has invalid type: ${step.type}. Valid types: ${validTypes.join(', ')}`);
    }

    // Type-specific validation
    switch (step.type) {
      case 'prompt':
        if (!step.template) {
          errors.push(`Prompt step "${step.id}" must have a template`);
        }
        break;

      case 'transform':
        if (!step.transform) {
          errors.push(`Transform step "${step.id}" must have a transform type`);
        }
        break;

      case 'branch':
        if (!step.branches || !Array.isArray(step.branches)) {
          errors.push(`Branch step "${step.id}" must have a branches array`);
        }
        break;

      case 'merge':
        if (!step.sources || !Array.isArray(step.sources)) {
          errors.push(`Merge step "${step.id}" must have a sources array`);
        }
        break;
    }

    // Check for variable references
    const allText = [step.template, step.input, step.condition].filter(Boolean).join(' ');
    const varMatches = allText.match(/\{\{(\w+(?:\.\w+)*)\}\}/g) || [];

    for (const match of varMatches) {
      const varPath = match.slice(2, -2).split('.')[0];
      // Check if it references a step that hasn't been defined yet (for non-parallel)
      if (varPath !== 'input' && !stepIds.has(varPath) && !config.variables?.[varPath]) {
        warnings.push(`Step "${step.id}" references undefined variable or step: ${varPath}`);
      }
    }

    // Validate retries
    if (step.retries !== undefined && (typeof step.retries !== 'number' || step.retries < 0)) {
      errors.push(`Step "${step.id}" has invalid retries value`);
    }

    // Validate timeout
    if (step.timeout !== undefined && (typeof step.timeout !== 'number' || step.timeout <= 0)) {
      errors.push(`Step "${step.id}" has invalid timeout value`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function resolveVariables(template: string, context: PipelineContext): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
    const parts = varPath.split('.');
    let value: any;

    if (parts[0] === 'input') {
      value = context.input;
      parts.shift();
    } else if (context.results.has(parts[0])) {
      const result = context.results.get(parts[0])!;
      value = result.output;
      parts.shift();
    } else if (context.variables[parts[0]] !== undefined) {
      value = context.variables[parts[0]];
      parts.shift();
    } else {
      return match; // Keep original if not found
    }

    // Navigate nested properties
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return match;
      }
    }

    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

export function formatOutput(data: any, json: boolean): string {
  if (json) {
    return JSON.stringify(data, null, 2);
  }

  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  }

  return String(data);
}
