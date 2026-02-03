import Conf from 'conf';
import cron from 'node-cron';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

export interface CronJob {
  id: string;
  schedule: string;
  promptFile: string;
  name?: string;
  outputFile?: string;
  webhookUrl?: string;
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
}

export interface JobLog {
  jobId: string;
  timestamp: string;
  success: boolean;
  message: string;
  output?: string;
}

interface CronConfig {
  jobs: CronJob[];
  logs: JobLog[];
  schedulerPid?: number;
}

const config = new Conf<CronConfig>({
  projectName: 'prompt-cron',
  defaults: {
    jobs: [],
    logs: [],
  },
});

const runningTasks: Map<string, cron.ScheduledTask> = new Map();

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function getNextRun(schedule: string): string {
  // Simple approximation - in production use cron-parser
  return new Date(Date.now() + 60000).toISOString();
}

export async function addJob(options: {
  schedule: string;
  promptFile: string;
  name?: string;
  outputFile?: string;
  webhookUrl?: string;
}): Promise<CronJob> {
  // Validate cron expression
  if (!cron.validate(options.schedule)) {
    throw new Error(`Invalid cron expression: ${options.schedule}`);
  }

  const job: CronJob = {
    id: generateId(),
    schedule: options.schedule,
    promptFile: options.promptFile,
    name: options.name,
    outputFile: options.outputFile,
    webhookUrl: options.webhookUrl,
    enabled: true,
    createdAt: new Date().toISOString(),
    nextRun: getNextRun(options.schedule),
  };

  const jobs = config.get('jobs');
  jobs.push(job);
  config.set('jobs', jobs);

  return job;
}

export async function removeJob(jobId: string): Promise<void> {
  const jobs = config.get('jobs');
  const index = jobs.findIndex(j => j.id === jobId);

  if (index === -1) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Stop if running
  const task = runningTasks.get(jobId);
  if (task) {
    task.stop();
    runningTasks.delete(jobId);
  }

  jobs.splice(index, 1);
  config.set('jobs', jobs);
}

export async function listJobs(activeOnly: boolean = false): Promise<CronJob[]> {
  let jobs = config.get('jobs');

  if (activeOnly) {
    jobs = jobs.filter(j => j.enabled);
  }

  return jobs;
}

export async function runJob(jobId?: string): Promise<{ output: string; success: boolean }> {
  const jobs = config.get('jobs');

  let jobsToRun: CronJob[];
  if (jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    jobsToRun = [job];
  } else {
    jobsToRun = jobs.filter(j => j.enabled);
  }

  if (jobsToRun.length === 0) {
    throw new Error('No jobs to run');
  }

  const results: string[] = [];

  for (const job of jobsToRun) {
    try {
      const promptContent = fs.readFileSync(job.promptFile, 'utf-8');

      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: promptContent }],
      });

      const output = response.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      results.push(output);

      // Save output if configured
      if (job.outputFile) {
        fs.writeFileSync(job.outputFile, output);
      }

      // Log success
      addLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        success: true,
        message: 'Job completed successfully',
        output: output.substring(0, 500),
      });

      // Update job
      const allJobs = config.get('jobs');
      const idx = allJobs.findIndex(j => j.id === job.id);
      if (idx !== -1) {
        allJobs[idx].lastRun = new Date().toISOString();
        allJobs[idx].nextRun = getNextRun(job.schedule);
        config.set('jobs', allJobs);
      }

      // Webhook notification
      if (job.webhookUrl) {
        try {
          await fetch(job.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id, success: true, output }),
          });
        } catch {
          // Ignore webhook errors
        }
      }
    } catch (error) {
      addLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return { output: results.join('\n---\n'), success: true };
}

function addLog(log: JobLog): void {
  const logs = config.get('logs');
  logs.unshift(log);
  // Keep last 1000 logs
  if (logs.length > 1000) {
    logs.length = 1000;
  }
  config.set('logs', logs);
}

export async function startScheduler(foreground: boolean = false): Promise<void> {
  const jobs = await listJobs(true);

  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      console.warn(`Invalid schedule for job ${job.id}: ${job.schedule}`);
      continue;
    }

    const task = cron.schedule(job.schedule, async () => {
      try {
        await runJob(job.id);
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
      }
    });

    runningTasks.set(job.id, task);
  }

  config.set('schedulerPid', process.pid);

  if (foreground) {
    // Keep running
    await new Promise(() => {});
  }
}

export async function stopScheduler(): Promise<void> {
  for (const [jobId, task] of runningTasks) {
    task.stop();
  }
  runningTasks.clear();
  config.delete('schedulerPid');
}

export async function getJobLogs(jobId?: string, limit: number = 50): Promise<JobLog[]> {
  let logs = config.get('logs');

  if (jobId) {
    logs = logs.filter(l => l.jobId === jobId);
  }

  return logs.slice(0, limit);
}
