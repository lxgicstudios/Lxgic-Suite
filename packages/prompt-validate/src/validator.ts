import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { z } from 'zod';

export const ValidationErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
  keyword: z.string(),
  params: z.record(z.any()).optional()
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  data: z.any().optional(),
  errors: z.array(ValidationErrorSchema),
  schemaPath: z.string().optional(),
  outputPath: z.string().optional(),
  timestamp: z.string()
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const BatchValidationResultSchema = z.object({
  totalFiles: z.number(),
  validFiles: z.number(),
  invalidFiles: z.number(),
  results: z.array(ValidationResultSchema),
  timestamp: z.string()
});

export type BatchValidationResult = z.infer<typeof BatchValidationResultSchema>;

export interface JSONSchema {
  $schema?: string;
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  additionalProperties?: boolean;
  [key: string]: any;
}

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });
    addFormats(this.ajv);
  }

  loadSchema(schemaPath: string): JSONSchema {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const content = fs.readFileSync(schemaPath, 'utf-8');
    return JSON.parse(content);
  }

  loadOutput(outputPath: string): any {
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output file not found: ${outputPath}`);
    }

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // Try to parse directly
    return JSON.parse(content);
  }

  parseJSON(text: string): any {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // Try to find JSON object or array
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const arrayMatch = text.match(/\[[\s\S]*\]/);

    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue to try array
      }
    }

    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // Continue to direct parse
      }
    }

    // Try to parse directly
    return JSON.parse(text);
  }

  validate(data: any, schema: JSONSchema): ValidationResult {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    const errors: ValidationError[] = [];

    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push({
          path: error.instancePath || '/',
          message: error.message || 'Unknown error',
          keyword: error.keyword,
          params: error.params
        });
      }
    }

    return {
      valid: !!valid,
      data: valid ? data : undefined,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  validateFile(outputPath: string, schemaPath: string): ValidationResult {
    const schema = this.loadSchema(schemaPath);
    const data = this.loadOutput(outputPath);

    const result = this.validate(data, schema);
    result.schemaPath = schemaPath;
    result.outputPath = outputPath;

    return result;
  }

  validateBatch(dirPath: string, schemaPath: string): BatchValidationResult {
    const schema = this.loadSchema(schemaPath);
    const results: ValidationResult[] = [];

    const processDir = (dir: string): void => {
      if (!fs.existsSync(dir)) {
        throw new Error(`Directory not found: ${dir}`);
      }

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          processDir(fullPath);
        } else if (/\.json$/i.test(file)) {
          try {
            const data = this.loadOutput(fullPath);
            const result = this.validate(data, schema);
            result.outputPath = fullPath;
            result.schemaPath = schemaPath;
            results.push(result);
          } catch (error) {
            results.push({
              valid: false,
              errors: [{
                path: '/',
                message: `Parse error: ${(error as Error).message}`,
                keyword: 'parse'
              }],
              outputPath: fullPath,
              schemaPath,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    };

    processDir(dirPath);

    const validCount = results.filter(r => r.valid).length;

    return {
      totalFiles: results.length,
      validFiles: validCount,
      invalidFiles: results.length - validCount,
      results,
      timestamp: new Date().toISOString()
    };
  }

  generateSchema(sample: any, name?: string): JSONSchema {
    const schema: JSONSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: name || 'Generated Schema'
    };

    const inferType = (value: any): any => {
      if (value === null) {
        return { type: 'null' };
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return { type: 'array', items: {} };
        }

        // Infer from first item
        const itemSchema = inferType(value[0]);
        return { type: 'array', items: itemSchema };
      }

      if (typeof value === 'object') {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, val] of Object.entries(value)) {
          properties[key] = inferType(val);
          if (val !== null && val !== undefined) {
            required.push(key);
          }
        }

        return {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
          additionalProperties: false
        };
      }

      if (typeof value === 'string') {
        // Check for common formats
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return { type: 'string', format: 'date-time' };
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return { type: 'string', format: 'date' };
        }
        if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          return { type: 'string', format: 'email' };
        }
        if (/^https?:\/\//.test(value)) {
          return { type: 'string', format: 'uri' };
        }
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          return { type: 'string', format: 'uuid' };
        }
        return { type: 'string' };
      }

      if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          return { type: 'integer' };
        }
        return { type: 'number' };
      }

      if (typeof value === 'boolean') {
        return { type: 'boolean' };
      }

      return {};
    };

    const inferred = inferType(sample);
    return { ...schema, ...inferred };
  }

  generateSchemaFromFile(samplePath: string): JSONSchema {
    const sample = this.loadOutput(samplePath);
    const name = path.basename(samplePath, path.extname(samplePath));
    return this.generateSchema(sample, name);
  }
}

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  VALIDATION RESULT');
  lines.push('='.repeat(60));
  lines.push('');

  if (result.outputPath) {
    lines.push(`  Output: ${result.outputPath}`);
  }
  if (result.schemaPath) {
    lines.push(`  Schema: ${result.schemaPath}`);
  }
  lines.push(`  Generated: ${result.timestamp}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(`  Status: ${result.valid ? 'VALID' : 'INVALID'}`);
  lines.push('-'.repeat(60));

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('  Errors:');
    for (const error of result.errors) {
      lines.push(`    - Path: ${error.path}`);
      lines.push(`      Message: ${error.message}`);
      lines.push(`      Keyword: ${error.keyword}`);
      if (error.params) {
        lines.push(`      Params: ${JSON.stringify(error.params)}`);
      }
      lines.push('');
    }
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

export function formatBatchResult(result: BatchValidationResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  BATCH VALIDATION RESULT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`  Generated: ${result.timestamp}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  SUMMARY');
  lines.push('-'.repeat(60));
  lines.push(`  Total Files:   ${result.totalFiles}`);
  lines.push(`  Valid Files:   ${result.validFiles}`);
  lines.push(`  Invalid Files: ${result.invalidFiles}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  FILES');
  lines.push('-'.repeat(60));

  for (const r of result.results) {
    const status = r.valid ? '[VALID]' : '[INVALID]';
    const errorCount = r.errors.length > 0 ? ` (${r.errors.length} errors)` : '';
    lines.push(`  ${status} ${r.outputPath}${errorCount}`);

    if (!r.valid && r.errors.length > 0) {
      for (const error of r.errors.slice(0, 3)) {
        lines.push(`    - ${error.path}: ${error.message}`);
      }
      if (r.errors.length > 3) {
        lines.push(`    ... and ${r.errors.length - 3} more errors`);
      }
    }
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
