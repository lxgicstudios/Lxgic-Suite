#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { PromptPlayground, PlaygroundConfig } from './core.js';
import { startRepl } from './repl.js';

const program = new Command();

program
  .name('prompt-playground')
  .description('Interactive CLI prompt testing environment (REPL)')
  .version('1.0.0')
  .option('-m, --model <model>', 'Initial model to use', 'claude-3-5-sonnet-20241022')
  .option('-t, --temperature <temp>', 'Initial temperature', '0.7')
  .option('-s, --system <prompt>', 'Initial system prompt')
  .option('--max-tokens <tokens>', 'Maximum tokens in response', '4096')
  .option('--json', 'Output in JSON format')
  .option('--load <file>', 'Load session from file')
  .action(async (options) => {
    const config: PlaygroundConfig = {
      model: options.model,
      temperature: parseFloat(options.temperature),
      maxTokens: parseInt(options.maxTokens, 10),
      systemPrompt: options.system,
      jsonOutput: options.json || false,
    };

    if (!options.json) {
      console.log(chalk.cyan.bold('\n  Prompt Playground'));
      console.log(chalk.gray('  Interactive prompt testing environment\n'));
      console.log(chalk.gray('  Type /help for available commands\n'));
    }

    const playground = new PromptPlayground(config);

    if (options.load) {
      try {
        await playground.loadSession(options.load);
        if (!options.json) {
          console.log(chalk.green(`  Session loaded from ${options.load}\n`));
        }
      } catch (error) {
        if (!options.json) {
          console.error(chalk.red(`  Failed to load session: ${error}`));
        }
      }
    }

    await startRepl(playground, config.jsonOutput);
  });

program.parse();
