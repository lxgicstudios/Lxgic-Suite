#!/usr/bin/env node

/**
 * prompt-fallback - Fallback chains across AI providers
 *
 * Define provider fallback chains with automatic failover,
 * health checking, and cost-aware routing.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import { FallbackChain, getAvailableProviders } from './chain';
import { parseProviders, ProviderName, hasApiKey, getDefaultConfig } from './core';

const program = new Command();

interface RunOptions {
  providers?: string;
  config?: string;
  timeout?: string;
  costAware?: boolean;
  verbose?: boolean;
  json?: boolean;
}

interface ConfigOptions {
  json?: boolean;
}

interface TestOptions {
  providers?: string;
  verbose?: boolean;
  json?: boolean;
}

program
  .name('prompt-fallback')
  .description('Fallback chains across AI providers with automatic failover')
  .version('1.0.0');

// run command
program
  .command('run <promptFile>')
  .description('Run a prompt through the fallback chain')
  .option('-p, --providers <list>', 'Comma-separated provider list (e.g., claude,openai,mock)')
  .option('-c, --config <file>', 'Path to YAML config file')
  .option('-t, --timeout <ms>', 'Timeout per provider in milliseconds', '30000')
  .option('--cost-aware', 'Route to cheapest provider first')
  .option('-v, --verbose', 'Show detailed execution information')
  .option('--json', 'Output result as JSON')
  .action(async (promptFile: string, options: RunOptions) => {
    try {
      // Read prompt from file
      const prompt = await fs.readFile(promptFile, 'utf8');

      // Build configuration
      let config = getDefaultConfig();

      if (options.config) {
        config = await FallbackChain.loadConfig(options.config);
      }

      if (options.timeout) {
        config.timeout = parseInt(options.timeout, 10);
      }

      if (options.costAware) {
        config.costAware = true;
      }

      // Create chain and execute
      const chain = new FallbackChain(config, options.verbose);

      const providerNames = options.providers
        ? parseProviders(options.providers)
        : undefined;

      const result = await chain.execute(prompt.trim(), providerNames);

      if (options.json) {
        console.log(JSON.stringify({
          success: result.success,
          response: result.response ? {
            provider: result.response.provider,
            model: result.response.model,
            content: result.response.content,
            inputTokens: result.response.inputTokens,
            outputTokens: result.response.outputTokens,
            durationMs: result.response.durationMs,
            cost: result.response.cost
          } : null,
          attemptedProviders: result.attemptedProviders,
          errors: result.errors.map(e => ({
            provider: e.provider,
            error: e.error
          }))
        }, null, 2));
      } else if (result.success && result.response) {
        console.log(result.response.content);
      } else {
        console.error('All providers failed:');
        result.errors.forEach(e => {
          console.error(`  ${e.provider}: ${e.error}`);
        });
        process.exit(1);
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2));
      } else {
        console.error('Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

// config command
program
  .command('config')
  .description('Show current configuration and available providers')
  .option('--json', 'Output as JSON')
  .action((options: ConfigOptions) => {
    const config = getDefaultConfig();
    const available = getAvailableProviders();

    if (options.json) {
      console.log(JSON.stringify({
        availableProviders: available,
        defaultConfig: {
          timeout: config.timeout,
          retryAttempts: config.retryAttempts,
          costAware: config.costAware,
          providers: config.providers.map(p => ({
            name: p.name,
            model: p.model,
            priority: p.priority,
            envKey: p.envKey,
            hasApiKey: hasApiKey(p),
            costPer1kInput: p.costPer1kInput,
            costPer1kOutput: p.costPer1kOutput
          }))
        }
      }, null, 2));
    } else {
      console.log('Available Providers:');
      console.log('====================\n');

      config.providers.forEach(p => {
        const keyStatus = hasApiKey(p) ? 'configured' : 'NOT SET';
        console.log(`  ${p.name}`);
        console.log(`    Model: ${p.model}`);
        console.log(`    Priority: ${p.priority}`);
        if (p.envKey) {
          console.log(`    API Key (${p.envKey}): ${keyStatus}`);
        }
        if (p.costPer1kInput !== undefined) {
          console.log(`    Cost: $${p.costPer1kInput}/1k input, $${p.costPer1kOutput}/1k output`);
        }
        console.log('');
      });

      console.log('Default Settings:');
      console.log('=================');
      console.log(`  Timeout: ${config.timeout}ms`);
      console.log(`  Retry Attempts: ${config.retryAttempts}`);
      console.log(`  Cost-Aware Routing: ${config.costAware}`);
      console.log('\nExample config file (fallback.yaml):');
      console.log('=====================================');
      console.log(`providers:
  - name: claude
    model: claude-sonnet-4-20250514
    priority: 1
  - name: openai
    model: gpt-4
    priority: 2
    env: OPENAI_API_KEY
timeout: 30000
costAware: false`);
    }
  });

// test-providers command
program
  .command('test-providers')
  .description('Test health of configured providers')
  .option('-p, --providers <list>', 'Comma-separated provider list to test')
  .option('-v, --verbose', 'Show detailed test information')
  .option('--json', 'Output as JSON')
  .action(async (options: TestOptions) => {
    try {
      const chain = new FallbackChain(undefined, options.verbose);

      const providerNames = options.providers
        ? parseProviders(options.providers)
        : undefined;

      const results = await chain.testProviders(providerNames as ProviderName[] | undefined);

      if (options.json) {
        console.log(JSON.stringify({
          success: results.every(r => r.healthy),
          results: results.map(r => ({
            provider: r.provider,
            healthy: r.healthy,
            latencyMs: r.latencyMs,
            error: r.errorMessage
          }))
        }, null, 2));
      } else {
        console.log('Provider Health Check Results:');
        console.log('==============================\n');

        results.forEach(r => {
          const status = r.healthy ? 'OK' : 'FAILED';
          const latency = r.latencyMs ? ` (${r.latencyMs}ms)` : '';
          console.log(`  ${r.provider}: ${status}${latency}`);
          if (r.errorMessage) {
            console.log(`    Error: ${r.errorMessage}`);
          }
        });

        const allHealthy = results.every(r => r.healthy);
        console.log('');
        console.log(allHealthy ? 'All providers healthy!' : 'Some providers are unhealthy.');

        if (!allHealthy) {
          process.exit(1);
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, null, 2));
      } else {
        console.error('Error:', error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
