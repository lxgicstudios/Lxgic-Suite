import chalk from 'chalk';
import { PromptPlayground, estimateTokens } from './core.js';

/**
 * Command result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  shouldExit?: boolean;
}

/**
 * Available models for quick reference
 */
const AVAILABLE_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

/**
 * Command handlers for REPL
 */
export class CommandHandler {
  private playground: PromptPlayground;
  private jsonOutput: boolean;

  constructor(playground: PromptPlayground, jsonOutput: boolean = false) {
    this.playground = playground;
    this.jsonOutput = jsonOutput;
  }

  /**
   * Parse and execute a command
   */
  async execute(input: string): Promise<CommandResult> {
    const trimmed = input.trim();

    if (!trimmed.startsWith('/')) {
      return { success: false, message: 'Not a command' };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'help':
        return this.help();
      case 'model':
        return this.setModel(args);
      case 'temp':
      case 'temperature':
        return this.setTemperature(args);
      case 'system':
        return this.setSystem(args);
      case 'save':
        return await this.save(args);
      case 'load':
        return await this.load(args);
      case 'history':
        return this.history();
      case 'clear':
        return this.clear();
      case 'config':
        return this.showConfig();
      case 'stats':
        return this.showStats();
      case 'sessions':
        return this.listSessions();
      case 'exit':
      case 'quit':
        return { success: true, shouldExit: true };
      default:
        return { success: false, message: `Unknown command: /${command}. Type /help for available commands.` };
    }
  }

  /**
   * Show help message
   */
  private help(): CommandResult {
    const helpText = `
${chalk.cyan.bold('Available Commands:')}

  ${chalk.yellow('/run')}              Execute the current prompt
  ${chalk.yellow('/model <name>')}     Change the model (e.g., /model claude-3-haiku-20240307)
  ${chalk.yellow('/temp <value>')}     Set temperature 0-1 (e.g., /temp 0.5)
  ${chalk.yellow('/system <prompt>')}  Set system prompt (e.g., /system You are a helpful assistant)
  ${chalk.yellow('/save [file]')}      Save session to file or store
  ${chalk.yellow('/load <source>')}    Load session from file or session ID
  ${chalk.yellow('/history')}          Show conversation history
  ${chalk.yellow('/clear')}            Clear conversation history
  ${chalk.yellow('/config')}           Show current configuration
  ${chalk.yellow('/stats')}            Show session statistics
  ${chalk.yellow('/sessions')}         List saved sessions
  ${chalk.yellow('/help')}             Show this help message
  ${chalk.yellow('/exit')}             Exit the playground

${chalk.cyan.bold('Available Models:')}
${AVAILABLE_MODELS.map(m => `  - ${m}`).join('\n')}

${chalk.gray('Type your prompt and press Enter to send it to the model.')}
${chalk.gray('Use Shift+Enter or paste for multi-line prompts.')}
`;

    if (this.jsonOutput) {
      return {
        success: true,
        data: {
          commands: [
            { name: '/run', description: 'Execute the current prompt' },
            { name: '/model <name>', description: 'Change the model' },
            { name: '/temp <value>', description: 'Set temperature 0-1' },
            { name: '/system <prompt>', description: 'Set system prompt' },
            { name: '/save [file]', description: 'Save session' },
            { name: '/load <source>', description: 'Load session' },
            { name: '/history', description: 'Show conversation history' },
            { name: '/clear', description: 'Clear conversation history' },
            { name: '/config', description: 'Show current configuration' },
            { name: '/stats', description: 'Show session statistics' },
            { name: '/sessions', description: 'List saved sessions' },
            { name: '/help', description: 'Show help message' },
            { name: '/exit', description: 'Exit the playground' },
          ],
          models: AVAILABLE_MODELS,
        },
      };
    }

    return { success: true, message: helpText };
  }

  /**
   * Set model
   */
  private setModel(model: string): CommandResult {
    if (!model) {
      const currentModel = this.playground.getConfig().model;
      if (this.jsonOutput) {
        return {
          success: true,
          data: { currentModel, availableModels: AVAILABLE_MODELS },
        };
      }
      return {
        success: true,
        message: `Current model: ${chalk.cyan(currentModel)}\n\nAvailable models:\n${AVAILABLE_MODELS.map(m => `  - ${m}`).join('\n')}`,
      };
    }

    this.playground.setModel(model);

    if (this.jsonOutput) {
      return { success: true, data: { model } };
    }
    return { success: true, message: chalk.green(`Model set to: ${model}`) };
  }

  /**
   * Set temperature
   */
  private setTemperature(value: string): CommandResult {
    if (!value) {
      const currentTemp = this.playground.getConfig().temperature;
      if (this.jsonOutput) {
        return { success: true, data: { temperature: currentTemp } };
      }
      return { success: true, message: `Current temperature: ${chalk.cyan(currentTemp)}` };
    }

    const temp = parseFloat(value);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      return { success: false, message: 'Temperature must be a number between 0 and 1' };
    }

    this.playground.setTemperature(temp);

    if (this.jsonOutput) {
      return { success: true, data: { temperature: temp } };
    }
    return { success: true, message: chalk.green(`Temperature set to: ${temp}`) };
  }

  /**
   * Set system prompt
   */
  private setSystem(prompt: string): CommandResult {
    if (!prompt) {
      const currentSystem = this.playground.getConfig().systemPrompt;
      if (this.jsonOutput) {
        return { success: true, data: { systemPrompt: currentSystem || null } };
      }
      return {
        success: true,
        message: currentSystem
          ? `Current system prompt:\n${chalk.gray(currentSystem)}`
          : chalk.gray('No system prompt set'),
      };
    }

    this.playground.setSystemPrompt(prompt);

    if (this.jsonOutput) {
      return { success: true, data: { systemPrompt: prompt } };
    }
    return { success: true, message: chalk.green(`System prompt set (${estimateTokens(prompt)} tokens estimated)`) };
  }

  /**
   * Save session
   */
  private async save(filename?: string): Promise<CommandResult> {
    try {
      const result = await this.playground.saveSession(filename || undefined);

      if (this.jsonOutput) {
        return { success: true, data: { savedTo: result } };
      }
      return { success: true, message: chalk.green(`Session saved to: ${result}`) };
    } catch (error) {
      return { success: false, message: `Failed to save session: ${error}` };
    }
  }

  /**
   * Load session
   */
  private async load(source: string): Promise<CommandResult> {
    if (!source) {
      return { success: false, message: 'Please provide a file path or session ID' };
    }

    try {
      await this.playground.loadSession(source);
      const history = this.playground.getHistory();

      if (this.jsonOutput) {
        return { success: true, data: { loaded: source, messageCount: history.length } };
      }
      return { success: true, message: chalk.green(`Session loaded: ${history.length} messages`) };
    } catch (error) {
      return { success: false, message: `Failed to load session: ${error}` };
    }
  }

  /**
   * Show history
   */
  private history(): CommandResult {
    const messages = this.playground.getHistory();

    if (messages.length === 0) {
      if (this.jsonOutput) {
        return { success: true, data: { messages: [] } };
      }
      return { success: true, message: chalk.gray('No conversation history') };
    }

    if (this.jsonOutput) {
      return {
        success: true,
        data: {
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            tokenCount: m.tokenCount,
            latencyMs: m.latencyMs,
          })),
        },
      };
    }

    let output = chalk.cyan.bold('\nConversation History:\n');
    for (const msg of messages) {
      const roleColor = msg.role === 'user' ? chalk.blue : chalk.green;
      const roleLabel = msg.role === 'user' ? 'You' : 'Assistant';
      const truncatedContent = msg.content.length > 200
        ? msg.content.slice(0, 200) + '...'
        : msg.content;

      output += `\n${roleColor.bold(roleLabel)} ${chalk.gray(`(${msg.tokenCount || '?'} tokens)`)}\n`;
      output += `${truncatedContent}\n`;
    }

    return { success: true, message: output };
  }

  /**
   * Clear history
   */
  private clear(): CommandResult {
    this.playground.clearHistory();

    if (this.jsonOutput) {
      return { success: true, data: { cleared: true } };
    }
    return { success: true, message: chalk.green('Conversation history cleared') };
  }

  /**
   * Show current config
   */
  private showConfig(): CommandResult {
    const config = this.playground.getConfig();

    if (this.jsonOutput) {
      return { success: true, data: config };
    }

    const output = `
${chalk.cyan.bold('Current Configuration:')}

  Model:       ${chalk.yellow(config.model)}
  Temperature: ${chalk.yellow(config.temperature)}
  Max Tokens:  ${chalk.yellow(config.maxTokens)}
  System:      ${config.systemPrompt ? chalk.gray(config.systemPrompt.slice(0, 50) + (config.systemPrompt.length > 50 ? '...' : '')) : chalk.gray('(none)')}
`;

    return { success: true, message: output };
  }

  /**
   * Show session stats
   */
  private showStats(): CommandResult {
    const stats = this.playground.getStats();

    if (this.jsonOutput) {
      return { success: true, data: stats };
    }

    const output = `
${chalk.cyan.bold('Session Statistics:')}

  Messages:          ${chalk.yellow(stats.messageCount)}
  User Tokens:       ${chalk.yellow(stats.totalUserTokens)}
  Assistant Tokens:  ${chalk.yellow(stats.totalAssistantTokens)}
  Avg Latency:       ${chalk.yellow(stats.averageLatencyMs + 'ms')}
`;

    return { success: true, message: output };
  }

  /**
   * List saved sessions
   */
  private listSessions(): CommandResult {
    const sessions = this.playground.listSessions();

    if (sessions.length === 0) {
      if (this.jsonOutput) {
        return { success: true, data: { sessions: [] } };
      }
      return { success: true, message: chalk.gray('No saved sessions') };
    }

    if (this.jsonOutput) {
      return { success: true, data: { sessions } };
    }

    let output = chalk.cyan.bold('\nSaved Sessions:\n\n');
    for (const session of sessions) {
      output += `  ${chalk.yellow(session.id)}\n`;
      output += `    Created: ${session.createdAt.toLocaleString()}\n`;
      output += `    Messages: ${session.messageCount}\n\n`;
    }

    return { success: true, message: output };
  }
}

export default CommandHandler;
