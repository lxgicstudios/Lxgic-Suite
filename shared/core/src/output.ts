import chalk from 'chalk';
import ora, { Ora } from 'ora';

export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

export class Output {
  private options: OutputOptions;
  private spinner: Ora | null = null;

  constructor(options: OutputOptions = {}) {
    this.options = options;
  }

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  success(message: string, data?: any): void {
    if (this.options.json) {
      this.json({ success: true, message, data });
    } else if (!this.options.quiet) {
      console.log(chalk.green('✓'), message);
      if (data && this.options.verbose) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }
  }

  error(message: string, error?: any): void {
    if (this.options.json) {
      this.json({ success: false, error: message, details: error });
    } else {
      console.error(chalk.red('✗'), message);
      if (error && this.options.verbose) {
        console.error(chalk.gray(error.stack || error));
      }
    }
  }

  warn(message: string): void {
    if (!this.options.json && !this.options.quiet) {
      console.log(chalk.yellow('⚠'), message);
    }
  }

  info(message: string): void {
    if (!this.options.json && !this.options.quiet) {
      console.log(chalk.blue('ℹ'), message);
    }
  }

  log(message: string): void {
    if (!this.options.json && !this.options.quiet) {
      console.log(message);
    }
  }

  verbose(message: string): void {
    if (this.options.verbose && !this.options.json && !this.options.quiet) {
      console.log(chalk.gray(message));
    }
  }

  table(headers: string[], rows: string[][]): void {
    if (this.options.json) {
      this.json(rows.map(row =>
        Object.fromEntries(headers.map((h, i) => [h, row[i]]))
      ));
    } else if (!this.options.quiet) {
      const colWidths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map(r => (r[i] || '').length))
      );

      const line = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
      console.log('┌' + line.replace(/┼/g, '┬') + '┐');

      console.log('│' + headers.map((h, i) =>
        ` ${chalk.bold(h.padEnd(colWidths[i]))} `
      ).join('│') + '│');

      console.log('├' + line + '┤');

      for (const row of rows) {
        console.log('│' + row.map((c, i) =>
          ` ${(c || '').padEnd(colWidths[i])} `
        ).join('│') + '│');
      }

      console.log('└' + line.replace(/┼/g, '┴') + '┘');
    }
  }

  startSpinner(message: string): void {
    if (!this.options.json && !this.options.quiet) {
      this.spinner = ora(message).start();
    }
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  stopSpinner(success: boolean = true, message?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }

  progress(current: number, total: number, label: string = ''): void {
    if (!this.options.json && !this.options.quiet) {
      const percent = Math.round((current / total) * 100);
      const filled = Math.round(percent / 2);
      const bar = '█'.repeat(filled) + '░'.repeat(50 - filled);
      process.stdout.write(`\r${label} [${bar}] ${percent}% (${current}/${total})`);
      if (current === total) {
        console.log();
      }
    }
  }
}

export function createOutput(options: OutputOptions = {}): Output {
  return new Output(options);
}
