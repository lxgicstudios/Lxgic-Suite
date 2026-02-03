// Type declaration for optional openai peer dependency
declare module 'openai' {
  export interface ChatCompletionMessageParam {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  export interface ChatCompletionCreateParams {
    model: string;
    messages: ChatCompletionMessageParam[];
    max_tokens?: number;
    temperature?: number;
  }

  export interface ChatCompletion {
    choices: Array<{
      message?: {
        content?: string;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  }

  export interface ChatCompletions {
    create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
  }

  export interface Chat {
    completions: ChatCompletions;
  }

  export default class OpenAI {
    chat: Chat;
    constructor(options?: { apiKey?: string });
  }
}
