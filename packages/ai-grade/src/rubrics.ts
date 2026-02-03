import { z } from 'zod';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Zod schemas for rubric validation
export const CriterionSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  scale: z.array(z.number()).min(2),
  description: z.string().min(1),
  examples: z.record(z.number(), z.string()).optional(),
});

export const RubricSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional().default('1.0'),
  description: z.string().optional(),
  criteria: z.array(CriterionSchema).min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type Criterion = z.infer<typeof CriterionSchema>;
export type Rubric = z.infer<typeof RubricSchema>;

export interface GradeResult {
  criterion: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  rationale: string;
}

export interface GradingReport {
  rubricName: string;
  outputFile: string;
  timestamp: string;
  grades: GradeResult[];
  totalScore: number;
  maxPossibleScore: number;
  percentageScore: number;
  graderModel: string;
  graderCount?: number;
  interRaterReliability?: number;
}

export function loadRubric(filePath: string): Rubric {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Rubric file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content);

  const result = RubricSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid rubric format:\n${errors}`);
  }

  // Validate weights sum to 1 (or close to it)
  const totalWeight = result.data.criteria.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.01) {
    throw new Error(`Criterion weights must sum to 1.0, got ${totalWeight.toFixed(2)}`);
  }

  return result.data;
}

export function saveRubric(rubric: Rubric, filePath: string): void {
  const content = yaml.dump(rubric, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function createDefaultRubric(): Rubric {
  return {
    name: 'default-rubric',
    version: '1.0',
    description: 'A default grading rubric',
    criteria: [
      {
        name: 'accuracy',
        weight: 0.4,
        scale: [1, 2, 3, 4, 5],
        description: 'How accurate is the response? Does it contain factual errors?',
        examples: {
          1: 'Many factual errors, mostly incorrect',
          3: 'Some minor errors, mostly correct',
          5: 'Completely accurate, no errors',
        },
      },
      {
        name: 'clarity',
        weight: 0.3,
        scale: [1, 2, 3, 4, 5],
        description: 'How clear and readable is the response?',
        examples: {
          1: 'Confusing, hard to understand',
          3: 'Understandable but could be clearer',
          5: 'Crystal clear, well-organized',
        },
      },
      {
        name: 'completeness',
        weight: 0.3,
        scale: [1, 2, 3, 4, 5],
        description: 'Does the response fully address the prompt?',
        examples: {
          1: 'Misses most key points',
          3: 'Addresses main points but misses some details',
          5: 'Thoroughly addresses all aspects',
        },
      },
    ],
  };
}

export function validateRubric(rubric: unknown): { valid: boolean; errors: string[] } {
  const result = RubricSchema.safeParse(rubric);
  if (result.success) {
    const totalWeight = result.data.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      return {
        valid: false,
        errors: [`Criterion weights must sum to 1.0, got ${totalWeight.toFixed(2)}`],
      };
    }
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}
