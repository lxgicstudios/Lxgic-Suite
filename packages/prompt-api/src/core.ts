import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

export interface PromptDefinition {
  name: string;
  description?: string;
  version?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  input?: PromptInputSchema;
  output?: PromptOutputSchema;
  template: string;
  model?: string;
  parameters?: ModelParameters;
  metadata?: Record<string, any>;
}

export interface PromptInputSchema {
  type: 'object';
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

export interface PromptOutputSchema {
  type: 'object' | 'string' | 'array';
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any;
  enum?: any[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
}

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface APIEndpoint {
  path: string;
  method: string;
  promptName: string;
  prompt: PromptDefinition;
  handler: EndpointHandler;
}

export type EndpointHandler = (input: any) => Promise<any>;

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
  };
}

export interface GeneratedAPI {
  endpoints: APIEndpoint[];
  openapi: OpenAPISpec;
  prompts: PromptDefinition[];
}

const CONFIG_FILE = '.prompt-api.json';

export interface APIConfig {
  promptsDir?: string;
  outputDir?: string;
  port?: number;
  title?: string;
  version?: string;
}

export function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE);
}

export function loadConfig(): APIConfig {
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

export function saveConfig(config: APIConfig): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export async function scanPromptFiles(dir: string): Promise<string[]> {
  const absoluteDir = path.resolve(process.cwd(), dir);

  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Directory not found: ${absoluteDir}`);
  }

  const patterns = [
    path.join(absoluteDir, '**/*.prompt'),
    path.join(absoluteDir, '**/*.prompt.yaml'),
    path.join(absoluteDir, '**/*.prompt.yml'),
    path.join(absoluteDir, '**/*.prompt.json')
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern.replace(/\\/g, '/'));
    files.push(...matches);
  }

  return [...new Set(files)];
}

export function parsePromptFile(filePath: string): PromptDefinition {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);
  const basename = path.basename(filePath).replace(/\.prompt(\.yaml|\.yml|\.json)?$/, '');

  let parsed: Partial<PromptDefinition>;

  if (ext === '.json') {
    parsed = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    parsed = yaml.load(content) as Partial<PromptDefinition>;
  } else if (ext === '.prompt') {
    // Plain .prompt files: YAML frontmatter + template
    parsed = parsePromptWithFrontmatter(content);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  // Set defaults
  const prompt: PromptDefinition = {
    name: parsed.name || basename,
    description: parsed.description,
    version: parsed.version || '1.0.0',
    endpoint: parsed.endpoint || `/${toKebabCase(parsed.name || basename)}`,
    method: parsed.method || 'POST',
    input: parsed.input,
    output: parsed.output,
    template: parsed.template || '',
    model: parsed.model,
    parameters: parsed.parameters,
    metadata: parsed.metadata
  };

  return prompt;
}

function parsePromptWithFrontmatter(content: string): Partial<PromptDefinition> {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatter = yaml.load(match[1]) as Partial<PromptDefinition>;
    const template = match[2].trim();
    return { ...frontmatter, template };
  }

  // No frontmatter, treat entire content as template
  return { template: content.trim() };
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function validateInput(input: any, schema?: PromptInputSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!schema) {
    return { valid: true, errors: [] };
  }

  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in input)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in input) {
        const value = input[key];
        const typeError = validateType(value, prop.type);
        if (typeError) {
          errors.push(`Field '${key}': ${typeError}`);
        }

        if (prop.enum && !prop.enum.includes(value)) {
          errors.push(`Field '${key}': must be one of ${prop.enum.join(', ')}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateType(value: any, expectedType: string): string | null {
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (expectedType === 'array' && !Array.isArray(value)) {
    return `expected array, got ${actualType}`;
  }

  if (expectedType !== 'array' && actualType !== expectedType) {
    return `expected ${expectedType}, got ${actualType}`;
  }

  return null;
}

export function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(placeholder, String(value));
  }

  return result;
}

export function generateEndpointPath(prompt: PromptDefinition): string {
  return prompt.endpoint || `/${toKebabCase(prompt.name)}`;
}
