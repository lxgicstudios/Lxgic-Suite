#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DebugCore, PromptSegment } from './core.js';
import { DebugSession } from './debugger.js';
import { BreakpointManager } from './breakpoints.js';

const program = new Command();

interface GlobalOptions {
  json?: boolean;
}

interface StepOptions extends GlobalOptions {
  model?: string;
}

interface RunOptions extends GlobalOptions {
  breakpoints?: string;
  model?: string;
}

function outputResult(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(data);
  }
}

function handleError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    console.log(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(1);
}

async function loadPromptFile(filePath: string): Promise<string> {
  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Prompt file not found: ${resolvedPath}`);
  }

  return await readFile(resolvedPath, 'utf-8');
}

program
  .name('prompt-debug')
  .description('Step-through debugger for prompt execution')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

program
  .command('step <file>')
  .description('Step through prompt execution interactively')
  .option('-m, --model <model>', 'Model to use for execution', 'claude-3-5-sonnet-20241022')
  .action(async (file: string, options: StepOptions) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || options.json || false;

    try {
      const content = await loadPromptFile(file);
      const core = new DebugCore();
      const segments = core.parsePrompt(content);

      if (json) {
        // In JSON mode, output parsed segments
        const result = {
          file,
          segments: segments.map(seg => ({
            type: seg.type,
            content: seg.content,
            tokenCount: seg.tokenCount,
            lineStart: seg.lineStart,
            lineEnd: seg.lineEnd
          })),
          totalTokens: segments.reduce((sum, seg) => sum + seg.tokenCount, 0)
        };
        outputResult(result, true);
        return;
      }

      const session = new DebugSession(core, options.model || 'claude-3-5-sonnet-20241022');
      await session.startInteractive(segments, file);

    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('run <file>')
  .description('Run prompt with optional breakpoints')
  .option('-b, --breakpoints <points>', 'Comma-separated list of segment indices or types to break at')
  .option('-m, --model <model>', 'Model to use for execution', 'claude-3-5-sonnet-20241022')
  .action(async (file: string, options: RunOptions) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || options.json || false;

    try {
      const content = await loadPromptFile(file);
      const core = new DebugCore();
      const segments = core.parsePrompt(content);

      const breakpointManager = new BreakpointManager();

      if (options.breakpoints) {
        const points = options.breakpoints.split(',').map(p => p.trim());
        for (const point of points) {
          if (/^\d+$/.test(point)) {
            breakpointManager.addIndexBreakpoint(parseInt(point, 10));
          } else {
            breakpointManager.addTypeBreakpoint(point as PromptSegment['type']);
          }
        }
      }

      if (json) {
        const spinner = ora({ isSilent: true });
        const results = await core.executeWithBreakpoints(
          segments,
          breakpointManager,
          options.model || 'claude-3-5-sonnet-20241022',
          spinner,
          true // auto-continue
        );
        outputResult(results, true);
        return;
      }

      const spinner = ora('Executing prompt...').start();

      const session = new DebugSession(core, options.model || 'claude-3-5-sonnet-20241022');
      await session.runWithBreakpoints(segments, breakpointManager, file);

      spinner.succeed('Execution complete');

    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('parse <file>')
  .description('Parse and display prompt segments without execution')
  .action(async (file: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const content = await loadPromptFile(file);
      const core = new DebugCore();
      const segments = core.parsePrompt(content);

      if (json) {
        outputResult({
          file,
          segments: segments.map(seg => ({
            type: seg.type,
            content: seg.content,
            tokenCount: seg.tokenCount,
            lineStart: seg.lineStart,
            lineEnd: seg.lineEnd
          })),
          totalTokens: segments.reduce((sum, seg) => sum + seg.tokenCount, 0)
        }, true);
        return;
      }

      console.log(chalk.bold(`\nPrompt Segments for: ${file}\n`));
      console.log(chalk.gray('─'.repeat(60)));

      let totalTokens = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        totalTokens += seg.tokenCount;

        const typeColor = {
          system: chalk.blue,
          user: chalk.green,
          assistant: chalk.yellow,
          example: chalk.magenta,
          context: chalk.cyan
        }[seg.type] || chalk.white;

        console.log(`\n${chalk.bold(`[${i}]`)} ${typeColor(seg.type.toUpperCase())}`);
        console.log(chalk.gray(`Lines ${seg.lineStart}-${seg.lineEnd} | ~${seg.tokenCount} tokens`));
        console.log(chalk.gray('─'.repeat(40)));

        const preview = seg.content.length > 200
          ? seg.content.substring(0, 200) + '...'
          : seg.content;
        console.log(preview);
      }

      console.log(chalk.gray('\n' + '─'.repeat(60)));
      console.log(chalk.bold(`Total: ${segments.length} segments, ~${totalTokens} tokens\n`));

    } catch (error) {
      handleError(error, json);
    }
  });

program.parse();
