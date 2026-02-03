import * as fs from 'fs';
import * as path from 'path';
import Conf from 'conf';
import { LoadTester, LoadTestResults, TestConfigSchema, PromptConfig } from './loadtester.js';
import { generateReport, analyzeResults, ReportOptions } from './reporter.js';

export interface RunOptions {
  rps: number;
  duration: number;
  output?: string;
  json?: boolean;
  verbose?: boolean;
  onProgress?: (progress: any) => void;
}

export interface AnalyzeOptions {
  json?: boolean;
}

const config = new Conf({
  projectName: 'prompt-stress',
  defaults: {
    defaultRps: 1,
    defaultDuration: 10,
    resultsDir: './stress-results',
    model: 'claude-sonnet-4-20250514',
  },
});

export async function runLoadTest(
  filePath: string,
  options: RunOptions
): Promise<LoadTestResults> {
  // Validate file exists
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Prompt file not found: ${resolvedPath}`);
  }

  // Load and parse config
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  let prompts: PromptConfig[];

  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext === '.json') {
    const parsed = JSON.parse(content);

    // Check if it's a full config or just an array of prompts
    if (Array.isArray(parsed)) {
      prompts = parsed.map(p => {
        if (typeof p === 'string') {
          return { prompt: p };
        }
        return p;
      });
    } else {
      const validated = TestConfigSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(`Invalid config format: ${validated.error.message}`);
      }
      prompts = validated.data.prompts;
    }
  } else if (ext === '.txt') {
    // Plain text - each line is a prompt
    prompts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(prompt => ({ prompt }));
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .json or .txt`);
  }

  if (prompts.length === 0) {
    throw new Error('No prompts found in file');
  }

  // Run load test
  const tester = new LoadTester();

  const results = await tester.runTest({
    rps: options.rps,
    duration: options.duration,
    prompts,
    onProgress: options.onProgress,
  });

  // Save results if output specified
  if (options.output) {
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  }

  return results;
}

export function generateLoadReport(
  results: LoadTestResults,
  options: ReportOptions = {}
): string {
  return generateReport(results, options);
}

export function analyzeLoadResults(
  resultsPath: string,
  options: AnalyzeOptions = {}
): {
  results: LoadTestResults;
  analysis: {
    analysis: string[];
    recommendations: string[];
    score: number;
  };
} {
  const resolvedPath = path.resolve(resultsPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Results file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const results: LoadTestResults = JSON.parse(content);

  const analysis = analyzeResults(results);

  return { results, analysis };
}

export function loadResults(resultsPath: string): LoadTestResults {
  const resolvedPath = path.resolve(resultsPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Results file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(content);
}

export function saveResults(results: LoadTestResults, outputPath: string): void {
  const resolvedPath = path.resolve(outputPath);
  const outputDir = path.dirname(resolvedPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, JSON.stringify(results, null, 2), 'utf-8');
}

export function createSampleConfig(outputPath: string): void {
  const sampleConfig = {
    prompts: [
      {
        prompt: "What is the capital of France?",
        maxTokens: 100,
      },
      {
        prompt: "Explain quantum computing in simple terms.",
        maxTokens: 500,
      },
      {
        prompt: "Write a haiku about programming.",
        maxTokens: 100,
      }
    ],
    defaults: {
      model: "claude-sonnet-4-20250514",
      maxTokens: 256,
      temperature: 0.7,
    }
  };

  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
}

export { config };
