import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { DebugCore, PromptSegment, ExecutionStep } from './core.js';
import { BreakpointManager } from './breakpoints.js';

export interface DebugSessionState {
  currentIndex: number;
  segments: PromptSegment[];
  executionHistory: ExecutionStep[];
  isRunning: boolean;
  model: string;
}

export class DebugSession {
  private core: DebugCore;
  private state: DebugSessionState;

  constructor(core: DebugCore, model: string) {
    this.core = core;
    this.state = {
      currentIndex: 0,
      segments: [],
      executionHistory: [],
      isRunning: false,
      model
    };
  }

  /**
   * Start interactive debugging session
   */
  async startInteractive(segments: PromptSegment[], fileName: string): Promise<void> {
    this.state.segments = segments;
    this.state.currentIndex = 0;

    console.log(chalk.bold.cyan('\n=== Prompt Debugger ==='));
    console.log(chalk.gray(`File: ${fileName}`));
    console.log(chalk.gray(`Model: ${this.state.model}`));
    console.log(chalk.gray(`Segments: ${segments.length}`));
    console.log(chalk.gray(`Total tokens: ~${segments.reduce((sum, s) => sum + s.tokenCount, 0)}`));
    console.log(chalk.gray('\nCommands: step, run, edit, view, tokens, execute, quit\n'));

    await this.debugLoop();
  }

  /**
   * Run with breakpoints
   */
  async runWithBreakpoints(
    segments: PromptSegment[],
    breakpointManager: BreakpointManager,
    fileName: string
  ): Promise<void> {
    this.state.segments = segments;
    this.state.currentIndex = 0;

    console.log(chalk.bold.cyan('\n=== Running with Breakpoints ==='));
    console.log(chalk.gray(`File: ${fileName}`));
    console.log(chalk.gray(`Breakpoints: ${breakpointManager.getBreakpointCount()}`));

    const spinner = ora('Starting execution...').start();
    let cumulativeTokens = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      cumulativeTokens += segment.tokenCount;
      this.state.currentIndex = i;

      if (breakpointManager.shouldBreak(i, segment.type)) {
        spinner.stop();
        console.log(chalk.yellow(`\n[Breakpoint] Segment ${i}: ${segment.type}`));
        this.displaySegment(i);
        console.log(chalk.gray(`Cumulative tokens: ${cumulativeTokens}`));

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'Action:',
          choices: [
            { name: 'Continue', value: 'continue' },
            { name: 'Execute here', value: 'execute' },
            { name: 'Edit segment', value: 'edit' },
            { name: 'View all segments', value: 'view' },
            { name: 'Abort', value: 'abort' }
          ]
        }]);

        if (action === 'abort') {
          console.log(chalk.red('Execution aborted.'));
          return;
        }

        if (action === 'execute') {
          await this.executeAtCurrentPosition();
        }

        if (action === 'edit') {
          await this.editSegment(i);
        }

        if (action === 'view') {
          this.displayAllSegments();
        }

        spinner.start(`Continuing from segment ${i + 1}...`);
      }
    }

    spinner.text = 'Executing final prompt...';
    await this.executeAtCurrentPosition();
    spinner.succeed('Execution complete');
  }

  /**
   * Main debug loop for interactive mode
   */
  private async debugLoop(): Promise<void> {
    while (true) {
      this.displayCurrentSegment();

      const { command } = await inquirer.prompt([{
        type: 'input',
        name: 'command',
        message: chalk.cyan(`[${this.state.currentIndex}/${this.state.segments.length - 1}] >`),
        default: 'step'
      }]);

      const [cmd, ...args] = command.trim().split(/\s+/);

      switch (cmd.toLowerCase()) {
        case 'step':
        case 's':
        case 'n':
        case 'next':
          if (this.state.currentIndex < this.state.segments.length - 1) {
            this.state.currentIndex++;
          } else {
            console.log(chalk.yellow('Already at last segment.'));
          }
          break;

        case 'back':
        case 'b':
        case 'prev':
          if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
          } else {
            console.log(chalk.yellow('Already at first segment.'));
          }
          break;

        case 'goto':
        case 'g':
          const idx = parseInt(args[0], 10);
          if (!isNaN(idx) && idx >= 0 && idx < this.state.segments.length) {
            this.state.currentIndex = idx;
          } else {
            console.log(chalk.red(`Invalid segment index. Use 0-${this.state.segments.length - 1}`));
          }
          break;

        case 'run':
        case 'r':
          await this.runToEnd();
          break;

        case 'execute':
        case 'exec':
        case 'e':
          await this.executeAtCurrentPosition();
          break;

        case 'edit':
          await this.editSegment(this.state.currentIndex);
          break;

        case 'view':
        case 'v':
          if (args[0]) {
            const viewIdx = parseInt(args[0], 10);
            if (!isNaN(viewIdx) && viewIdx >= 0 && viewIdx < this.state.segments.length) {
              this.displaySegment(viewIdx);
            }
          } else {
            this.displayAllSegments();
          }
          break;

        case 'tokens':
        case 't':
          this.displayTokenInfo();
          break;

        case 'history':
        case 'h':
          this.displayHistory();
          break;

        case 'quit':
        case 'q':
        case 'exit':
          console.log(chalk.gray('Exiting debugger.'));
          return;

        case 'help':
        case '?':
          this.displayHelp();
          break;

        default:
          console.log(chalk.red(`Unknown command: ${cmd}. Type 'help' for commands.`));
      }
    }
  }

  /**
   * Display current segment
   */
  private displayCurrentSegment(): void {
    const segment = this.state.segments[this.state.currentIndex];
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(this.core.formatSegment(segment, this.state.currentIndex));
  }

  /**
   * Display a specific segment
   */
  private displaySegment(index: number): void {
    const segment = this.state.segments[index];
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(this.core.formatSegment(segment, index));
  }

  /**
   * Display all segments
   */
  private displayAllSegments(): void {
    console.log(chalk.bold.cyan('\n=== All Segments ===\n'));
    for (let i = 0; i < this.state.segments.length; i++) {
      const marker = i === this.state.currentIndex ? chalk.green('>>> ') : '    ';
      const segment = this.state.segments[i];
      const typeColor = this.getTypeColor(segment.type);
      console.log(`${marker}${chalk.bold(`[${i}]`)} ${typeColor(segment.type)} - ${segment.tokenCount} tokens`);
      const preview = segment.content.substring(0, 50).replace(/\n/g, ' ');
      console.log(chalk.gray(`     ${preview}${segment.content.length > 50 ? '...' : ''}`));
    }
  }

  /**
   * Get color function for segment type
   */
  private getTypeColor(type: string): (s: string) => string {
    const colors: Record<string, (s: string) => string> = {
      system: chalk.blue,
      user: chalk.green,
      assistant: chalk.yellow,
      example: chalk.magenta,
      context: chalk.cyan
    };
    return colors[type] || chalk.white;
  }

  /**
   * Display token information
   */
  private displayTokenInfo(): void {
    let cumulative = 0;
    console.log(chalk.bold.cyan('\n=== Token Analysis ===\n'));

    for (let i = 0; i < this.state.segments.length; i++) {
      const segment = this.state.segments[i];
      cumulative += segment.tokenCount;
      const marker = i === this.state.currentIndex ? chalk.green('>>> ') : '    ';
      console.log(`${marker}[${i}] ${segment.type}: ${segment.tokenCount} tokens (cumulative: ${cumulative})`);
    }

    console.log(chalk.gray('\n' + '─'.repeat(40)));
    console.log(chalk.bold(`Total: ${cumulative} tokens`));
  }

  /**
   * Display execution history
   */
  private displayHistory(): void {
    if (this.state.executionHistory.length === 0) {
      console.log(chalk.yellow('\nNo execution history yet.'));
      return;
    }

    console.log(chalk.bold.cyan('\n=== Execution History ===\n'));
    for (const step of this.state.executionHistory) {
      console.log(`[${step.segmentIndex}] ${step.segment.type}`);
      if (step.response) {
        console.log(chalk.gray(`  Response (${step.responseTokens} tokens, ${step.duration}ms):`));
        const preview = step.response.substring(0, 100).replace(/\n/g, ' ');
        console.log(chalk.white(`  ${preview}${step.response.length > 100 ? '...' : ''}`));
      }
      if (step.error) {
        console.log(chalk.red(`  Error: ${step.error}`));
      }
    }
  }

  /**
   * Edit a segment interactively
   */
  private async editSegment(index: number): Promise<void> {
    const segment = this.state.segments[index];

    console.log(chalk.cyan('\nCurrent content:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(segment.content);
    console.log(chalk.gray('─'.repeat(40)));

    const { newContent } = await inquirer.prompt([{
      type: 'editor',
      name: 'newContent',
      message: 'Edit segment content:',
      default: segment.content
    }]);

    if (newContent !== segment.content) {
      this.state.segments = this.core.updateSegment(this.state.segments, index, newContent);
      console.log(chalk.green('Segment updated.'));
      console.log(chalk.gray(`New token count: ${this.state.segments[index].tokenCount}`));
    } else {
      console.log(chalk.gray('No changes made.'));
    }
  }

  /**
   * Execute prompt up to current position
   */
  private async executeAtCurrentPosition(): Promise<void> {
    const spinner = ora('Executing prompt...').start();

    try {
      const result = await this.core.executeSegment(
        this.state.segments,
        this.state.currentIndex,
        this.state.model
      );

      spinner.succeed('Execution complete');

      const step: ExecutionStep = {
        segmentIndex: this.state.currentIndex,
        segment: this.state.segments[this.state.currentIndex],
        cumulativeTokens: this.state.segments
          .slice(0, this.state.currentIndex + 1)
          .reduce((sum, s) => sum + s.tokenCount, 0),
        response: result.response,
        responseTokens: result.outputTokens,
        duration: result.duration
      };

      this.state.executionHistory.push(step);

      console.log(chalk.bold.green('\n=== Response ===\n'));
      console.log(result.response);
      console.log(chalk.gray(`\nTokens: ${result.inputTokens} in / ${result.outputTokens} out`));
      console.log(chalk.gray(`Duration: ${result.duration}ms`));

    } catch (error) {
      spinner.fail('Execution failed');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Run to end of prompt
   */
  private async runToEnd(): Promise<void> {
    this.state.currentIndex = this.state.segments.length - 1;
    await this.executeAtCurrentPosition();
  }

  /**
   * Display help
   */
  private displayHelp(): void {
    console.log(chalk.bold.cyan('\n=== Debugger Commands ===\n'));
    console.log('  step, s, n, next  - Move to next segment');
    console.log('  back, b, prev     - Move to previous segment');
    console.log('  goto <n>, g <n>   - Jump to segment n');
    console.log('  run, r            - Run to end and execute');
    console.log('  execute, exec, e  - Execute prompt up to current segment');
    console.log('  edit              - Edit current segment');
    console.log('  view, v           - View all segments');
    console.log('  view <n>          - View segment n');
    console.log('  tokens, t         - Show token analysis');
    console.log('  history, h        - Show execution history');
    console.log('  help, ?           - Show this help');
    console.log('  quit, q, exit     - Exit debugger');
  }
}
