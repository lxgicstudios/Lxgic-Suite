import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface SlackConfig {
  token?: string;
  signingSecret?: string;
  appToken?: string;
  port?: number;
  channels?: ChannelConfig[];
  commands?: CommandConfig[];
  prompts?: PromptConfig[];
}

export interface ChannelConfig {
  id: string;
  name?: string;
  enabled?: boolean;
  allowedUsers?: string[];
  defaultPrompt?: string;
}

export interface CommandConfig {
  name: string;
  description: string;
  prompt?: string;
  handler?: string;
}

export interface PromptConfig {
  name: string;
  template: string;
  description?: string;
  model?: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface SlackMessage {
  text: string;
  channel: string;
  user: string;
  ts: string;
  threadTs?: string;
}

export interface SlackCommand {
  command: string;
  text: string;
  userId: string;
  channelId: string;
  responseUrl: string;
}

export interface SlackResponse {
  text: string;
  blocks?: SlackBlock[];
  responseType?: 'in_channel' | 'ephemeral';
  threadTs?: string;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
}

const CONFIG_FILE = '.ai-slack.json';

export function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE);
}

export function loadConfig(): SlackConfig {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  return {};
}

export function saveConfig(config: SlackConfig): void {
  const configPath = getConfigPath();
  // Don't save sensitive tokens to file
  const safeConfig = { ...config };
  delete safeConfig.token;
  delete safeConfig.signingSecret;
  delete safeConfig.appToken;
  fs.writeFileSync(configPath, JSON.stringify(safeConfig, null, 2));
}

export function loadPrompts(promptsDir?: string): PromptConfig[] {
  const dir = promptsDir || path.join(process.cwd(), 'prompts');
  if (!fs.existsSync(dir)) {
    return [];
  }

  const prompts: PromptConfig[] = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (file.endsWith('.prompt') || file.endsWith('.yaml') || file.endsWith('.yml')) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const parsed = parsePromptFile(content, file);
        if (parsed) {
          prompts.push(parsed);
        }
      } catch {
        // Skip invalid files
      }
    }
  }

  return prompts;
}

function parsePromptFile(content: string, filename: string): PromptConfig | null {
  const basename = filename.replace(/\.(prompt|yaml|yml)$/, '');

  // Try YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (frontmatterMatch) {
    const meta = yaml.load(frontmatterMatch[1]) as any;
    return {
      name: meta.name || basename,
      template: frontmatterMatch[2].trim(),
      description: meta.description,
      model: meta.model,
      parameters: meta.parameters
    };
  }

  // Try pure YAML
  try {
    const parsed = yaml.load(content) as any;
    if (parsed && parsed.template) {
      return {
        name: parsed.name || basename,
        template: parsed.template,
        description: parsed.description,
        model: parsed.model,
        parameters: parsed.parameters
      };
    }
  } catch {
    // Not YAML
  }

  // Plain text template
  return {
    name: basename,
    template: content.trim()
  };
}

export function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(placeholder, String(value));
  }
  return result;
}

export function formatForSlack(text: string): string {
  // Convert markdown to Slack mrkdwn
  let result = text;

  // Bold: **text** -> *text*
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // Italic: _text_ stays the same

  // Code blocks: ```code``` stays the same

  // Inline code: `code` stays the same

  // Links: [text](url) -> <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  return result;
}

export function createMarkdownBlock(text: string): SlackBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: formatForSlack(text)
    }
  };
}

export function createHeaderBlock(text: string): SlackBlock {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text,
      emoji: true
    }
  };
}

export function createDividerBlock(): SlackBlock {
  return { type: 'divider' };
}

export function createContextBlock(text: string): SlackBlock {
  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text
      }
    ]
  };
}

export function buildSlackResponse(
  text: string,
  options: {
    blocks?: SlackBlock[];
    ephemeral?: boolean;
    threadTs?: string;
  } = {}
): SlackResponse {
  return {
    text,
    blocks: options.blocks,
    responseType: options.ephemeral ? 'ephemeral' : 'in_channel',
    threadTs: options.threadTs
  };
}

export function parseSlackCommand(text: string): { command: string; args: string[] } {
  const parts = text.trim().split(/\s+/);
  const command = parts[0] || '';
  const args = parts.slice(1);
  return { command, args };
}

export function validateSlackConfig(config: SlackConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.token) {
    errors.push('Missing SLACK_BOT_TOKEN');
  }

  if (!config.signingSecret) {
    errors.push('Missing SLACK_SIGNING_SECRET');
  }

  // App token is optional (only needed for socket mode)

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getEnvConfig(): Partial<SlackConfig> {
  return {
    token: process.env.SLACK_BOT_TOKEN || process.env.SLACK_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN
  };
}
