import {
  SlackMessage,
  SlackCommand,
  SlackResponse,
  PromptConfig,
  renderTemplate,
  createMarkdownBlock,
  createHeaderBlock,
  createContextBlock,
  createDividerBlock,
  buildSlackResponse,
  parseSlackCommand
} from './core';

export interface HandlerContext {
  prompts: Map<string, PromptConfig>;
  config: any;
}

export type MessageHandler = (
  message: SlackMessage,
  context: HandlerContext
) => Promise<SlackResponse | null>;

export type CommandHandler = (
  command: SlackCommand,
  context: HandlerContext
) => Promise<SlackResponse>;

// Default message handler
export const defaultMessageHandler: MessageHandler = async (message, context) => {
  const text = message.text.toLowerCase();

  // Check for direct prompts
  for (const [name, prompt] of context.prompts) {
    if (text.startsWith(name.toLowerCase())) {
      const input = message.text.slice(name.length).trim();
      const rendered = renderTemplate(prompt.template, { input, text: input, query: input });

      return buildSlackResponse(rendered, {
        blocks: [
          createMarkdownBlock(rendered),
          createContextBlock(`_Prompt: ${name}_`)
        ]
      });
    }
  }

  return null;
};

// /ask command handler
export const askCommandHandler: CommandHandler = async (command, context) => {
  const { text } = command;

  if (!text || text.trim() === '') {
    return buildSlackResponse(
      'Please provide a question or prompt.',
      { ephemeral: true }
    );
  }

  // Use default prompt if available
  const defaultPrompt = context.prompts.get('default') || context.prompts.get('ask');

  if (defaultPrompt) {
    const rendered = renderTemplate(defaultPrompt.template, {
      input: text,
      text,
      query: text,
      question: text
    });

    return buildSlackResponse(rendered, {
      blocks: [
        createMarkdownBlock(rendered)
      ]
    });
  }

  // No prompt configured, just echo
  return buildSlackResponse(`Processing: ${text}`, {
    blocks: [
      createHeaderBlock('AI Response'),
      createMarkdownBlock(`Your question: *${text}*`),
      createDividerBlock(),
      createContextBlock('_Configure prompts to customize responses_')
    ]
  });
};

// /prompt command handler
export const promptCommandHandler: CommandHandler = async (command, context) => {
  const { command: subCommand, args } = parseSlackCommand(command.text);

  switch (subCommand.toLowerCase()) {
    case 'list':
    case '': {
      const promptList = Array.from(context.prompts.values());
      if (promptList.length === 0) {
        return buildSlackResponse('No prompts configured.', { ephemeral: true });
      }

      const blocks = [
        createHeaderBlock('Available Prompts'),
        createDividerBlock()
      ];

      for (const prompt of promptList) {
        blocks.push(createMarkdownBlock(
          `*${prompt.name}*\n${prompt.description || '_No description_'}`
        ));
      }

      return buildSlackResponse('Available prompts:', { blocks, ephemeral: true });
    }

    case 'use': {
      const promptName = args[0];
      const input = args.slice(1).join(' ');

      if (!promptName) {
        return buildSlackResponse('Usage: /prompt use <prompt-name> <input>', { ephemeral: true });
      }

      const prompt = context.prompts.get(promptName);
      if (!prompt) {
        return buildSlackResponse(`Prompt not found: ${promptName}`, { ephemeral: true });
      }

      if (!input) {
        return buildSlackResponse(`Usage: /prompt use ${promptName} <your input>`, { ephemeral: true });
      }

      const rendered = renderTemplate(prompt.template, {
        input,
        text: input,
        query: input
      });

      return buildSlackResponse(rendered, {
        blocks: [
          createMarkdownBlock(rendered),
          createContextBlock(`_Using prompt: ${promptName}_`)
        ]
      });
    }

    case 'info': {
      const promptName = args[0];
      if (!promptName) {
        return buildSlackResponse('Usage: /prompt info <prompt-name>', { ephemeral: true });
      }

      const prompt = context.prompts.get(promptName);
      if (!prompt) {
        return buildSlackResponse(`Prompt not found: ${promptName}`, { ephemeral: true });
      }

      return buildSlackResponse(`Prompt: ${promptName}`, {
        blocks: [
          createHeaderBlock(prompt.name),
          createMarkdownBlock(prompt.description || '_No description_'),
          createDividerBlock(),
          createMarkdownBlock(`*Model:* ${prompt.model || 'default'}`),
          createMarkdownBlock(`*Template:*\n\`\`\`${prompt.template.slice(0, 500)}${prompt.template.length > 500 ? '...' : ''}\`\`\``)
        ],
        ephemeral: true
      });
    }

    case 'help':
    default:
      return buildSlackResponse('Prompt commands:', {
        blocks: [
          createHeaderBlock('Prompt Commands'),
          createMarkdownBlock(
            '`/prompt list` - List available prompts\n' +
            '`/prompt use <name> <input>` - Use a specific prompt\n' +
            '`/prompt info <name>` - Show prompt details\n' +
            '`/prompt help` - Show this help'
          )
        ],
        ephemeral: true
      });
  }
};

// /help command handler
export const helpCommandHandler: CommandHandler = async (command, context) => {
  const promptCount = context.prompts.size;

  return buildSlackResponse('AI Slack Bot Help', {
    blocks: [
      createHeaderBlock('AI Slack Bot'),
      createMarkdownBlock(
        'I can help you with AI-powered prompts!\n\n' +
        '*Available Commands:*\n' +
        '`/ask <question>` - Ask a question\n' +
        '`/prompt list` - List available prompts\n' +
        '`/prompt use <name> <input>` - Use a specific prompt\n' +
        '`/help` - Show this help message'
      ),
      createDividerBlock(),
      createContextBlock(`${promptCount} prompt${promptCount === 1 ? '' : 's'} configured`)
    ],
    ephemeral: true
  });
};

// Create handler registry
export function createHandlerRegistry(context: HandlerContext): {
  commands: Map<string, CommandHandler>;
  messageHandler: MessageHandler;
} {
  const commands = new Map<string, CommandHandler>();

  commands.set('/ask', askCommandHandler);
  commands.set('/prompt', promptCommandHandler);
  commands.set('/help', helpCommandHandler);

  return {
    commands,
    messageHandler: defaultMessageHandler
  };
}

// Error response helper
export function createErrorResponse(error: string): SlackResponse {
  return buildSlackResponse(`Error: ${error}`, {
    blocks: [
      createMarkdownBlock(`:warning: *Error*\n${error}`)
    ],
    ephemeral: true
  });
}

// Loading response helper
export function createLoadingResponse(): SlackResponse {
  return buildSlackResponse('Processing...', {
    blocks: [
      createMarkdownBlock(':hourglass_flowing_sand: Processing your request...')
    ],
    ephemeral: true
  });
}
