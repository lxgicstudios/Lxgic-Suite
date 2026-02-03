#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadConfig,
  saveConfig,
  loadPrompts,
  SlackConfig,
  getEnvConfig,
  validateSlackConfig
} from './core';
import { createBot } from './bot';

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
  .name('ai-slack')
  .description('Slack bot powered by your prompts')
  .version('1.0.0')
  .option('--json', 'Output results as JSON')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('deploy')
  .description('Deploy and start the Slack bot')
  .option('-t, --token <token>', 'Slack bot token (or set SLACK_BOT_TOKEN)')
  .option('-s, --signing-secret <secret>', 'Slack signing secret (or set SLACK_SIGNING_SECRET)')
  .option('-a, --app-token <token>', 'Slack app token for socket mode (or set SLACK_APP_TOKEN)')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-d, --prompts <dir>', 'Prompts directory', 'prompts')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const envConfig = getEnvConfig();

      // Merge configs with priority: CLI > env > file
      const mergedConfig: SlackConfig = {
        ...config,
        ...envConfig,
        token: options.token || envConfig.token || config.token,
        signingSecret: options.signingSecret || envConfig.signingSecret || config.signingSecret,
        appToken: options.appToken || envConfig.appToken || config.appToken,
        port: parseInt(options.port, 10)
      };

      // Validate
      const validation = validateSlackConfig(mergedConfig);
      if (!validation.valid) {
        outputError(validation.errors.join('\n'), {
          hint: 'Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET environment variables'
        });
        return;
      }

      // Check prompts directory
      const promptsDir = path.resolve(process.cwd(), options.prompts);
      if (!fs.existsSync(promptsDir)) {
        if (!jsonOutput) {
          console.log(chalk.yellow(`Prompts directory not found: ${promptsDir}`));
          console.log(chalk.gray('Bot will start with no prompts configured'));
        }
      }

      if (!jsonOutput) {
        console.log(chalk.blue('Starting Slack bot...'));
        console.log(chalk.gray(`Port: ${mergedConfig.port}`));
        console.log(chalk.gray(`Socket mode: ${mergedConfig.appToken ? 'enabled' : 'disabled'}`));
      }

      const bot = await createBot({
        config: mergedConfig,
        promptsDir,
        verbose: options.verbose && !jsonOutput
      });

      await bot.start(mergedConfig.port);

      const prompts = bot.getPrompts();

      if (jsonOutput) {
        output({
          status: 'running',
          port: mergedConfig.port,
          socketMode: !!mergedConfig.appToken,
          promptCount: prompts.length,
          commands: ['/ask', '/prompt', '/help']
        });
      } else {
        console.log(chalk.green('Slack bot is running!'));
        console.log();
        console.log(`Loaded ${chalk.cyan(prompts.length)} prompts`);
        console.log();
        console.log(chalk.gray('Available commands:'));
        console.log(chalk.gray('  /ask <question>         - Ask a question'));
        console.log(chalk.gray('  /prompt list            - List prompts'));
        console.log(chalk.gray('  /prompt use <n> <input> - Use a prompt'));
        console.log(chalk.gray('  /help                   - Show help'));
        console.log();
        console.log(chalk.gray('Press Ctrl+C to stop'));
      }

      // Handle shutdown
      process.on('SIGINT', async () => {
        if (!jsonOutput) {
          console.log(chalk.yellow('\nShutting down...'));
        }
        await bot.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await bot.stop();
        process.exit(0);
      });
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Failed to deploy bot');
    }
  });

program
  .command('test')
  .description('Test bot configuration and connectivity')
  .option('-t, --token <token>', 'Slack bot token')
  .option('-s, --signing-secret <secret>', 'Slack signing secret')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const envConfig = getEnvConfig();

      const mergedConfig: SlackConfig = {
        ...config,
        ...envConfig,
        token: options.token || envConfig.token || config.token,
        signingSecret: options.signingSecret || envConfig.signingSecret || config.signingSecret
      };

      if (!jsonOutput) {
        console.log(chalk.blue('Testing Slack configuration...'));
        console.log();
      }

      const tests: { name: string; status: 'pass' | 'fail'; message?: string }[] = [];

      // Check token
      if (mergedConfig.token) {
        tests.push({ name: 'Bot token', status: 'pass' });
      } else {
        tests.push({
          name: 'Bot token',
          status: 'fail',
          message: 'Missing SLACK_BOT_TOKEN'
        });
      }

      // Check signing secret
      if (mergedConfig.signingSecret) {
        tests.push({ name: 'Signing secret', status: 'pass' });
      } else {
        tests.push({
          name: 'Signing secret',
          status: 'fail',
          message: 'Missing SLACK_SIGNING_SECRET'
        });
      }

      // Check app token (optional)
      if (mergedConfig.appToken) {
        tests.push({ name: 'App token (socket mode)', status: 'pass' });
      } else {
        tests.push({
          name: 'App token (socket mode)',
          status: 'pass',
          message: 'Not configured (using HTTP mode)'
        });
      }

      // Check prompts
      const prompts = loadPrompts();
      tests.push({
        name: 'Prompts',
        status: 'pass',
        message: `${prompts.length} prompt(s) found`
      });

      // Test API connectivity if token exists
      if (mergedConfig.token) {
        try {
          const response = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mergedConfig.token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          const data = await response.json() as any;

          if (data.ok) {
            tests.push({
              name: 'API connectivity',
              status: 'pass',
              message: `Connected as ${data.user}`
            });
          } else {
            tests.push({
              name: 'API connectivity',
              status: 'fail',
              message: data.error
            });
          }
        } catch (error) {
          tests.push({
            name: 'API connectivity',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Connection failed'
          });
        }
      }

      const allPassed = tests.every(t => t.status === 'pass');

      if (jsonOutput) {
        output({
          success: allPassed,
          tests
        });
      } else {
        for (const test of tests) {
          const icon = test.status === 'pass' ? chalk.green('✓') : chalk.red('✗');
          const message = test.message ? chalk.gray(` - ${test.message}`) : '';
          console.log(`${icon} ${test.name}${message}`);
        }

        console.log();
        if (allPassed) {
          console.log(chalk.green('All tests passed!'));
        } else {
          console.log(chalk.red('Some tests failed. Please check your configuration.'));
        }
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Test failed');
    }
  });

program
  .command('configure')
  .description('Configure bot settings')
  .option('-c, --channels <channels>', 'Comma-separated channel IDs')
  .option('-p, --port <port>', 'Default port')
  .option('--list', 'List current configuration')
  .action((options) => {
    try {
      const config = loadConfig();

      if (options.list) {
        if (jsonOutput) {
          output(config);
        } else {
          console.log(chalk.blue('Current configuration:'));
          console.log();
          console.log(`Port: ${config.port || 3000}`);
          console.log(`Channels: ${config.channels?.map(c => c.id).join(', ') || 'none'}`);
          console.log(`Commands: ${config.commands?.length || 0}`);
          console.log(`Prompts: ${config.prompts?.length || 0}`);
        }
        return;
      }

      // Update config
      if (options.port) {
        config.port = parseInt(options.port, 10);
      }

      if (options.channels) {
        config.channels = options.channels.split(',').map((id: string) => ({
          id: id.trim(),
          enabled: true
        }));
      }

      saveConfig(config);

      if (jsonOutput) {
        output({ success: true, config });
      } else {
        console.log(chalk.green('Configuration saved!'));
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Configuration failed');
    }
  });

program
  .command('init')
  .description('Initialize sample configuration and prompts')
  .option('-d, --dir <directory>', 'Prompts directory', 'prompts')
  .action((options) => {
    try {
      const promptsDir = path.resolve(process.cwd(), options.dir);

      // Create prompts directory
      if (!fs.existsSync(promptsDir)) {
        fs.mkdirSync(promptsDir, { recursive: true });
      }

      // Create sample prompts
      const samples = [
        {
          name: 'default.prompt',
          content: `---
name: default
description: Default prompt for questions
model: gpt-4
---
Please help me with the following question:

{{input}}

Provide a clear and helpful response.`
        },
        {
          name: 'summarize.prompt',
          content: `---
name: summarize
description: Summarize text
---
Please summarize the following text concisely:

{{input}}`
        }
      ];

      for (const sample of samples) {
        const filePath = path.join(promptsDir, sample.name);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, sample.content);
        }
      }

      // Create default config
      const config: SlackConfig = {
        port: 3000,
        channels: [],
        commands: [
          { name: '/ask', description: 'Ask a question', prompt: 'default' },
          { name: '/prompt', description: 'Use a specific prompt' }
        ]
      };
      saveConfig(config);

      if (jsonOutput) {
        output({
          success: true,
          promptsDir,
          files: samples.map(s => s.name),
          config: '.ai-slack.json'
        });
      } else {
        console.log(chalk.green('Initialization complete!'));
        console.log();
        console.log('Created:');
        console.log(`  ${chalk.cyan(promptsDir + '/')} - Prompts directory`);
        for (const sample of samples) {
          console.log(`    ${chalk.gray(sample.name)}`);
        }
        console.log(`  ${chalk.cyan('.ai-slack.json')} - Configuration file`);
        console.log();
        console.log('Next steps:');
        console.log('1. Set environment variables:');
        console.log(chalk.gray('   export SLACK_BOT_TOKEN=xoxb-your-token'));
        console.log(chalk.gray('   export SLACK_SIGNING_SECRET=your-secret'));
        console.log();
        console.log('2. Deploy the bot:');
        console.log(chalk.cyan('   ai-slack deploy'));
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : 'Initialization failed');
    }
  });

program.parse();
