import { App, LogLevel } from '@slack/bolt';
import {
  SlackConfig,
  SlackMessage,
  SlackCommand,
  PromptConfig,
  loadPrompts,
  validateSlackConfig,
  getEnvConfig
} from './core';
import {
  HandlerContext,
  createHandlerRegistry,
  createErrorResponse
} from './handlers';

export interface BotOptions {
  config: SlackConfig;
  promptsDir?: string;
  verbose?: boolean;
}

export class SlackBot {
  private app: App | null = null;
  private config: SlackConfig;
  private prompts: Map<string, PromptConfig> = new Map();
  private verbose: boolean;

  constructor(options: BotOptions) {
    this.config = options.config;
    this.verbose = options.verbose || false;

    // Load prompts
    const loadedPrompts = loadPrompts(options.promptsDir);
    for (const prompt of loadedPrompts) {
      this.prompts.set(prompt.name, prompt);
    }

    // Also load prompts from config
    if (options.config.prompts) {
      for (const prompt of options.config.prompts) {
        this.prompts.set(prompt.name, prompt);
      }
    }
  }

  async initialize(): Promise<void> {
    // Merge with environment config
    const envConfig = getEnvConfig();
    const mergedConfig = { ...this.config, ...envConfig };

    // Validate config
    const validation = validateSlackConfig(mergedConfig);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Create Bolt app
    const appOptions: any = {
      token: mergedConfig.token,
      signingSecret: mergedConfig.signingSecret,
      logLevel: this.verbose ? LogLevel.DEBUG : LogLevel.INFO
    };

    // Use socket mode if app token is provided
    if (mergedConfig.appToken) {
      appOptions.socketMode = true;
      appOptions.appToken = mergedConfig.appToken;
    }

    this.app = new App(appOptions);

    // Setup handlers
    this.setupHandlers();
  }

  private setupHandlers(): void {
    if (!this.app) return;

    const context: HandlerContext = {
      prompts: this.prompts,
      config: this.config
    };

    const { commands, messageHandler } = createHandlerRegistry(context);

    // Register slash commands
    this.app.command('/ask', async ({ command, ack, respond }) => {
      await ack();

      try {
        const slackCommand: SlackCommand = {
          command: command.command,
          text: command.text,
          userId: command.user_id,
          channelId: command.channel_id,
          responseUrl: command.response_url
        };

        const handler = commands.get('/ask');
        if (handler) {
          const response = await handler(slackCommand, context);
          await respond({
            text: response.text,
            blocks: response.blocks as any,
            response_type: response.responseType
          });
        }
      } catch (error) {
        const errorResponse = createErrorResponse(
          error instanceof Error ? error.message : 'Command failed'
        );
        await respond({
          text: errorResponse.text,
          blocks: errorResponse.blocks as any,
          response_type: 'ephemeral'
        });
      }
    });

    this.app.command('/prompt', async ({ command, ack, respond }) => {
      await ack();

      try {
        const slackCommand: SlackCommand = {
          command: command.command,
          text: command.text,
          userId: command.user_id,
          channelId: command.channel_id,
          responseUrl: command.response_url
        };

        const handler = commands.get('/prompt');
        if (handler) {
          const response = await handler(slackCommand, context);
          await respond({
            text: response.text,
            blocks: response.blocks as any,
            response_type: response.responseType
          });
        }
      } catch (error) {
        const errorResponse = createErrorResponse(
          error instanceof Error ? error.message : 'Command failed'
        );
        await respond({
          text: errorResponse.text,
          blocks: errorResponse.blocks as any,
          response_type: 'ephemeral'
        });
      }
    });

    // Handle messages (mentions and DMs)
    this.app.event('app_mention', async ({ event, say }) => {
      try {
        const message: SlackMessage = {
          text: event.text.replace(/<@[^>]+>/g, '').trim(),
          channel: event.channel,
          user: event.user || 'unknown',
          ts: event.ts,
          threadTs: event.thread_ts
        };

        const response = await messageHandler(message, context);
        if (response) {
          await say({
            text: response.text,
            blocks: response.blocks as any,
            thread_ts: response.threadTs || message.threadTs || message.ts
          });
        }
      } catch (error) {
        if (this.verbose) {
          console.error('Error handling mention:', error);
        }
      }
    });

    this.app.event('message', async ({ event, say }) => {
      // Only handle direct messages
      if ((event as any).channel_type !== 'im') return;

      try {
        const msg = event as any;
        const message: SlackMessage = {
          text: msg.text || '',
          channel: msg.channel,
          user: msg.user,
          ts: msg.ts,
          threadTs: msg.thread_ts
        };

        // Skip bot messages
        if (msg.bot_id) return;

        const response = await messageHandler(message, context);
        if (response) {
          await say({
            text: response.text,
            blocks: response.blocks as any,
            thread_ts: response.threadTs
          });
        }
      } catch (error) {
        if (this.verbose) {
          console.error('Error handling message:', error);
        }
      }
    });

    if (this.verbose) {
      console.log('Slack handlers registered');
      console.log(`Loaded ${this.prompts.size} prompts`);
    }
  }

  async start(port?: number): Promise<void> {
    if (!this.app) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    const listenPort = port || this.config.port || 3000;

    await this.app.start(listenPort);

    if (this.verbose) {
      console.log(`Slack bot started on port ${listenPort}`);
    }
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
    }
  }

  getPrompts(): PromptConfig[] {
    return Array.from(this.prompts.values());
  }

  addPrompt(prompt: PromptConfig): void {
    this.prompts.set(prompt.name, prompt);
  }

  removePrompt(name: string): boolean {
    return this.prompts.delete(name);
  }
}

export async function createBot(options: BotOptions): Promise<SlackBot> {
  const bot = new SlackBot(options);
  await bot.initialize();
  return bot;
}
