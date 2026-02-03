import { Command } from 'commander';
import chalk from 'chalk';

export interface CliOptions {
  name: string;
  version: string;
  description: string;
}

export function createCli(options: CliOptions): Command {
  const program = new Command();

  program
    .name(options.name)
    .version(options.version)
    .description(options.description)
    .option('--json', 'Output results in JSON format')
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output');

  return program;
}

export function printBanner(name: string, version: string): void {
  console.log(chalk.bold.blue(`\n${name} v${version}`));
  console.log(chalk.gray('─'.repeat(40)) + '\n');
}

export function handleCliError(error: unknown, json: boolean = false): never {
  if (json) {
    console.log(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  } else {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
