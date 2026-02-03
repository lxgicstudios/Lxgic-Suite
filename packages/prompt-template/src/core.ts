import Anthropic from '@anthropic-ai/sdk';
import Conf from 'conf';
import Mustache from 'mustache';
import {
  Template,
  TemplateSchema,
  Variable,
  extractVariables,
  validateVariables,
  generateTemplateId,
  findCommonPatterns,
} from './parser.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration store for templates
 */
const config = new Conf<{ templates: Record<string, Template> }>({
  projectName: 'prompt-template',
  defaults: {
    templates: {},
  },
});

/**
 * Result of template creation
 */
export interface CreateTemplateResult {
  success: boolean;
  template?: Template;
  error?: string;
}

/**
 * Result of template application
 */
export interface ApplyTemplateResult {
  success: boolean;
  result?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Read example prompts from a directory
 */
export async function readExamplesFromDirectory(dirPath: string): Promise<string[]> {
  const examples: string[] = [];
  const resolvedPath = path.resolve(dirPath);

  try {
    const files = await fs.readdir(resolvedPath);
    const txtFiles = files.filter(f => f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.prompt'));

    for (const file of txtFiles) {
      const content = await fs.readFile(path.join(resolvedPath, file), 'utf-8');
      examples.push(content.trim());
    }

    return examples;
  } catch (error) {
    throw new Error(`Failed to read examples from directory: ${dirPath}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Use Claude to analyze examples and generate a template
 */
export async function analyzeExamplesWithAI(
  examples: string[],
  name?: string
): Promise<{ template: string; variables: Variable[]; description: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback to pattern-based analysis without AI
    return analyzeExamplesLocally(examples, name);
  }

  const client = new Anthropic({ apiKey });

  const prompt = `Analyze the following example prompts and create a reusable template.

EXAMPLES:
${examples.map((e, i) => `--- Example ${i + 1} ---\n${e}\n`).join('\n')}

Your task:
1. Identify the common structure and patterns across all examples
2. Identify parts that vary between examples - these should become template variables
3. Create a template using {{variable_name}} syntax for variable parts
4. Give each variable a descriptive name (snake_case)

Respond in JSON format:
{
  "template": "The template string with {{variables}}",
  "variables": [
    {"name": "variable_name", "description": "What this variable represents", "required": true}
  ],
  "description": "Brief description of what this template is for"
}

Only respond with valid JSON, no other text.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from API');
    }

    const result = JSON.parse(content.text);

    return {
      template: result.template,
      variables: result.variables.map((v: Partial<Variable>) => ({
        name: v.name || 'variable',
        description: v.description,
        required: v.required ?? true,
        defaultValue: v.defaultValue,
      })),
      description: result.description || `Template generated from ${examples.length} examples`,
    };
  } catch (error) {
    // Fallback to local analysis if API fails
    console.warn('AI analysis failed, using local pattern matching');
    return analyzeExamplesLocally(examples, name);
  }
}

/**
 * Analyze examples locally without AI
 */
function analyzeExamplesLocally(
  examples: string[],
  name?: string
): { template: string; variables: Variable[]; description: string } {
  const { commonParts, variableParts } = findCommonPatterns(examples);

  const template = commonParts.join('');
  const variables: Variable[] = [];

  variableParts.forEach((_, index) => {
    variables.push({
      name: `var_${index + 1}`,
      description: `Variable part ${index + 1}`,
      required: true,
    });
  });

  return {
    template,
    variables,
    description: name
      ? `Template: ${name}`
      : `Template generated from ${examples.length} examples`,
  };
}

/**
 * Create a new template from examples
 */
export async function createTemplate(
  examplesDir: string,
  options: { name?: string; useAI?: boolean } = {}
): Promise<CreateTemplateResult> {
  try {
    const examples = await readExamplesFromDirectory(examplesDir);

    if (examples.length === 0) {
      return {
        success: false,
        error: 'No example files found in directory. Supported formats: .txt, .md, .prompt',
      };
    }

    const { template, variables, description } = options.useAI !== false
      ? await analyzeExamplesWithAI(examples, options.name)
      : analyzeExamplesLocally(examples, options.name);

    const templateName = options.name || `template-${Date.now()}`;
    const templateId = generateTemplateId(templateName);
    const now = new Date().toISOString();

    const newTemplate: Template = {
      id: templateId,
      name: templateName,
      description,
      template,
      variables,
      createdAt: now,
      updatedAt: now,
      examples,
    };

    // Validate template schema
    const validated = TemplateSchema.parse(newTemplate);

    // Save to config store
    const templates = config.get('templates');
    templates[templateId] = validated;
    config.set('templates', templates);

    return {
      success: true,
      template: validated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply a template with given variables
 */
export async function applyTemplate(
  templateIdOrName: string,
  vars: Record<string, string>
): Promise<ApplyTemplateResult> {
  try {
    const template = getTemplateByIdOrName(templateIdOrName);

    if (!template) {
      return {
        success: false,
        error: `Template not found: ${templateIdOrName}`,
      };
    }

    // Validate variables
    const validation = validateVariables(template, vars);
    const warnings: string[] = [];

    if (!validation.valid) {
      return {
        success: false,
        error: `Missing required variables: ${validation.missing.join(', ')}`,
      };
    }

    if (validation.extra.length > 0) {
      warnings.push(`Extra variables provided (ignored): ${validation.extra.join(', ')}`);
    }

    // Apply default values for missing optional variables
    const finalVars = { ...vars };
    for (const variable of template.variables) {
      if (!finalVars[variable.name] && variable.defaultValue) {
        finalVars[variable.name] = variable.defaultValue;
      }
    }

    // Render template with Mustache
    const result = Mustache.render(template.template, finalVars);

    return {
      success: true,
      result,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get a template by ID or name
 */
export function getTemplateByIdOrName(idOrName: string): Template | null {
  const templates = config.get('templates');

  // Try by ID first
  if (templates[idOrName]) {
    return templates[idOrName];
  }

  // Try by name
  const byName = Object.values(templates).find(
    t => t.name.toLowerCase() === idOrName.toLowerCase()
  );

  return byName || null;
}

/**
 * List all saved templates
 */
export function listTemplates(): Template[] {
  const templates = config.get('templates');
  return Object.values(templates).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Delete a template by ID or name
 */
export function deleteTemplate(idOrName: string): boolean {
  const templates = config.get('templates');
  const template = getTemplateByIdOrName(idOrName);

  if (!template) {
    return false;
  }

  delete templates[template.id];
  config.set('templates', templates);
  return true;
}

/**
 * Export a template to a file
 */
export async function exportTemplate(
  idOrName: string,
  outputPath: string
): Promise<{ success: boolean; error?: string }> {
  const template = getTemplateByIdOrName(idOrName);

  if (!template) {
    return { success: false, error: `Template not found: ${idOrName}` };
  }

  try {
    await fs.writeFile(outputPath, JSON.stringify(template, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Import a template from a file
 */
export async function importTemplate(
  filePath: string
): Promise<CreateTemplateResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const template = TemplateSchema.parse(parsed);

    // Generate new ID to avoid conflicts
    template.id = generateTemplateId(template.name);
    template.updatedAt = new Date().toISOString();

    const templates = config.get('templates');
    templates[template.id] = template;
    config.set('templates', templates);

    return { success: true, template };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get variables from a template
 */
export function getTemplateVariables(idOrName: string): Variable[] | null {
  const template = getTemplateByIdOrName(idOrName);
  return template ? template.variables : null;
}

/**
 * Preview a template with placeholder values
 */
export function previewTemplate(idOrName: string): string | null {
  const template = getTemplateByIdOrName(idOrName);

  if (!template) {
    return null;
  }

  const placeholders: Record<string, string> = {};
  for (const variable of template.variables) {
    placeholders[variable.name] = `<${variable.name}>`;
  }

  return Mustache.render(template.template, placeholders);
}
