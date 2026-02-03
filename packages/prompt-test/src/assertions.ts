import { z } from 'zod';
import Ajv, { type ErrorObject } from 'ajv';

/**
 * Assertion types supported by the test runner
 */
export type AssertionType =
  | 'contains'
  | 'not-contains'
  | 'matches'
  | 'not-matches'
  | 'json-schema'
  | 'length-min'
  | 'length-max'
  | 'length-equals'
  | 'starts-with'
  | 'ends-with'
  | 'equals'
  | 'not-equals'
  | 'is-json'
  | 'json-path'
  | 'word-count-min'
  | 'word-count-max';

/**
 * Schema for assertion definition
 */
export const AssertionSchema = z.object({
  type: z.enum([
    'contains',
    'not-contains',
    'matches',
    'not-matches',
    'json-schema',
    'length-min',
    'length-max',
    'length-equals',
    'starts-with',
    'ends-with',
    'equals',
    'not-equals',
    'is-json',
    'json-path',
    'word-count-min',
    'word-count-max',
  ]),
  expected: z.union([z.string(), z.number(), z.object({}).passthrough(), z.array(z.any())]).optional(),
  message: z.string().optional(),
  ignoreCase: z.boolean().optional(),
});

export type Assertion = z.infer<typeof AssertionSchema>;

/**
 * Result of an assertion check
 */
export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  message: string;
  actual?: string | number;
  expected?: unknown;
}

/**
 * JSON Schema validator instance
 */
const ajv = new Ajv.default({ allErrors: true, strict: false });

/**
 * Validate a single assertion against an output
 */
export function validateAssertion(output: string, assertion: Assertion): AssertionResult {
  const { type, expected, ignoreCase } = assertion;

  // Normalize output and expected for case-insensitive comparisons
  const normalizedOutput = ignoreCase ? output.toLowerCase() : output;
  const normalizedExpected = ignoreCase && typeof expected === 'string'
    ? expected.toLowerCase()
    : expected;

  switch (type) {
    case 'contains':
      return assertContains(normalizedOutput, normalizedExpected as string, assertion);

    case 'not-contains':
      return assertNotContains(normalizedOutput, normalizedExpected as string, assertion);

    case 'matches':
      return assertMatches(output, expected as string, assertion);

    case 'not-matches':
      return assertNotMatches(output, expected as string, assertion);

    case 'json-schema':
      return assertJsonSchema(output, expected as object, assertion);

    case 'length-min':
      return assertLengthMin(output, expected as number, assertion);

    case 'length-max':
      return assertLengthMax(output, expected as number, assertion);

    case 'length-equals':
      return assertLengthEquals(output, expected as number, assertion);

    case 'starts-with':
      return assertStartsWith(normalizedOutput, normalizedExpected as string, assertion);

    case 'ends-with':
      return assertEndsWith(normalizedOutput, normalizedExpected as string, assertion);

    case 'equals':
      return assertEquals(normalizedOutput, normalizedExpected as string, assertion);

    case 'not-equals':
      return assertNotEquals(normalizedOutput, normalizedExpected as string, assertion);

    case 'is-json':
      return assertIsJson(output, assertion);

    case 'json-path':
      return assertJsonPath(output, expected as { path: string; value: unknown }, assertion);

    case 'word-count-min':
      return assertWordCountMin(output, expected as number, assertion);

    case 'word-count-max':
      return assertWordCountMax(output, expected as number, assertion);

    default:
      return {
        assertion,
        passed: false,
        message: `Unknown assertion type: ${type}`,
      };
  }
}

/**
 * Validate multiple assertions against an output
 */
export function validateAssertions(output: string, assertions: Assertion[]): AssertionResult[] {
  return assertions.map(assertion => validateAssertion(output, assertion));
}

/**
 * Check if all assertions passed
 */
export function allAssertionsPassed(results: AssertionResult[]): boolean {
  return results.every(r => r.passed);
}

// Individual assertion implementations

function assertContains(output: string, expected: string, assertion: Assertion): AssertionResult {
  const passed = output.includes(expected);
  return {
    assertion,
    passed,
    message: passed
      ? `Output contains "${expected}"`
      : assertion.message || `Expected output to contain "${expected}"`,
    actual: output.length > 100 ? output.substring(0, 100) + '...' : output,
    expected,
  };
}

function assertNotContains(output: string, expected: string, assertion: Assertion): AssertionResult {
  const passed = !output.includes(expected);
  return {
    assertion,
    passed,
    message: passed
      ? `Output does not contain "${expected}"`
      : assertion.message || `Expected output to NOT contain "${expected}"`,
    actual: output.length > 100 ? output.substring(0, 100) + '...' : output,
    expected: `NOT "${expected}"`,
  };
}

function assertMatches(output: string, pattern: string, assertion: Assertion): AssertionResult {
  let passed = false;
  let errorMsg = '';

  try {
    const regex = new RegExp(pattern, assertion.ignoreCase ? 'i' : undefined);
    passed = regex.test(output);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Invalid regex';
  }

  return {
    assertion,
    passed,
    message: errorMsg
      ? `Invalid regex pattern: ${errorMsg}`
      : passed
        ? `Output matches pattern /${pattern}/`
        : assertion.message || `Expected output to match pattern /${pattern}/`,
    actual: output.length > 100 ? output.substring(0, 100) + '...' : output,
    expected: `/${pattern}/`,
  };
}

function assertNotMatches(output: string, pattern: string, assertion: Assertion): AssertionResult {
  let passed = false;
  let errorMsg = '';

  try {
    const regex = new RegExp(pattern, assertion.ignoreCase ? 'i' : undefined);
    passed = !regex.test(output);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Invalid regex';
  }

  return {
    assertion,
    passed,
    message: errorMsg
      ? `Invalid regex pattern: ${errorMsg}`
      : passed
        ? `Output does not match pattern /${pattern}/`
        : assertion.message || `Expected output to NOT match pattern /${pattern}/`,
    actual: output.length > 100 ? output.substring(0, 100) + '...' : output,
    expected: `NOT /${pattern}/`,
  };
}

function assertJsonSchema(output: string, schema: object, assertion: Assertion): AssertionResult {
  let parsed: unknown;
  let passed = false;
  let errorMsg = '';

  try {
    parsed = JSON.parse(output);
    const validate = ajv.compile(schema);
    passed = validate(parsed);
    if (!passed && validate.errors) {
      errorMsg = validate.errors.map(e => `${e.instancePath} ${e.message}`).join('; ');
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Invalid JSON';
  }

  return {
    assertion,
    passed,
    message: errorMsg
      ? `JSON schema validation failed: ${errorMsg}`
      : passed
        ? 'Output matches JSON schema'
        : assertion.message || 'Output does not match JSON schema',
    actual: output.length > 100 ? output.substring(0, 100) + '...' : output,
    expected: schema,
  };
}

function assertLengthMin(output: string, minLength: number, assertion: Assertion): AssertionResult {
  const actualLength = output.length;
  const passed = actualLength >= minLength;

  return {
    assertion,
    passed,
    message: passed
      ? `Output length (${actualLength}) >= ${minLength}`
      : assertion.message || `Expected output length to be at least ${minLength}, got ${actualLength}`,
    actual: actualLength,
    expected: `>= ${minLength}`,
  };
}

function assertLengthMax(output: string, maxLength: number, assertion: Assertion): AssertionResult {
  const actualLength = output.length;
  const passed = actualLength <= maxLength;

  return {
    assertion,
    passed,
    message: passed
      ? `Output length (${actualLength}) <= ${maxLength}`
      : assertion.message || `Expected output length to be at most ${maxLength}, got ${actualLength}`,
    actual: actualLength,
    expected: `<= ${maxLength}`,
  };
}

function assertLengthEquals(output: string, length: number, assertion: Assertion): AssertionResult {
  const actualLength = output.length;
  const passed = actualLength === length;

  return {
    assertion,
    passed,
    message: passed
      ? `Output length equals ${length}`
      : assertion.message || `Expected output length to be ${length}, got ${actualLength}`,
    actual: actualLength,
    expected: length,
  };
}

function assertStartsWith(output: string, prefix: string, assertion: Assertion): AssertionResult {
  const passed = output.startsWith(prefix);

  return {
    assertion,
    passed,
    message: passed
      ? `Output starts with "${prefix}"`
      : assertion.message || `Expected output to start with "${prefix}"`,
    actual: output.substring(0, Math.min(prefix.length + 20, output.length)),
    expected: prefix,
  };
}

function assertEndsWith(output: string, suffix: string, assertion: Assertion): AssertionResult {
  const passed = output.endsWith(suffix);

  return {
    assertion,
    passed,
    message: passed
      ? `Output ends with "${suffix}"`
      : assertion.message || `Expected output to end with "${suffix}"`,
    actual: output.substring(Math.max(0, output.length - suffix.length - 20)),
    expected: suffix,
  };
}

function assertEquals(output: string, expected: string, assertion: Assertion): AssertionResult {
  const normalizedOutput = output.trim();
  const normalizedExpected = expected.trim();
  const passed = normalizedOutput === normalizedExpected;

  return {
    assertion,
    passed,
    message: passed
      ? 'Output equals expected value'
      : assertion.message || 'Output does not equal expected value',
    actual: normalizedOutput.length > 100 ? normalizedOutput.substring(0, 100) + '...' : normalizedOutput,
    expected: normalizedExpected.length > 100 ? normalizedExpected.substring(0, 100) + '...' : normalizedExpected,
  };
}

function assertNotEquals(output: string, expected: string, assertion: Assertion): AssertionResult {
  const normalizedOutput = output.trim();
  const normalizedExpected = expected.trim();
  const passed = normalizedOutput !== normalizedExpected;

  return {
    assertion,
    passed,
    message: passed
      ? 'Output does not equal the excluded value'
      : assertion.message || 'Output should not equal the given value',
    actual: normalizedOutput.length > 100 ? normalizedOutput.substring(0, 100) + '...' : normalizedOutput,
    expected: `NOT "${normalizedExpected.length > 100 ? normalizedExpected.substring(0, 100) + '...' : normalizedExpected}"`,
  };
}

function assertIsJson(output: string, assertion: Assertion): AssertionResult {
  let passed = false;
  let errorMsg = '';

  try {
    JSON.parse(output);
    passed = true;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Invalid JSON';
  }

  return {
    assertion,
    passed,
    message: passed
      ? 'Output is valid JSON'
      : assertion.message || `Output is not valid JSON: ${errorMsg}`,
    actual: output.length > 100 ? output.substring(0, 100) + '...' : output,
    expected: 'Valid JSON',
  };
}

function assertJsonPath(output: string, config: { path: string; value: unknown }, assertion: Assertion): AssertionResult {
  let passed = false;
  let errorMsg = '';
  let actualValue: unknown;

  try {
    const parsed = JSON.parse(output);
    const pathParts = config.path.split('.').filter(p => p);

    // Simple JSON path evaluation (supports dot notation)
    let current: unknown = parsed;
    for (const part of pathParts) {
      if (current === null || current === undefined) {
        throw new Error(`Path "${config.path}" not found`);
      }
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        throw new Error(`Cannot access property "${part}" on non-object`);
      }
    }

    actualValue = current;
    passed = JSON.stringify(current) === JSON.stringify(config.value);
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'JSON path evaluation failed';
  }

  return {
    assertion,
    passed,
    message: errorMsg
      ? `JSON path assertion failed: ${errorMsg}`
      : passed
        ? `JSON path "${config.path}" equals expected value`
        : assertion.message || `JSON path "${config.path}" does not equal expected value`,
    actual: actualValue !== undefined ? JSON.stringify(actualValue) : 'undefined',
    expected: JSON.stringify(config.value),
  };
}

function assertWordCountMin(output: string, minWords: number, assertion: Assertion): AssertionResult {
  const words = output.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const passed = wordCount >= minWords;

  return {
    assertion,
    passed,
    message: passed
      ? `Word count (${wordCount}) >= ${minWords}`
      : assertion.message || `Expected at least ${minWords} words, got ${wordCount}`,
    actual: wordCount,
    expected: `>= ${minWords}`,
  };
}

function assertWordCountMax(output: string, maxWords: number, assertion: Assertion): AssertionResult {
  const words = output.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const passed = wordCount <= maxWords;

  return {
    assertion,
    passed,
    message: passed
      ? `Word count (${wordCount}) <= ${maxWords}`
      : assertion.message || `Expected at most ${maxWords} words, got ${wordCount}`,
    actual: wordCount,
    expected: `<= ${maxWords}`,
  };
}

/**
 * Get a description of an assertion type
 */
export function getAssertionTypeDescription(type: AssertionType): string {
  const descriptions: Record<AssertionType, string> = {
    'contains': 'Output contains the expected string',
    'not-contains': 'Output does not contain the expected string',
    'matches': 'Output matches the regular expression pattern',
    'not-matches': 'Output does not match the regular expression pattern',
    'json-schema': 'Output is valid JSON matching the schema',
    'length-min': 'Output length is at least the expected value',
    'length-max': 'Output length is at most the expected value',
    'length-equals': 'Output length equals the expected value',
    'starts-with': 'Output starts with the expected string',
    'ends-with': 'Output ends with the expected string',
    'equals': 'Output exactly equals the expected string (trimmed)',
    'not-equals': 'Output does not equal the expected string',
    'is-json': 'Output is valid JSON',
    'json-path': 'JSON path in output equals expected value',
    'word-count-min': 'Output has at least the expected number of words',
    'word-count-max': 'Output has at most the expected number of words',
  };

  return descriptions[type] || 'Unknown assertion type';
}

/**
 * Get all available assertion types
 */
export function getAssertionTypes(): AssertionType[] {
  return [
    'contains',
    'not-contains',
    'matches',
    'not-matches',
    'json-schema',
    'length-min',
    'length-max',
    'length-equals',
    'starts-with',
    'ends-with',
    'equals',
    'not-equals',
    'is-json',
    'json-path',
    'word-count-min',
    'word-count-max',
  ];
}
