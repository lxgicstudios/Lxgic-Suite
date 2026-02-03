import {
  PipelineConfig,
  PipelineStep,
  StepResult,
  PipelineContext
} from './core';
import { stepExecutors } from './steps';

export interface PipelineResult {
  name: string;
  success: boolean;
  results: StepResult[];
  totalDuration: number;
  output: any;
}

export interface PipelineOptions {
  input?: any;
  variables?: Record<string, any>;
  onStepStart?: (step: PipelineStep) => void;
  onStepComplete?: (step: PipelineStep, result: StepResult) => void;
  onStepError?: (step: PipelineStep, error: Error) => void;
}

export async function runPipeline(
  config: PipelineConfig,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const results: StepResult[] = [];

  const context: PipelineContext = {
    variables: { ...config.variables, ...options.variables },
    results: new Map(),
    input: options.input || ''
  };

  const errorStrategy = config.errorHandling?.strategy || 'stop';

  // Group steps for parallel execution
  const stepGroups = groupStepsForExecution(config.steps);

  for (const group of stepGroups) {
    if (group.length === 1) {
      // Sequential execution
      const step = group[0];
      const result = await executeStep(step, context, options);
      results.push(result);
      context.results.set(step.id, result);

      if (!result.success && errorStrategy === 'stop') {
        return {
          name: config.name,
          success: false,
          results,
          totalDuration: Date.now() - startTime,
          output: result.error
        };
      }
    } else {
      // Parallel execution
      const parallelResults = await Promise.all(
        group.map(step => executeStep(step, context, options))
      );

      for (let i = 0; i < group.length; i++) {
        const step = group[i];
        const result = parallelResults[i];
        results.push(result);
        context.results.set(step.id, result);

        if (!result.success && errorStrategy === 'stop') {
          return {
            name: config.name,
            success: false,
            results,
            totalDuration: Date.now() - startTime,
            output: result.error
          };
        }
      }
    }
  }

  // Get final output from last step
  const lastStep = config.steps[config.steps.length - 1];
  const lastResult = context.results.get(lastStep.id);

  return {
    name: config.name,
    success: results.every(r => r.success),
    results,
    totalDuration: Date.now() - startTime,
    output: lastResult?.output
  };
}

async function executeStep(
  step: PipelineStep,
  context: PipelineContext,
  options: PipelineOptions
): Promise<StepResult> {
  options.onStepStart?.(step);

  const executor = stepExecutors[step.type];
  if (!executor) {
    const result: StepResult = {
      id: step.id,
      output: null,
      success: false,
      error: `Unknown step type: ${step.type}`,
      duration: 0,
      retries: 0
    };
    options.onStepError?.(step, new Error(result.error));
    return result;
  }

  try {
    const result = await executor(step, context);
    options.onStepComplete?.(step, result);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onStepError?.(step, err);
    return {
      id: step.id,
      output: null,
      success: false,
      error: err.message,
      duration: 0,
      retries: 0
    };
  }
}

function groupStepsForExecution(steps: PipelineStep[]): PipelineStep[][] {
  const groups: PipelineStep[][] = [];
  let currentGroup: PipelineStep[] = [];

  for (const step of steps) {
    if (step.parallel && currentGroup.length > 0) {
      currentGroup.push(step);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [step];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export function visualizePipeline(config: PipelineConfig): string {
  const lines: string[] = [];
  const width = 60;

  // Header
  lines.push('');
  lines.push('=' .repeat(width));
  lines.push(centerText(`Pipeline: ${config.name}`, width));
  if (config.description) {
    lines.push(centerText(config.description, width));
  }
  lines.push('=' .repeat(width));
  lines.push('');

  // Build dependency graph
  const deps = buildDependencyGraph(config.steps);

  // Draw steps
  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i];
    const isLast = i === config.steps.length - 1;
    const stepDeps = deps.get(step.id) || [];

    // Step box
    const boxWidth = 40;
    const typeLabel = `[${step.type.toUpperCase()}]`;
    const idLine = `  ${step.id} ${typeLabel}`;

    lines.push('    ' + '+' + '-'.repeat(boxWidth - 2) + '+');
    lines.push('    ' + '|' + padRight(idLine, boxWidth - 2) + '|');

    // Show details based on type
    let details = '';
    switch (step.type) {
      case 'prompt':
        details = step.template ? truncate(step.template, boxWidth - 6) : '';
        break;
      case 'transform':
        details = `Transform: ${step.transform}`;
        break;
      case 'filter':
        details = `Condition: ${truncate(step.condition || '', boxWidth - 16)}`;
        break;
      case 'branch':
        details = `Branches: ${step.branches?.length || 0}`;
        break;
      case 'merge':
        details = `Sources: ${step.sources?.join(', ') || ''}`;
        break;
    }

    if (details) {
      lines.push('    ' + '|' + '  ' + padRight(details, boxWidth - 4) + '|');
    }

    if (stepDeps.length > 0) {
      lines.push('    ' + '|' + '  ' + padRight(`Deps: ${stepDeps.join(', ')}`, boxWidth - 4) + '|');
    }

    if (step.retries) {
      lines.push('    ' + '|' + '  ' + padRight(`Retries: ${step.retries}`, boxWidth - 4) + '|');
    }

    lines.push('    ' + '+' + '-'.repeat(boxWidth - 2) + '+');

    // Arrow to next step
    if (!isLast) {
      lines.push('    ' + ' '.repeat(boxWidth / 2 - 1) + '|');
      lines.push('    ' + ' '.repeat(boxWidth / 2 - 1) + 'v');
    }

    lines.push('');
  }

  // Footer
  lines.push('=' .repeat(width));
  lines.push(centerText(`Total Steps: ${config.steps.length}`, width));
  lines.push('=' .repeat(width));
  lines.push('');

  return lines.join('\n');
}

function buildDependencyGraph(steps: PipelineStep[]): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  const stepIds = new Set(steps.map(s => s.id));

  for (const step of steps) {
    const stepDeps: string[] = [];

    // Check for variable references to other steps
    const allText = [step.template, step.input, step.condition].filter(Boolean).join(' ');
    const varMatches = allText.match(/\{\{(\w+)(?:\.\w+)*\}\}/g) || [];

    for (const match of varMatches) {
      const varName = match.slice(2, -2).split('.')[0];
      if (stepIds.has(varName) && varName !== step.id) {
        if (!stepDeps.includes(varName)) {
          stepDeps.push(varName);
        }
      }
    }

    // Check merge sources
    if (step.type === 'merge' && step.sources) {
      for (const source of step.sources) {
        if (stepIds.has(source) && !stepDeps.includes(source)) {
          stepDeps.push(source);
        }
      }
    }

    deps.set(step.id, stepDeps);
  }

  return deps;
}

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

function padRight(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  return text + ' '.repeat(width - text.length);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
