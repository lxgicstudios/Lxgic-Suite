#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadConfig,
  saveConfig,
  scanPromptFiles,
  APIConfig
} from './core';
import {
  generateAPI,
  writeGeneratedAPI,
  generateDocs
} from './generator';
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
  .name('prompt-api')
  .description('Generate REST API from prompt definitions')
  .version('1.0.0')
  .option('--json', 'Output results as JSON')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('generate <prompts-dir>')
  .description('Generate API from prompt files')
  .option('-o, --output <dir>', 'Output directory', 'api')
  .option('-t, --title <title>', 'API title', 'Prompt API')
  .option('-v, --version <version>', 'API version', '1.0.0')
  .option('--description <desc>', 'API description')
  .action(async (promptsDir, options) => {
    try {
      const absolutePromptDir = path.resolve(process.cwd(), promptsDir);

      if (!fs.existsSync(absolutePromptDir)) {
        outputError(`Directory not found: ${absolutePromptDir}`);
        return;
      }

      if (!jsonOutput) {
        console.log(chalk.blue('Scanning prompt files...'));
      }

      const files = await scanPromptFiles(promptsDir);

      if (files.length === 0) {
        outputError('No prompt files found', {
          directory: absolutePromptDir,
          patterns: ['*.prompt', '*.prompt.yaml', '*.prompt.yml', '*.prompt.json']
        });
        return;
      }

      if (!jsonOutput) {
        console.log(chalk.gray(`Found ${files.length} prompt files`));
        console.log(chalk.blue('Generating API...'));
      }

      const api = await generateAPI(promptsDir, {
        title: options.title,
        version: options.version,
        description: options.description
      });

      await writeGeneratedAPI(api, options.output);

      // Save config
      const config: APIConfig = {
        promptsDir,
        outputDir: options.output,
        title: options.title,
        version: options.version
      };
      saveConfig(config);

      if (jsonOutput) {
        output({
          success: true,
          promptsDir: absolutePromptDir,
          outputDir: path.resolve(process.cwd(), options.output),
          promptCount: api.prompts.length,
          endpointCount: api.endpoints.length,
          files: {
            openapi: path.join(options.output, 'openapi.json'),
            server: path.join(options.output, 'server.js'),
            endpoints: path.join(options.output, 'endpoints.json')
          }
        });
      } else {
        console.log();
        console.log(chalk.green('API generated successfully!'));
        console.log();
        console.log(chalk.gray('Generated files:'));
        console.log(chalk.gray(`  ${options.output}/openapi.json   - OpenAPI specification`));
        console.log(chalk.gray(`  ${options.output}/server.js      - Express server`));
        console.log(chalk.gray(`  ${options.output}/endpoints.json - Endpoint list`));
        console.log(chalk.gray(`  ${options.output}/prompts/       - Prompt definitions`));
        console.log();
        console.log(`Prompts: ${chalk.cyan(api.prompts.length)}`);
        console.log(`Endpoints: ${chalk.cyan(api.endpoints.length)}`);
        console.log();
        console.log('Endpoints:');
        for (const endpoint of api.endpoints) {
          console.log(`  ${chalk.cyan(endpoint.method.padEnd(6))} ${endpoint.path}`);
        }
        console.log();
        console.log('To start the server:');
        console.log(chalk.cyan(`  prompt-api serve --port 3000`));
        console.log();
        console.log('Or run directly:');
        console.log(chalk.cyan(`  node ${options.output}/server.js`));
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Generation failed');
    }
  });

program
  .command('serve')
  .description('Start the API server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-d, --prompts <dir>', 'Prompts directory')
  .option('-o, --output <dir>', 'Output directory (from generate)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-t, --title <title>', 'API title')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        outputError('Invalid port number');
        return;
      }

      const promptsDir = options.prompts || config.promptsDir;
      const outputDir = options.output || config.outputDir;

      if (!promptsDir && !outputDir) {
        outputError('Please specify --prompts or --output directory, or run generate first');
        return;
      }

      if (!jsonOutput) {
        console.log(chalk.blue('Starting API server...'));
      }

      const server = await startServer({
        port,
        promptsDir,
        outputDir,
        verbose: !jsonOutput && options.verbose,
        title: options.title || config.title
      });

      const prompts = server.getPrompts();

      if (jsonOutput) {
        output({
          status: 'running',
          port,
          promptCount: prompts.length,
          endpoints: {
            health: `http://localhost:${port}/health`,
            docs: `http://localhost:${port}/docs`,
            openapi: `http://localhost:${port}/openapi.json`,
            prompts: `http://localhost:${port}/prompts`
          }
        });
      } else {
        console.log(chalk.green(`API server running on http://localhost:${port}`));
        console.log();
        console.log(`Loaded ${chalk.cyan(prompts.length)} prompts`);
        console.log();
        console.log(chalk.gray('Endpoints:'));
        console.log(chalk.gray(`  GET  /health       - Health check`));
        console.log(chalk.gray(`  GET  /docs         - API documentation`));
        console.log(chalk.gray(`  GET  /openapi.json - OpenAPI spec`));
        console.log(chalk.gray(`  GET  /prompts      - List prompts`));
        console.log();
        console.log(chalk.gray('Prompt endpoints:'));
        for (const prompt of prompts) {
          console.log(chalk.gray(`  ${(prompt.method || 'POST').padEnd(6)} ${prompt.endpoint}`));
        }
        console.log();
        console.log(chalk.gray('Press Ctrl+C to stop'));
      }

      // Handle shutdown
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
  .command('docs')
  .description('Generate API documentation')
  .option('-d, --prompts <dir>', 'Prompts directory')
  .option('-o, --output <file>', 'Output file')
  .option('-f, --format <format>', 'Output format (markdown, html)', 'markdown')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const promptsDir = options.prompts || config.promptsDir;

      if (!promptsDir) {
        outputError('Please specify --prompts directory or run generate first');
        return;
      }

      const api = await generateAPI(promptsDir);

      let docs: string;
      if (options.format === 'html') {
        docs = generateHTMLDocs(api);
      } else {
        docs = generateDocs(api);
      }

      if (options.output) {
        fs.writeFileSync(options.output, docs);
        if (jsonOutput) {
          output({ success: true, output: options.output });
        } else {
          console.log(chalk.green(`Documentation written to: ${options.output}`));
        }
      } else {
        if (jsonOutput) {
          output({ documentation: docs });
        } else {
          console.log(docs);
        }
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Failed to generate docs');
    }
  });

program
  .command('init')
  .description('Initialize sample prompt files')
  .option('-d, --dir <directory>', 'Output directory', 'prompts')
  .action((options) => {
    try {
      const outputDir = path.resolve(process.cwd(), options.dir);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Create sample prompt files
      const samples = [
        {
          name: 'summarize.prompt',
          content: `---
name: summarize
description: Summarize the given text
method: POST
input:
  type: object
  properties:
    text:
      type: string
      description: The text to summarize
    length:
      type: string
      description: Summary length (short, medium, long)
      enum: [short, medium, long]
      default: medium
  required:
    - text
output:
  type: object
  properties:
    summary:
      type: string
model: gpt-4
parameters:
  temperature: 0.7
  maxTokens: 500
---
Please summarize the following text in a {{length}} format:

{{text}}

Provide a clear and concise summary.`
        },
        {
          name: 'translate.prompt.yaml',
          content: `name: translate
description: Translate text between languages
endpoint: /translate
method: POST
input:
  type: object
  properties:
    text:
      type: string
      description: Text to translate
    source:
      type: string
      description: Source language
      default: auto
    target:
      type: string
      description: Target language
  required:
    - text
    - target
output:
  type: object
  properties:
    translation:
      type: string
    detectedLanguage:
      type: string
model: gpt-4
template: |
  Translate the following text from {{source}} to {{target}}:

  {{text}}

  Provide only the translation.`
        }
      ];

      for (const sample of samples) {
        const filePath = path.join(outputDir, sample.name);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, sample.content);
        }
      }

      if (jsonOutput) {
        output({
          success: true,
          directory: outputDir,
          files: samples.map(s => s.name)
        });
      } else {
        console.log(chalk.green(`Sample prompts created in: ${outputDir}`));
        console.log();
        console.log('Files created:');
        for (const sample of samples) {
          console.log(`  ${chalk.cyan(sample.name)}`);
        }
        console.log();
        console.log('To generate API:');
        console.log(chalk.cyan(`  prompt-api generate ${options.dir} --output api/`));
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Failed to initialize');
    }
  });

function generateHTMLDocs(api: any): string {
  const markdown = generateDocs(api);
  return `<!DOCTYPE html>
<html>
<head>
  <title>${api.openapi.info.title} - Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
  </style>
</head>
<body>
<div id="content"></div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
document.getElementById('content').innerHTML = marked.parse(\`${markdown.replace(/`/g, '\\`')}\`);
</script>
</body>
</html>`;
}

program.parse();
