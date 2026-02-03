#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadConfig,
  saveConfig,
  loadLogs,
  testWebhook,
  formatDuration,
  WebhookConfig,
  LogEntry
} from './core';
import { startServer } from './server';

const program = new Command();

let jsonOutput = false;

function output(data: any, message?: string): void {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
  } else if (message) {
    console.log(message);
  } else {
    console.log(data);
  }
}

function outputError(error: string, data?: any): void {
  if (jsonOutput) {
    console.log(JSON.stringify({ error, ...data }, null, 2));
  } else {
    console.error(chalk.red(`Error: ${error}`));
  }
  process.exit(1);
}

program
  .name('ai-webhook')
  .description('Webhook server for AI event triggers')
  .version('1.0.0')
  .option('--json', 'Output results as JSON')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('serve')
  .description('Start the webhook server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --handler <path>', 'Path to handler file')
  .option('-a, --auth <token>', 'Authentication token')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--no-builtin', 'Disable built-in routes')
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        outputError('Invalid port number');
        return;
      }

      // Check if handler file exists
      if (options.handler) {
        const handlerPath = path.resolve(process.cwd(), options.handler);
        if (!fs.existsSync(handlerPath)) {
          outputError(`Handler file not found: ${handlerPath}`);
          return;
        }
      }

      // Save config
      const config: WebhookConfig = {
        port,
        handlerPath: options.handler,
        authToken: options.auth
      };
      saveConfig(config);

      if (!jsonOutput) {
        console.log(chalk.blue('Starting webhook server...'));
        console.log(chalk.gray(`Port: ${port}`));
        if (options.handler) {
          console.log(chalk.gray(`Handler: ${options.handler}`));
        }
        if (options.auth) {
          console.log(chalk.gray('Authentication: enabled'));
        }
        console.log();
      }

      const server = await startServer({
        port,
        handlerPath: options.handler,
        authToken: options.auth,
        verbose: !jsonOutput && options.verbose,
        enableBuiltIn: options.builtin !== false
      });

      if (jsonOutput) {
        output({
          status: 'running',
          port,
          handler: options.handler || null,
          auth: !!options.auth,
          endpoints: {
            health: `http://localhost:${port}/health`,
            ping: `http://localhost:${port}/ping`,
            echo: `http://localhost:${port}/echo`
          }
        });
      } else {
        console.log(chalk.green(`Webhook server running on http://localhost:${port}`));
        console.log();
        console.log(chalk.gray('Built-in endpoints:'));
        console.log(chalk.gray(`  GET  /health - Health check`));
        console.log(chalk.gray(`  GET  /ping   - Ping/pong`));
        console.log(chalk.gray(`  ALL  /echo   - Echo request`));
        console.log();
        console.log(chalk.gray('Press Ctrl+C to stop'));
      }

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        if (!jsonOutput) {
          console.log(chalk.yellow('\nShutting down...'));
        }
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
      });
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Failed to start server');
    }
  });

program
  .command('test <url>')
  .description('Test a webhook endpoint')
  .option('-m, --method <method>', 'HTTP method', 'POST')
  .option('-d, --data <json>', 'Request body as JSON')
  .option('-H, --header <header>', 'Add header (format: "Key: Value")', (value, previous: string[]) => {
    previous = previous || [];
    previous.push(value);
    return previous;
  }, [])
  .option('-a, --auth <token>', 'Bearer authentication token')
  .action(async (url, options) => {
    try {
      // Parse headers
      const headers: Record<string, string> = {};
      if (options.header) {
        for (const h of options.header) {
          const [key, ...valueParts] = h.split(':');
          if (key && valueParts.length > 0) {
            headers[key.trim()] = valueParts.join(':').trim();
          }
        }
      }

      // Add auth header if provided
      if (options.auth) {
        headers['Authorization'] = `Bearer ${options.auth}`;
      }

      // Parse body
      let body: any;
      if (options.data) {
        try {
          body = JSON.parse(options.data);
        } catch {
          body = options.data;
        }
      }

      if (!jsonOutput) {
        console.log(chalk.blue(`Testing webhook: ${url}`));
        console.log(chalk.gray(`Method: ${options.method}`));
        if (body) {
          console.log(chalk.gray(`Body: ${JSON.stringify(body)}`));
        }
        console.log();
      }

      const result = await testWebhook(url, options.method, body, headers);

      if (jsonOutput) {
        output({
          url,
          method: options.method,
          status: result.status,
          duration: result.duration,
          response: result.body
        });
      } else {
        const statusColor = result.status >= 200 && result.status < 300 ? chalk.green : chalk.red;
        console.log(`Status: ${statusColor(result.status)}`);
        console.log(`Duration: ${chalk.cyan(formatDuration(result.duration))}`);
        console.log('Response:');
        console.log(JSON.stringify(result.body, null, 2));
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Test failed');
    }
  });

program
  .command('logs')
  .description('View webhook request logs')
  .option('-n, --limit <count>', 'Number of logs to show', '20')
  .option('-f, --filter <status>', 'Filter by status code')
  .option('-p, --path <path>', 'Filter by path')
  .option('--clear', 'Clear all logs')
  .action((options) => {
    try {
      if (options.clear) {
        fs.writeFileSync(path.join(process.cwd(), '.ai-webhook-logs.json'), '[]');
        if (jsonOutput) {
          output({ cleared: true });
        } else {
          console.log(chalk.green('Logs cleared'));
        }
        return;
      }

      let logs = loadLogs();

      // Apply filters
      if (options.filter) {
        const status = parseInt(options.filter, 10);
        logs = logs.filter(log => log.status === status);
      }

      if (options.path) {
        logs = logs.filter(log => log.path.includes(options.path));
      }

      // Limit results
      const limit = parseInt(options.limit, 10);
      logs = logs.slice(-limit).reverse();

      if (jsonOutput) {
        output({ logs, total: logs.length });
      } else {
        if (logs.length === 0) {
          console.log(chalk.yellow('No logs found'));
          return;
        }

        console.log(chalk.blue(`Recent webhook requests (${logs.length}):`));
        console.log();

        for (const log of logs) {
          const statusColor = log.status >= 200 && log.status < 300 ? chalk.green : chalk.red;
          console.log(
            `${chalk.gray(log.timestamp)} ${chalk.cyan(log.method.padEnd(6))} ${log.path} - ${statusColor(log.status)} (${formatDuration(log.duration)})`
          );
          if (log.error) {
            console.log(chalk.red(`  Error: ${log.error}`));
          }
        }
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Failed to load logs');
    }
  });

program
  .command('init')
  .description('Initialize a sample handler file')
  .option('-o, --output <path>', 'Output file path', 'webhook-handler.ts')
  .action((options) => {
    try {
      const outputPath = path.resolve(process.cwd(), options.output);

      if (fs.existsSync(outputPath)) {
        outputError(`File already exists: ${outputPath}`);
        return;
      }

      const sampleHandler = `import { WebhookRequest, WebhookResponse } from 'ai-webhook';

// Default handler for all requests
export default async function handler(request: WebhookRequest): Promise<WebhookResponse> {
  console.log(\`Received \${request.method} request to \${request.path}\`);

  // Process your webhook here
  const result = await processWebhook(request.body);

  return {
    status: 200,
    body: {
      success: true,
      message: 'Webhook processed',
      data: result
    }
  };
}

async function processWebhook(data: any): Promise<any> {
  // Add your custom logic here
  return {
    received: data,
    processedAt: new Date().toISOString()
  };
}

// Named route handlers
// Format: METHOD_path (underscores become slashes)
export async function POST_api_events(request: WebhookRequest): Promise<WebhookResponse> {
  // Handles POST /api/events
  return {
    status: 200,
    body: { event: 'processed', id: request.id }
  };
}

export async function GET_api_status(request: WebhookRequest): Promise<WebhookResponse> {
  // Handles GET /api/status
  return {
    status: 200,
    body: { status: 'ok', timestamp: new Date().toISOString() }
  };
}
`;

      fs.writeFileSync(outputPath, sampleHandler);

      if (jsonOutput) {
        output({ created: outputPath });
      } else {
        console.log(chalk.green(`Created sample handler: ${outputPath}`));
        console.log();
        console.log('To start the server with this handler:');
        console.log(chalk.cyan(`  ai-webhook serve --handler ${options.output}`));
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Failed to create handler');
    }
  });

program.parse();
