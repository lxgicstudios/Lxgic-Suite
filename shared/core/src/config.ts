import Conf from 'conf';
import { z } from 'zod';

export interface ConfigOptions {
  projectName: string;
  schema?: z.ZodObject<any>;
}

export function createConfig<T extends Record<string, any>>(options: ConfigOptions): Conf<T> {
  return new Conf<T>({
    projectName: options.projectName,
    projectSuffix: '',
  });
}

export function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required.\n' +
      'Set it with: export ANTHROPIC_API_KEY=your-api-key'
    );
  }
  return key;
}

export function ensureApiKey(): void {
  getApiKey();
}
