import * as fs from 'fs';
import Conf from 'conf';
import { z } from 'zod';
import {
  SchemaValidator,
  ValidationResult,
  BatchValidationResult,
  JSONSchema,
  formatValidationResult,
  formatBatchResult
} from './validator';

const ConfigSchema = z.object({
  strictMode: z.boolean().default(true),
  allowAdditionalProperties: z.boolean().default(false),
  defaultSchemaPath: z.string().optional()
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ValidateOptions {
  output: string;
  schema: string;
  json?: boolean;
}

export interface GenerateSchemaOptions {
  sample: string;
  output?: string;
  json?: boolean;
}

export interface BatchOptions {
  dir: string;
  schema: string;
  json?: boolean;
}

export class PromptValidateCore {
  private config: Conf<Config>;
  private validator: SchemaValidator;
  private lastResult: ValidationResult | BatchValidationResult | null = null;

  constructor() {
    this.config = new Conf<Config>({
      projectName: 'prompt-validate',
      defaults: {
        strictMode: true,
        allowAdditionalProperties: false
      }
    });
    this.validator = new SchemaValidator();
  }

  getConfig(): Config {
    return this.config.store;
  }

  setConfig(key: keyof Config, value: any): void {
    this.config.set(key, value);
  }

  async validate(options: ValidateOptions): Promise<ValidationResult> {
    let result: ValidationResult;

    if (fs.existsSync(options.output)) {
      result = this.validator.validateFile(options.output, options.schema);
    } else {
      // Treat as JSON string
      try {
        const data = this.validator.parseJSON(options.output);
        const schema = this.validator.loadSchema(options.schema);
        result = this.validator.validate(data, schema);
        result.schemaPath = options.schema;
      } catch (error) {
        result = {
          valid: false,
          errors: [{
            path: '/',
            message: `Parse error: ${(error as Error).message}`,
            keyword: 'parse'
          }],
          schemaPath: options.schema,
          timestamp: new Date().toISOString()
        };
      }
    }

    this.lastResult = result;
    return result;
  }

  async generateSchema(options: GenerateSchemaOptions): Promise<JSONSchema> {
    let schema: JSONSchema;

    if (fs.existsSync(options.sample)) {
      schema = this.validator.generateSchemaFromFile(options.sample);
    } else {
      // Treat as JSON string
      const data = this.validator.parseJSON(options.sample);
      schema = this.validator.generateSchema(data);
    }

    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(schema, null, 2));
    }

    return schema;
  }

  async batch(options: BatchOptions): Promise<BatchValidationResult> {
    const result = this.validator.validateBatch(options.dir, options.schema);
    this.lastResult = result;
    return result;
  }

  getLastResult(): ValidationResult | BatchValidationResult | null {
    return this.lastResult;
  }

  formatOutput(data: any, json: boolean): string {
    if (json) {
      return JSON.stringify(data, null, 2);
    }

    if ('totalFiles' in data) {
      return formatBatchResult(data);
    }

    if ('valid' in data) {
      return formatValidationResult(data);
    }

    // Schema output
    return JSON.stringify(data, null, 2);
  }
}

export const core = new PromptValidateCore();
