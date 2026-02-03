/**
 * Retry execution engine
 */

import { spawn, ChildProcess } from 'child_process';
import { RetryConfig, RetryResult, AttemptRecord, shouldRetry, formatDuration } from './core';
import { calculateDelay } from './strategies';

export class RetryExecutor {
  private config: RetryConfig;
  private verbose: boolean;
  private currentProcess: ChildProcess | null = null;

  constructor(config: RetryConfig, verbose: boolean = false) {
    this.config = config;
    this.verbose = verbose;
  }

  /**
   * Execute a command with retry logic
   */
  async execute(command: string, args: string[] = []): Promise<RetryResult> {
    const attemptHistory: AttemptRecord[] = [];
    const startTime = Date.now();
    let lastExitCode = -1;
    let lastOutput = '';
    let lastError = '';
    let previousDelay = 0;

    // Set up interrupt handling
    const interruptHandler = () => {
      if (this.currentProcess) {
        this.currentProcess.kill('SIGTERM');
      }
      process.exit(130);
    };

    process.on('SIGINT', interruptHandler);
    process.on('SIGTERM', interruptHandler);

    try {
      for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
        // Calculate delay before this attempt (skip for first attempt)
        let delayMs = 0;
        if (attempt > 1) {
          delayMs = calculateDelay(attempt - 1, this.config, previousDelay);
          previousDelay = delayMs;

          if (this.verbose) {
            console.error(`[Retry] Waiting ${formatDuration(delayMs)} before attempt ${attempt}...`);
          }

          await this.sleep(delayMs);
        }

        if (this.verbose) {
          console.error(`[Retry] Attempt ${attempt}/${this.config.maxAttempts}: ${command} ${args.join(' ')}`);
        }

        const attemptStart = Date.now();
        const result = await this.runCommand(command, args);
        const attemptDuration = Date.now() - attemptStart;

        const record: AttemptRecord = {
          attempt,
          exitCode: result.exitCode,
          durationMs: attemptDuration,
          delayBeforeMs: delayMs,
          output: result.stdout,
          error: result.stderr
        };

        attemptHistory.push(record);
        lastExitCode = result.exitCode;
        lastOutput = result.stdout;
        lastError = result.stderr;

        // Success - exit early
        if (result.exitCode === 0) {
          if (this.verbose && attempt > 1) {
            console.error(`[Retry] Success on attempt ${attempt}`);
          }
          break;
        }

        // Check if we should retry
        if (!shouldRetry(result.exitCode, this.config)) {
          if (this.verbose) {
            console.error(`[Retry] Exit code ${result.exitCode} not in retry list, stopping`);
          }
          break;
        }

        // Check if we've exhausted attempts
        if (attempt === this.config.maxAttempts) {
          if (this.verbose) {
            console.error(`[Retry] All ${this.config.maxAttempts} attempts exhausted`);
          }
        }
      }

      return {
        success: lastExitCode === 0,
        attempts: attemptHistory.length,
        totalDurationMs: Date.now() - startTime,
        lastExitCode,
        lastOutput,
        lastError,
        attemptHistory
      };
    } finally {
      process.removeListener('SIGINT', interruptHandler);
      process.removeListener('SIGTERM', interruptHandler);
    }
  }

  /**
   * Run a single command execution
   */
  private runCommand(command: string, args: string[]): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Determine if we should use shell
      const useShell = process.platform === 'win32';

      this.currentProcess = spawn(command, args, {
        shell: useShell,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        if (this.currentProcess) {
          this.currentProcess.kill('SIGTERM');
        }
      }, this.config.timeoutMs);

      this.currentProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      this.currentProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      this.currentProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        this.currentProcess = null;

        if (timedOut) {
          resolve({
            exitCode: 124, // Standard timeout exit code
            stdout,
            stderr: stderr + '\n[Timeout: Command exceeded time limit]'
          });
        } else {
          resolve({
            exitCode: code ?? 1,
            stdout,
            stderr
          });
        }
      });

      this.currentProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        this.currentProcess = null;
        resolve({
          exitCode: 127, // Command not found
          stdout,
          stderr: err.message
        });
      });
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Wrap a script file with retry logic
 */
export async function wrapScript(
  scriptPath: string,
  config: RetryConfig,
  verbose: boolean
): Promise<RetryResult> {
  const executor = new RetryExecutor(config, verbose);

  // Determine interpreter based on file extension
  const ext = scriptPath.split('.').pop()?.toLowerCase();
  let command: string;
  let args: string[];

  switch (ext) {
    case 'js':
      command = 'node';
      args = [scriptPath];
      break;
    case 'ts':
      command = 'npx';
      args = ['ts-node', scriptPath];
      break;
    case 'py':
      command = 'python';
      args = [scriptPath];
      break;
    case 'sh':
      command = 'bash';
      args = [scriptPath];
      break;
    case 'ps1':
      command = 'powershell';
      args = ['-File', scriptPath];
      break;
    default:
      // Try to run directly
      command = scriptPath;
      args = [];
  }

  return executor.execute(command, args);
}
