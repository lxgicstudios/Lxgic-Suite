import { loadPipeline, validatePipeline, Pipeline, ValidationResult, serializePipeline, createEmptyPipeline } from './pipeline.js';
import { executePipeline, PipelineResult, ExecutorOptions, PipelineExecutor } from './executor.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Result of running a pipeline
 */
export interface RunResult {
  success: boolean;
  result?: PipelineResult;
  error?: string;
}

/**
 * Result of validating a pipeline
 */
export interface ValidateResult {
  success: boolean;
  validation?: ValidationResult;
  pipeline?: Pipeline;
  error?: string;
}

/**
 * Options for running a pipeline
 */
export interface RunOptions extends ExecutorOptions {
  variables?: Record<string, string>;
}

/**
 * Load, validate, and run a pipeline from a YAML file
 */
export async function runPipelineFile(
  filePath: string,
  options: RunOptions = {}
): Promise<RunResult> {
  try {
    // Load the pipeline
    const pipeline = await loadPipeline(filePath);

    // Validate the pipeline
    const validation = validatePipeline(pipeline);

    if (!validation.valid) {
      const errorMessages = validation.errors
        .filter(e => e.severity === 'error')
        .map(e => `${e.path}: ${e.message}`)
        .join('\n');

      return {
        success: false,
        error: `Pipeline validation failed:\n${errorMessages}`,
      };
    }

    // Execute the pipeline
    const result = await executePipeline(pipeline, options.variables || {}, options);

    return {
      success: result.success,
      result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate a pipeline file without running it
 */
export async function validatePipelineFile(filePath: string): Promise<ValidateResult> {
  try {
    const pipeline = await loadPipeline(filePath);
    const validation = validatePipeline(pipeline);

    return {
      success: validation.valid,
      validation,
      pipeline,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a new pipeline file from template
 */
export async function createPipelineFile(
  outputPath: string,
  name: string,
  options: { force?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const resolvedPath = path.resolve(outputPath);

  try {
    // Check if file exists
    try {
      await fs.access(resolvedPath);
      if (!options.force) {
        return {
          success: false,
          error: `File already exists: ${outputPath}. Use --force to overwrite.`,
        };
      }
    } catch {
      // File doesn't exist, good to proceed
    }

    const pipeline = createEmptyPipeline(name);
    const yamlContent = serializePipeline(pipeline);

    await fs.writeFile(resolvedPath, yamlContent, 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get a summary of a pipeline
 */
export async function getPipelineSummary(filePath: string): Promise<{
  success: boolean;
  summary?: {
    name: string;
    description?: string;
    version?: string;
    stepCount: number;
    steps: { name: string; output: string }[];
    variables: string[];
    hasConditions: boolean;
    hasLoops: boolean;
  };
  error?: string;
}> {
  try {
    const pipeline = await loadPipeline(filePath);

    const variableSet = new Set<string>();

    // Extract variables from all prompts
    for (const step of pipeline.steps) {
      const matches = step.prompt.matchAll(/\{\{(\w+)\}\}/g);
      for (const match of matches) {
        variableSet.add(match[1]);
      }
    }

    // Add initial variables
    if (pipeline.variables) {
      Object.keys(pipeline.variables).forEach(v => variableSet.add(v));
    }

    return {
      success: true,
      summary: {
        name: pipeline.name,
        description: pipeline.description,
        version: pipeline.version,
        stepCount: pipeline.steps.length,
        steps: pipeline.steps.map(s => ({ name: s.name, output: s.output })),
        variables: Array.from(variableSet),
        hasConditions: pipeline.steps.some(s => s.condition),
        hasLoops: pipeline.steps.some(s => s.loop),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute a pipeline with streaming progress
 */
export async function runPipelineWithProgress(
  filePath: string,
  options: RunOptions & {
    onProgress?: (step: string, status: 'start' | 'complete' | 'error', message?: string) => void;
  } = {}
): Promise<RunResult> {
  try {
    const pipeline = await loadPipeline(filePath);
    const validation = validatePipeline(pipeline);

    if (!validation.valid) {
      return {
        success: false,
        error: `Pipeline validation failed`,
      };
    }

    const executor = new PipelineExecutor({
      ...options,
      onStepStart: (step) => {
        options.onProgress?.(step.name, 'start');
      },
      onStepComplete: (result) => {
        if (result.success) {
          options.onProgress?.(result.stepName, 'complete');
        } else {
          options.onProgress?.(result.stepName, 'error', result.error);
        }
      },
    });

    const result = await executor.execute(pipeline, options.variables || {});

    return {
      success: result.success,
      result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Re-export types and functions for external use
export type { Pipeline, Step, ValidationResult } from './pipeline.js';
export type { PipelineResult, StepResult, ExecutorOptions } from './executor.js';
