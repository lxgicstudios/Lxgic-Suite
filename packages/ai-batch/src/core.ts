import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface BatchJob {
  id: string;
  inputFile: string;
  outputFile: string;
  promptTemplate: string;
  format: 'csv' | 'json';
  totalRows: number;
  processedRows: number;
  failedRows: number;
  startedAt: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  errors: Array<{ row: number; error: string }>;
}

export interface RowData {
  index: number;
  data: Record<string, any>;
  raw: any[];
}

export interface ProcessResult {
  index: number;
  input: Record<string, any>;
  output: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface BatchConfig {
  concurrency: number;
  retries: number;
  retryDelay: number;
  timeout: number;
  outputColumn?: string;
}

export interface JobState {
  job: BatchJob;
  processedIndices: Set<number>;
  results: ProcessResult[];
}

const STATE_DIR = '.ai-batch';

export function getStateDir(): string {
  const dir = path.join(process.cwd(), STATE_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveJobState(state: JobState): void {
  const stateDir = getStateDir();
  const statePath = path.join(stateDir, `${state.job.id}.json`);

  const serializable = {
    job: state.job,
    processedIndices: Array.from(state.processedIndices),
    results: state.results
  };

  fs.writeFileSync(statePath, JSON.stringify(serializable, null, 2));
}

export function loadJobState(jobId: string): JobState | null {
  const stateDir = getStateDir();
  const statePath = path.join(stateDir, `${jobId}.json`);

  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    return {
      job: data.job,
      processedIndices: new Set(data.processedIndices),
      results: data.results
    };
  } catch {
    return null;
  }
}

export function findLatestJob(): JobState | null {
  const stateDir = getStateDir();

  if (!fs.existsSync(stateDir)) {
    return null;
  }

  const files = fs.readdirSync(stateDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(stateDir, f),
      mtime: fs.statSync(path.join(stateDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    return null;
  }

  const jobId = files[0].name.replace('.json', '');
  return loadJobState(jobId);
}

export function deleteJobState(jobId: string): void {
  const stateDir = getStateDir();
  const statePath = path.join(stateDir, `${jobId}.json`);

  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

export function createBatchJob(
  inputFile: string,
  outputFile: string,
  promptTemplate: string,
  format: 'csv' | 'json',
  totalRows: number
): BatchJob {
  return {
    id: uuidv4(),
    inputFile: path.resolve(inputFile),
    outputFile: path.resolve(outputFile),
    promptTemplate,
    format,
    totalRows,
    processedRows: 0,
    failedRows: 0,
    startedAt: new Date().toISOString(),
    status: 'running',
    errors: []
  };
}

export function resolveTemplate(template: string, row: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in row) {
      return String(row[key]);
    }
    return match;
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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatProgress(current: number, total: number): string {
  const percent = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percent}% (${current}/${total})`;
}
