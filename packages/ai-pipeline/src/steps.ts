import { PipelineStep, StepResult, PipelineContext, resolveVariables } from './core';

export type StepExecutor = (
  step: PipelineStep,
  context: PipelineContext
) => Promise<StepResult>;

async function simulateAICall(prompt: string): Promise<string> {
  // Simulate AI processing with a mock response
  await new Promise(resolve => setTimeout(resolve, 100));
  return `[AI Response to: "${prompt.substring(0, 50)}..."]`;
}

export async function executePromptStep(
  step: PipelineStep,
  context: PipelineContext
): Promise<StepResult> {
  const startTime = Date.now();
  let retries = 0;
  const maxRetries = step.retries || 0;

  while (true) {
    try {
      let input = step.input ? resolveVariables(step.input, context) : context.input;
      const template = resolveVariables(step.template || '{{input}}', {
        ...context,
        input
      });

      const output = await simulateAICall(template);

      return {
        id: step.id,
        output,
        success: true,
        duration: Date.now() - startTime,
        retries
      };
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        return {
          id: step.id,
          output: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          retries
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}

export async function executeTransformStep(
  step: PipelineStep,
  context: PipelineContext
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    let input = step.input ? resolveVariables(step.input, context) : context.input;

    let output: any;
    switch (step.transform) {
      case 'json':
        try {
          output = typeof input === 'string' ? JSON.parse(input) : input;
        } catch {
          output = { value: input };
        }
        break;

      case 'text':
        output = typeof input === 'object' ? JSON.stringify(input) : String(input);
        break;

      case 'uppercase':
        output = String(input).toUpperCase();
        break;

      case 'lowercase':
        output = String(input).toLowerCase();
        break;

      case 'trim':
        output = String(input).trim();
        break;

      case 'split':
        output = String(input).split('\n');
        break;

      case 'join':
        output = Array.isArray(input) ? input.join('\n') : String(input);
        break;

      case 'array':
        output = Array.isArray(input) ? input : [input];
        break;

      case 'first':
        output = Array.isArray(input) ? input[0] : input;
        break;

      case 'last':
        output = Array.isArray(input) ? input[input.length - 1] : input;
        break;

      case 'count':
        output = Array.isArray(input) ? input.length : String(input).length;
        break;

      case 'keys':
        output = typeof input === 'object' && input !== null ? Object.keys(input) : [];
        break;

      case 'values':
        output = typeof input === 'object' && input !== null ? Object.values(input) : [input];
        break;

      default:
        output = input;
    }

    return {
      id: step.id,
      output,
      success: true,
      duration: Date.now() - startTime,
      retries: 0
    };
  } catch (error) {
    return {
      id: step.id,
      output: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      retries: 0
    };
  }
}

export async function executeFilterStep(
  step: PipelineStep,
  context: PipelineContext
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    let input = step.input ? resolveVariables(step.input, context) : context.input;
    const condition = step.condition ? resolveVariables(step.condition, context) : 'true';

    let output: any;
    if (Array.isArray(input)) {
      output = input.filter(item => {
        const itemContext = { ...context, variables: { ...context.variables, item } };
        const resolved = resolveVariables(condition, itemContext);
        return evaluateCondition(resolved, item);
      });
    } else {
      const passes = evaluateCondition(condition, input);
      output = passes ? input : null;
    }

    return {
      id: step.id,
      output,
      success: true,
      duration: Date.now() - startTime,
      retries: 0
    };
  } catch (error) {
    return {
      id: step.id,
      output: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      retries: 0
    };
  }
}

export async function executeBranchStep(
  step: PipelineStep,
  context: PipelineContext
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    let input = step.input ? resolveVariables(step.input, context) : context.input;

    let selectedBranch: string[] = [];
    for (const branch of step.branches || []) {
      const condition = resolveVariables(branch.condition, context);
      if (evaluateCondition(condition, input)) {
        selectedBranch = branch.steps;
        break;
      }
    }

    return {
      id: step.id,
      output: { selectedBranch, input },
      success: true,
      duration: Date.now() - startTime,
      retries: 0
    };
  } catch (error) {
    return {
      id: step.id,
      output: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      retries: 0
    };
  }
}

export async function executeMergeStep(
  step: PipelineStep,
  context: PipelineContext
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    const sources = step.sources || [];
    const outputs: any[] = [];

    for (const sourceId of sources) {
      const result = context.results.get(sourceId);
      if (result && result.success) {
        outputs.push(result.output);
      }
    }

    const output = outputs.length === 1 ? outputs[0] : outputs;

    return {
      id: step.id,
      output,
      success: true,
      duration: Date.now() - startTime,
      retries: 0
    };
  } catch (error) {
    return {
      id: step.id,
      output: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      retries: 0
    };
  }
}

function evaluateCondition(condition: string, value: any): boolean {
  const trimmed = condition.trim().toLowerCase();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Check for comparison operators
  if (condition.includes('==')) {
    const [left, right] = condition.split('==').map(s => s.trim());
    return String(value) === right || left === right;
  }

  if (condition.includes('!=')) {
    const [left, right] = condition.split('!=').map(s => s.trim());
    return String(value) !== right && left !== right;
  }

  if (condition.includes('contains')) {
    const match = condition.match(/contains\s*['"](.+)['"]/);
    if (match) {
      return String(value).includes(match[1]);
    }
  }

  if (condition.includes('startsWith')) {
    const match = condition.match(/startsWith\s*['"](.+)['"]/);
    if (match) {
      return String(value).startsWith(match[1]);
    }
  }

  if (condition.includes('endsWith')) {
    const match = condition.match(/endsWith\s*['"](.+)['"]/);
    if (match) {
      return String(value).endsWith(match[1]);
    }
  }

  if (condition.includes('length')) {
    const match = condition.match(/length\s*(>|<|>=|<=|==)\s*(\d+)/);
    if (match) {
      const len = Array.isArray(value) ? value.length : String(value).length;
      const op = match[1];
      const num = parseInt(match[2], 10);

      switch (op) {
        case '>': return len > num;
        case '<': return len < num;
        case '>=': return len >= num;
        case '<=': return len <= num;
        case '==': return len === num;
      }
    }
  }

  // Default: check if value is truthy
  return Boolean(value);
}

export const stepExecutors: Record<string, StepExecutor> = {
  prompt: executePromptStep,
  transform: executeTransformStep,
  filter: executeFilterStep,
  branch: executeBranchStep,
  merge: executeMergeStep
};
