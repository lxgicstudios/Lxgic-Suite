import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import {
  Assertion,
  AssertionSchema,
  AssertionResult,
  validateAssertions,
  allAssertionsPassed,
} from './assertions.js';

/**
 * Schema for a single test case
 */
export const TestCaseSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  prompt: z.string(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  systemPrompt: z.string().optional(),
  variables: z.record(z.string()).optional(),
  assertions: z.array(AssertionSchema),
  skip: z.boolean().optional(),
  timeout: z.number().optional(),
});

export type TestCase = z.infer<typeof TestCaseSchema>;

/**
 * Schema for a test file
 */
export const TestFileSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  defaults: z.object({
    model: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    systemPrompt: z.string().optional(),
    timeout: z.number().optional(),
  }).optional(),
  tests: z.array(TestCaseSchema),
});

export type TestFile = z.infer<typeof TestFileSchema>;

/**
 * Result of a single test case
 */
export interface TestCaseResult {
  testCase: TestCase;
  passed: boolean;
  skipped: boolean;
  output?: string;
  assertionResults: AssertionResult[];
  error?: string;
  duration: number;
}

/**
 * Result of running a test file
 */
export interface TestFileResult {
  filePath: string;
  testFile: TestFile;
  results: TestCaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  duration: number;
}

/**
 * Configuration for the test runner
 */
export interface TestRunnerConfig {
  /** Anthropic API key */
  apiKey?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Default max tokens */
  defaultMaxTokens?: number;
  /** Default temperature */
  defaultTemperature?: number;
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Run tests in parallel */
  parallel?: boolean;
  /** Maximum parallel tests */
  maxParallel?: number;
  /** Verbose output */
  verbose?: boolean;
  /** Dry run (don't call API) */
  dryRun?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TestRunnerConfig> = {
  apiKey: '',
  defaultModel: 'claude-sonnet-4-20250514',
  defaultMaxTokens: 1024,
  defaultTemperature: 0,
  defaultTimeout: 60000,
  parallel: false,
  maxParallel: 5,
  verbose: false,
  dryRun: false,
};

/**
 * Core test runner class
 */
export class PromptTestRunner {
  private config: Required<TestRunnerConfig>;
  private client: Anthropic | null = null;

  constructor(config: TestRunnerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Get API key from config or environment
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;

    if (apiKey && !this.config.dryRun) {
      this.client = new Anthropic({ apiKey });
    }
  }

  /**
   * Parse a test file from YAML content
   */
  parseTestFile(content: string, filePath: string): TestFile {
    try {
      const parsed = parseYaml(content);
      return TestFileSchema.parse(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Invalid test file format in ${filePath}:\n${issues}`);
      }
      throw new Error(`Failed to parse YAML in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load and parse a test file
   */
  async loadTestFile(filePath: string): Promise<TestFile> {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return this.parseTestFile(content, filePath);
  }

  /**
   * Run a single test case
   */
  async runTestCase(testCase: TestCase, defaults?: TestFile['defaults']): Promise<TestCaseResult> {
    const startTime = Date.now();

    // Check if skipped
    if (testCase.skip) {
      return {
        testCase,
        passed: true,
        skipped: true,
        assertionResults: [],
        duration: 0,
      };
    }

    // Apply defaults
    const model = testCase.model || defaults?.model || this.config.defaultModel;
    const maxTokens = testCase.maxTokens || defaults?.maxTokens || this.config.defaultMaxTokens;
    const temperature = testCase.temperature ?? defaults?.temperature ?? this.config.defaultTemperature;
    const systemPrompt = testCase.systemPrompt || defaults?.systemPrompt;

    // Apply variable substitution
    let prompt = testCase.prompt;
    if (testCase.variables) {
      for (const [key, value] of Object.entries(testCase.variables)) {
        prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    try {
      let output: string;

      if (this.config.dryRun) {
        // In dry run mode, return a placeholder
        output = `[DRY RUN] Would call ${model} with prompt: ${prompt.substring(0, 100)}...`;
      } else {
        if (!this.client) {
          throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY environment variable.');
        }

        // Call the API
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: prompt },
        ];

        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
        });

        // Extract text from response
        output = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      }

      // Run assertions
      const assertionResults = validateAssertions(output, testCase.assertions);
      const passed = allAssertionsPassed(assertionResults);

      return {
        testCase,
        passed,
        skipped: false,
        output,
        assertionResults,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        testCase,
        passed: false,
        skipped: false,
        assertionResults: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run all tests in a test file
   */
  async runTestFile(filePath: string): Promise<TestFileResult> {
    const startTime = Date.now();
    const testFile = await this.loadTestFile(filePath);
    const results: TestCaseResult[] = [];

    if (this.config.parallel) {
      // Run tests in parallel with concurrency limit
      const chunks: TestCase[][] = [];
      for (let i = 0; i < testFile.tests.length; i += this.config.maxParallel) {
        chunks.push(testFile.tests.slice(i, i + this.config.maxParallel));
      }

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(tc => this.runTestCase(tc, testFile.defaults))
        );
        results.push(...chunkResults);
      }
    } else {
      // Run tests sequentially
      for (const testCase of testFile.tests) {
        const result = await this.runTestCase(testCase, testFile.defaults);
        results.push(result);
      }
    }

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed && !r.skipped).length,
      failed: results.filter(r => !r.passed && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
    };

    return {
      filePath,
      testFile,
      results,
      summary,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Run multiple test files
   */
  async runTestFiles(filePaths: string[]): Promise<TestFileResult[]> {
    const results: TestFileResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.runTestFile(filePath);
      results.push(result);
    }

    return results;
  }
}

/**
 * Format a test result as a human-readable string
 */
export function formatTestResult(result: TestCaseResult, verbose = false): string {
  const lines: string[] = [];
  const icon = result.skipped ? '○' : result.passed ? '✓' : '✗';
  const status = result.skipped ? 'SKIP' : result.passed ? 'PASS' : 'FAIL';

  lines.push(`  ${icon} ${result.testCase.name} [${status}] (${result.duration}ms)`);

  if (result.error) {
    lines.push(`    Error: ${result.error}`);
  }

  if (!result.passed && !result.skipped) {
    for (const ar of result.assertionResults) {
      if (!ar.passed) {
        lines.push(`    ✗ [${ar.assertion.type}] ${ar.message}`);
        if (verbose && ar.actual !== undefined) {
          lines.push(`      Actual: ${ar.actual}`);
          lines.push(`      Expected: ${ar.expected}`);
        }
      }
    }
  } else if (verbose && result.passed) {
    for (const ar of result.assertionResults) {
      lines.push(`    ✓ [${ar.assertion.type}] ${ar.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a test file result as a human-readable string
 */
export function formatTestFileResult(result: TestFileResult, verbose = false): string {
  const lines: string[] = [];

  lines.push(`\n${result.testFile.name || result.filePath}`);
  if (result.testFile.description) {
    lines.push(`  ${result.testFile.description}`);
  }
  lines.push('─'.repeat(50));

  for (const testResult of result.results) {
    lines.push(formatTestResult(testResult, verbose));
  }

  lines.push('─'.repeat(50));
  lines.push(`Tests: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`);
  lines.push(`Duration: ${result.duration}ms`);

  return lines.join('\n');
}

/**
 * Format results as JSON
 */
export function formatResultsJson(results: TestFileResult[]): string {
  const summary = {
    totalFiles: results.length,
    totalTests: results.reduce((sum, r) => sum + r.summary.total, 0),
    passed: results.reduce((sum, r) => sum + r.summary.passed, 0),
    failed: results.reduce((sum, r) => sum + r.summary.failed, 0),
    skipped: results.reduce((sum, r) => sum + r.summary.skipped, 0),
    duration: results.reduce((sum, r) => sum + r.duration, 0),
  };

  return JSON.stringify({ summary, results }, null, 2);
}

/**
 * Combine multiple test file results into an overall summary
 */
export function combineResults(results: TestFileResult[]): {
  results: TestFileResult[];
  summary: {
    totalFiles: number;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  allPassed: boolean;
} {
  const summary = {
    totalFiles: results.length,
    totalTests: results.reduce((sum, r) => sum + r.summary.total, 0),
    passed: results.reduce((sum, r) => sum + r.summary.passed, 0),
    failed: results.reduce((sum, r) => sum + r.summary.failed, 0),
    skipped: results.reduce((sum, r) => sum + r.summary.skipped, 0),
    duration: results.reduce((sum, r) => sum + r.duration, 0),
  };

  return {
    results,
    summary,
    allPassed: summary.failed === 0,
  };
}

/**
 * Create a sample test file template
 */
export function createSampleTestFile(): string {
  return `# Sample Prompt Test File
name: My Prompt Tests
description: Test suite for my prompts

defaults:
  model: claude-sonnet-4-20250514
  maxTokens: 1024
  temperature: 0

tests:
  - name: Basic greeting test
    description: Test that the model responds to greetings politely
    prompt: "Say hello in a friendly way"
    assertions:
      - type: contains
        expected: "hello"
        ignoreCase: true
      - type: length-min
        expected: 5
      - type: length-max
        expected: 500

  - name: JSON output test
    description: Test that the model can produce valid JSON
    prompt: "Return a JSON object with fields 'name' (string) and 'age' (number)"
    assertions:
      - type: is-json
      - type: json-schema
        expected:
          type: object
          properties:
            name:
              type: string
            age:
              type: number
          required:
            - name
            - age

  - name: Variable substitution test
    description: Test with variable substitution
    prompt: "Write a haiku about {{topic}}"
    variables:
      topic: "autumn leaves"
    assertions:
      - type: word-count-min
        expected: 10
      - type: word-count-max
        expected: 50
`;
}
