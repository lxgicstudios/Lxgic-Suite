import Anthropic from '@anthropic-ai/sdk';
import Mustache from 'mustache';
import { Pipeline, Step, extractPromptVariables, buildContext } from './pipeline.js';

/**
 * Step execution result
 */
export interface StepResult {
  stepName: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  pipelineName: string;
  success: boolean;
  startTime: string;
  endTime: string;
  duration: number;
  stepResults: StepResult[];
  finalOutput: Record<string, string>;
  error?: string;
}

/**
 * Execution options
 */
export interface ExecutorOptions {
  apiKey?: string;
  verbose?: boolean;
  dryRun?: boolean;
  maxConcurrent?: number;
  onStepStart?: (step: Step) => void;
  onStepComplete?: (result: StepResult) => void;
}

/**
 * Pipeline executor class
 */
export class PipelineExecutor {
  private client: Anthropic | null = null;
  private options: ExecutorOptions;
  private context: Record<string, string> = {};
  private stepOutputs: Record<string, string> = {};

  constructor(options: ExecutorOptions = {}) {
    this.options = options;

    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (apiKey && !options.dryRun) {
      this.client = new Anthropic({ apiKey });
    }
  }

  /**
   * Execute a complete pipeline
   */
  async execute(
    pipeline: Pipeline,
    initialVariables: Record<string, string> = {}
  ): Promise<PipelineResult> {
    const startTime = new Date();
    const stepResults: StepResult[] = [];

    // Initialize context with pipeline variables and initial variables
    this.context = buildContext(pipeline.variables, initialVariables);
    this.stepOutputs = {};

    try {
      for (const step of pipeline.steps) {
        // Check if we should execute this step
        if (step.condition) {
          const shouldExecute = this.evaluateCondition(step.condition.if);

          if (!shouldExecute) {
            const skipResult: StepResult = {
              stepName: step.name,
              success: true,
              skipped: true,
              skipReason: 'Condition not met',
              duration: 0,
            };
            stepResults.push(skipResult);
            this.options.onStepComplete?.(skipResult);

            // Jump to else step if specified
            if (step.condition.else) {
              const elseStepIndex = pipeline.steps.findIndex(
                s => s.name === step.condition!.else
              );
              if (elseStepIndex !== -1) {
                // This is handled by the linear execution, condition tracking would need state
              }
            }
            continue;
          }
        }

        // Handle loops
        if (step.loop) {
          const loopResults = await this.executeLoop(step, pipeline);
          stepResults.push(...loopResults);
          continue;
        }

        // Execute the step
        this.options.onStepStart?.(step);
        const result = await this.executeStep(step);
        stepResults.push(result);
        this.options.onStepComplete?.(result);

        // Handle errors
        if (!result.success) {
          if (pipeline.onError === 'stop' && !step.continueOnError) {
            break;
          } else if (pipeline.onError === 'retry') {
            const retryResult = await this.retryStep(step, pipeline.maxRetries || 3);
            if (!retryResult.success && !step.continueOnError) {
              stepResults.push(retryResult);
              break;
            }
            stepResults.push(retryResult);
          }
        }

        // Store output in context
        if (result.success && result.output) {
          this.stepOutputs[step.output] = result.output;
          this.context = buildContext(this.context, this.stepOutputs);
        }
      }

      const endTime = new Date();
      const allSuccessful = stepResults.every(r => r.success || r.skipped);

      return {
        pipelineName: pipeline.name,
        success: allSuccessful,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        stepResults,
        finalOutput: this.stepOutputs,
      };
    } catch (error) {
      const endTime = new Date();

      return {
        pipelineName: pipeline.name,
        success: false,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        stepResults,
        finalOutput: this.stepOutputs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: Step): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // Prepare the prompt by substituting variables
      const prompt = this.renderPrompt(step.prompt);

      // Check for missing variables
      const requiredVars = extractPromptVariables(step.prompt);
      const missingVars = requiredVars.filter(v => !(v in this.context));

      if (missingVars.length > 0) {
        return {
          stepName: step.name,
          success: false,
          error: `Missing required variables: ${missingVars.join(', ')}`,
          duration: Date.now() - startTime,
        };
      }

      // Dry run mode - just show what would happen
      if (this.options.dryRun || !this.client) {
        return {
          stepName: step.name,
          success: true,
          output: `[DRY RUN] Would execute prompt:\n${prompt}`,
          duration: Date.now() - startTime,
        };
      }

      // Execute the prompt with Claude
      const response = await this.client.messages.create({
        model: step.model || 'claude-sonnet-4-20250514',
        max_tokens: step.maxTokens || 2000,
        temperature: step.temperature,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from API');
      }

      return {
        stepName: step.name,
        success: true,
        output: content.text,
        duration: Date.now() - startTime,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    } catch (error) {
      return {
        stepName: step.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a step in a loop
   */
  private async executeLoop(step: Step, _pipeline: Pipeline): Promise<StepResult[]> {
    const results: StepResult[] = [];
    const loopConfig = step.loop!;

    // Get the array to iterate over
    const arrayValue = this.context[loopConfig.over];
    if (!arrayValue) {
      return [{
        stepName: step.name,
        success: false,
        error: `Loop variable not found: ${loopConfig.over}`,
        duration: 0,
      }];
    }

    // Try to parse as JSON array
    let items: string[];
    try {
      const parsed = JSON.parse(arrayValue);
      if (!Array.isArray(parsed)) {
        items = [arrayValue];
      } else {
        items = parsed.map(item => typeof item === 'string' ? item : JSON.stringify(item));
      }
    } catch {
      // Treat as newline-separated list
      items = arrayValue.split('\n').filter(line => line.trim());
    }

    // Limit iterations
    const maxIterations = loopConfig.maxIterations || 100;
    const iterationCount = Math.min(items.length, maxIterations);

    const loopOutputs: string[] = [];

    for (let i = 0; i < iterationCount; i++) {
      // Set loop variable
      this.context[loopConfig.as] = items[i];
      this.context['_index'] = String(i);
      this.context['_total'] = String(items.length);

      this.options.onStepStart?.(step);
      const result = await this.executeStep({
        ...step,
        name: `${step.name}[${i}]`,
      });

      results.push(result);
      this.options.onStepComplete?.(result);

      if (result.success && result.output) {
        loopOutputs.push(result.output);
      }

      if (!result.success && !step.continueOnError) {
        break;
      }
    }

    // Store combined loop output
    this.stepOutputs[step.output] = JSON.stringify(loopOutputs);
    this.context = buildContext(this.context, this.stepOutputs);

    return results;
  }

  /**
   * Retry a failed step
   */
  private async retryStep(step: Step, maxRetries: number): Promise<StepResult> {
    let lastResult: StepResult | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.options.verbose) {
        console.log(`Retrying step "${step.name}" (attempt ${attempt}/${maxRetries})`);
      }

      const result = await this.executeStep(step);
      lastResult = result;

      if (result.success) {
        return result;
      }

      // Wait before retry with exponential backoff
      await this.delay(1000 * Math.pow(2, attempt - 1));
    }

    return lastResult || {
      stepName: step.name,
      success: false,
      error: 'Max retries exceeded',
      duration: 0,
    };
  }

  /**
   * Render a prompt template with current context
   */
  private renderPrompt(template: string): string {
    // Disable HTML escaping
    Mustache.escape = (text: string) => text;
    return Mustache.render(template, this.context);
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(expression: string): boolean {
    try {
      // Create a safe evaluation context
      const contextKeys = Object.keys(this.context);
      const contextValues = Object.values(this.context);

      // Build a function that evaluates the expression with context variables
      const func = new Function(...contextKeys, `return (${expression})`);
      return Boolean(func(...contextValues));
    } catch (error) {
      console.warn(`Failed to evaluate condition: ${expression}`, error);
      return false;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current context (for debugging)
   */
  getContext(): Record<string, string> {
    return { ...this.context };
  }

  /**
   * Get step outputs (for debugging)
   */
  getOutputs(): Record<string, string> {
    return { ...this.stepOutputs };
  }
}

/**
 * Create and execute a pipeline in one call
 */
export async function executePipeline(
  pipeline: Pipeline,
  variables: Record<string, string> = {},
  options: ExecutorOptions = {}
): Promise<PipelineResult> {
  const executor = new PipelineExecutor(options);
  return executor.execute(pipeline, variables);
}
