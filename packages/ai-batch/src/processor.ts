import {
  BatchJob,
  BatchConfig,
  RowData,
  ProcessResult,
  JobState,
  resolveTemplate,
  saveJobState,
  createBatchJob
} from './core';
import { readFile, writeOutput, readTemplate } from './formats';

export type ProcessorCallback = (prompt: string, row: RowData) => Promise<string>;

export interface ProcessorEvents {
  onStart?: (job: BatchJob) => void;
  onProgress?: (job: BatchJob, result: ProcessResult) => void;
  onComplete?: (job: BatchJob, results: ProcessResult[]) => void;
  onError?: (job: BatchJob, error: Error) => void;
  onRowError?: (job: BatchJob, row: RowData, error: Error) => void;
}

async function simulateAICall(prompt: string): Promise<string> {
  // Simulate AI processing
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  // Simulate occasional failures
  if (Math.random() < 0.05) {
    throw new Error('Simulated AI processing error');
  }

  return `[AI Response] Processed: "${prompt.substring(0, 30)}..."`;
}

export async function processRow(
  row: RowData,
  template: string,
  config: BatchConfig,
  processor?: ProcessorCallback
): Promise<ProcessResult> {
  const startTime = Date.now();
  const prompt = resolveTemplate(template, row.data);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      const output = processor
        ? await processor(prompt, row)
        : await simulateAICall(prompt);

      return {
        index: row.index,
        input: row.data,
        output,
        success: true,
        duration: Date.now() - startTime
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.retries) {
        await new Promise(resolve => setTimeout(resolve, config.retryDelay * (attempt + 1)));
      }
    }
  }

  return {
    index: row.index,
    input: row.data,
    output: '',
    success: false,
    error: lastError?.message || 'Unknown error',
    duration: Date.now() - startTime
  };
}

export async function processBatch(
  inputFile: string,
  outputFile: string,
  promptTemplate: string,
  config: BatchConfig,
  events?: ProcessorEvents,
  processor?: ProcessorCallback,
  resumeState?: JobState
): Promise<{ job: BatchJob; results: ProcessResult[] }> {
  // Read input file
  const { headers, rows, format } = await readFile(inputFile);

  // Read template if it's a file path
  let template: string;
  try {
    if (promptTemplate.includes('.txt') || promptTemplate.includes('.md')) {
      template = readTemplate(promptTemplate);
    } else {
      template = promptTemplate;
    }
  } catch {
    template = promptTemplate;
  }

  // Create or resume job
  let job: BatchJob;
  let processedIndices: Set<number>;
  let results: ProcessResult[];

  if (resumeState) {
    job = resumeState.job;
    job.status = 'running';
    processedIndices = resumeState.processedIndices;
    results = resumeState.results;
  } else {
    job = createBatchJob(inputFile, outputFile, template, format, rows.length);
    processedIndices = new Set();
    results = [];
  }

  events?.onStart?.(job);

  // Filter rows that need processing
  const pendingRows = rows.filter(row => !processedIndices.has(row.index));

  // Process in batches based on concurrency
  const concurrency = config.concurrency;

  for (let i = 0; i < pendingRows.length; i += concurrency) {
    const batch = pendingRows.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(row => processRow(row, template, config, processor))
    );

    for (const result of batchResults) {
      results.push(result);
      processedIndices.add(result.index);

      if (result.success) {
        job.processedRows++;
      } else {
        job.failedRows++;
        job.errors.push({ row: result.index, error: result.error || 'Unknown error' });
        events?.onRowError?.(job, rows[result.index], new Error(result.error));
      }

      events?.onProgress?.(job, result);
    }

    // Save state periodically
    const state: JobState = { job, processedIndices, results };
    saveJobState(state);
  }

  // Sort results by index
  results.sort((a, b) => a.index - b.index);

  // Write output
  const outputFormat = outputFile.endsWith('.json') ? 'json' : format;
  await writeOutput(outputFile, headers, results, outputFormat, config.outputColumn);

  // Update job status
  job.status = job.failedRows > 0 ? 'failed' : 'completed';

  events?.onComplete?.(job, results);

  return { job, results };
}

export function previewBatch(
  rows: RowData[],
  template: string,
  limit: number = 5
): Array<{ index: number; input: Record<string, any>; prompt: string }> {
  const previews: Array<{ index: number; input: Record<string, any>; prompt: string }> = [];

  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    const row = rows[i];
    previews.push({
      index: row.index,
      input: row.data,
      prompt: resolveTemplate(template, row.data)
    });
  }

  return previews;
}

export function getDefaultConfig(): BatchConfig {
  return {
    concurrency: 5,
    retries: 3,
    retryDelay: 1000,
    timeout: 30000,
    outputColumn: 'ai_output'
  };
}
