import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { PromptPlayground, estimateTokens } from './core.js';
import { CommandHandler } from './commands.js';

/**
 * REPL state
 */
interface ReplState {
  currentInput: string;
  multilineMode: boolean;
  isProcessing: boolean;
}

/**
 * Format the prompt line with token count
 */
function formatPrompt(tokenCount: number): string {
  return `${chalk.cyan('>')} ${chalk.gray(`[${tokenCount} tokens]`)} `;
}

/**
 * Start the interactive REPL
 */
export async function startRepl(playground: PromptPlayground, jsonOutput: boolean = false): Promise<void> {
  const commandHandler = new CommandHandler(playground, jsonOutput);
  const state: ReplState = {
    currentInput: '',
    multilineMode: false,
    isProcessing: false,
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: !jsonOutput,
  });

  const prompt = () => {
    if (!jsonOutput && !state.isProcessing) {
      const tokenCount = estimateTokens(state.currentInput);
      rl.setPrompt(formatPrompt(tokenCount));
      rl.prompt();
    }
  };

  // Initial prompt
  prompt();

  rl.on('line', async (line: string) => {
    if (state.isProcessing) {
      return;
    }

    // Handle multiline mode
    if (state.multilineMode) {
      if (line === '<<<') {
        // End multiline mode
        state.multilineMode = false;
        const input = state.currentInput;
        state.currentInput = '';
        await processInput(input);
      } else {
        state.currentInput += (state.currentInput ? '\n' : '') + line;
        if (!jsonOutput) {
          const tokenCount = estimateTokens(state.currentInput);
          process.stdout.write(`${chalk.gray(`... [${tokenCount} tokens]`)} `);
        }
      }
      return;
    }

    // Check for multiline start
    if (line === '>>>') {
      state.multilineMode = true;
      state.currentInput = '';
      if (!jsonOutput) {
        console.log(chalk.gray('Entering multiline mode. Type <<< on a new line to finish.'));
        process.stdout.write(`${chalk.gray('... [0 tokens]')} `);
      }
      return;
    }

    await processInput(line);
  });

  async function processInput(input: string): Promise<void> {
    const trimmed = input.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    // Check if it's a command
    if (trimmed.startsWith('/')) {
      const result = await commandHandler.execute(trimmed);

      if (result.shouldExit) {
        if (!jsonOutput) {
          console.log(chalk.cyan('\nGoodbye!\n'));
        }
        rl.close();
        process.exit(0);
      }

      if (jsonOutput) {
        console.log(JSON.stringify(result.data || { success: result.success, message: result.message }));
      } else if (result.message) {
        console.log(result.message);
      }

      prompt();
      return;
    }

    // Run the prompt
    state.isProcessing = true;

    if (jsonOutput) {
      // Non-streaming for JSON output
      try {
        const response = await playground.run(trimmed);
        console.log(JSON.stringify({
          role: response.role,
          content: response.content,
          tokenCount: response.tokenCount,
          latencyMs: response.latencyMs,
        }));
      } catch (error) {
        console.log(JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    } else {
      // Streaming output
      const spinner = ora({
        text: 'Thinking...',
        color: 'cyan',
      }).start();

      try {
        let firstChunk = true;
        const stream = playground.runStream(trimmed);

        for await (const chunk of stream) {
          if (firstChunk) {
            spinner.stop();
            console.log();
            console.log(chalk.green.bold('Assistant:'));
            firstChunk = false;
          }
          process.stdout.write(chunk);
        }

        // Get the final message with stats
        const result = await stream.next();
        if (result.done && result.value) {
          const msg = result.value;
          console.log();
          console.log(chalk.gray(`\n[${msg.tokenCount} tokens, ${msg.latencyMs}ms]`));
        }
      } catch (error) {
        spinner.stop();
        console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    state.isProcessing = false;
    prompt();
  }

  rl.on('close', () => {
    if (!jsonOutput) {
      console.log(chalk.cyan('\nGoodbye!\n'));
    }
    process.exit(0);
  });

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    if (state.isProcessing) {
      state.isProcessing = false;
      console.log(chalk.yellow('\nInterrupted'));
      prompt();
    } else if (state.multilineMode) {
      state.multilineMode = false;
      state.currentInput = '';
      console.log(chalk.yellow('\nMultiline mode cancelled'));
      prompt();
    } else {
      console.log(chalk.cyan('\nGoodbye!\n'));
      rl.close();
      process.exit(0);
    }
  });
}

export default startRepl;
