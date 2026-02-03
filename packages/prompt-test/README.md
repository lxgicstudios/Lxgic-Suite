# @lxgic/prompt-test

Unit test prompts with assertions on outputs. Validate that your prompts produce the expected results by running them through Claude and checking the outputs against various assertions.

## Installation

```bash
npm install -g @lxgic/prompt-test
# or
npx @lxgic/prompt-test run tests/*.yaml
```

## Prerequisites

Set your Anthropic API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

## Usage

### Create a sample test file

```bash
prompt-test init
# Creates prompt-tests.yaml
```

### Run tests

```bash
prompt-test run tests/my-tests.yaml
```

### Run multiple test files with glob patterns

```bash
prompt-test run "tests/**/*.yaml"
prompt-test run tests/*.yaml
```

### Output as JSON

```bash
prompt-test run tests/*.yaml --json
```

### Verbose output (show all assertions)

```bash
prompt-test run tests/*.yaml --verbose
```

### Run tests in parallel

```bash
prompt-test run tests/*.yaml --parallel --max-parallel 10
```

### Dry run (validate without calling API)

```bash
prompt-test run tests/*.yaml --dry-run
```

### Validate test file syntax

```bash
prompt-test validate tests/*.yaml
```

### List available assertion types

```bash
prompt-test assertions
prompt-test assertions --json
```

## Test File Format

Test files are written in YAML format:

```yaml
name: My Prompt Tests
description: Test suite for my prompts

# Default settings for all tests
defaults:
  model: claude-sonnet-4-20250514
  maxTokens: 1024
  temperature: 0
  systemPrompt: "You are a helpful assistant."

# Individual test cases
tests:
  - name: Basic greeting test
    description: Test that the model responds politely
    prompt: "Say hello in a friendly way"
    assertions:
      - type: contains
        expected: "hello"
        ignoreCase: true
      - type: length-min
        expected: 5

  - name: JSON output test
    prompt: "Return a JSON object with name and age fields"
    assertions:
      - type: is-json
      - type: json-schema
        expected:
          type: object
          properties:
            name:
              type: string
            age:
              type: number
          required:
            - name
            - age

  - name: Variable substitution
    prompt: "Write about {{topic}}"
    variables:
      topic: "space exploration"
    assertions:
      - type: contains
        expected: "space"
```

## Available Assertion Types

| Type | Description | Expected Value |
|------|-------------|----------------|
| `contains` | Output contains the expected string | string |
| `not-contains` | Output does not contain the string | string |
| `matches` | Output matches a regular expression | regex pattern |
| `not-matches` | Output does not match the regex | regex pattern |
| `json-schema` | Output is valid JSON matching schema | JSON Schema object |
| `length-min` | Output length is at least N | number |
| `length-max` | Output length is at most N | number |
| `length-equals` | Output length equals N | number |
| `starts-with` | Output starts with the string | string |
| `ends-with` | Output ends with the string | string |
| `equals` | Output exactly equals the string | string |
| `not-equals` | Output does not equal the string | string |
| `is-json` | Output is valid JSON | (none) |
| `json-path` | JSON path equals expected value | {path, value} |
| `word-count-min` | At least N words | number |
| `word-count-max` | At most N words | number |

### Assertion Options

All assertions support these optional fields:

- `message`: Custom error message when assertion fails
- `ignoreCase`: Ignore case when comparing strings (default: false)

## Test Case Options

Each test case supports:

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Test name (required) | - |
| `description` | Test description | - |
| `prompt` | The prompt to test (required) | - |
| `assertions` | Array of assertions (required) | - |
| `model` | Override default model | claude-sonnet-4-20250514 |
| `maxTokens` | Override max tokens | 1024 |
| `temperature` | Override temperature | 0 |
| `systemPrompt` | System prompt to use | - |
| `variables` | Variable substitutions | - |
| `skip` | Skip this test | false |
| `timeout` | Timeout in ms | 60000 |

## Variable Substitution

Use `{{variable}}` syntax in prompts:

```yaml
tests:
  - name: Template test
    prompt: "Write a {{length}} story about {{topic}}"
    variables:
      length: "short"
      topic: "robots"
    assertions:
      - type: contains
        expected: "robot"
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed, or invalid input

## Examples

### Testing JSON Output

```yaml
tests:
  - name: API response format
    prompt: |
      Generate a mock API response for a user profile.
      Return only valid JSON.
    assertions:
      - type: is-json
      - type: json-schema
        expected:
          type: object
          required: ["id", "email"]
          properties:
            id:
              type: integer
            email:
              type: string
              format: email
```

### Testing Content Length

```yaml
tests:
  - name: Concise response
    prompt: "Explain quantum computing in one sentence."
    assertions:
      - type: length-max
        expected: 300
      - type: word-count-max
        expected: 50
```

### Testing with Regex

```yaml
tests:
  - name: Email format
    prompt: "Generate a sample email address"
    assertions:
      - type: matches
        expected: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
```

### Skipping Tests

```yaml
tests:
  - name: Expensive test
    skip: true
    prompt: "This test is temporarily disabled"
    assertions:
      - type: contains
        expected: "test"
```

## Programmatic Usage

```typescript
import { PromptTestRunner, formatTestFileResult } from '@lxgic/prompt-test';

const runner = new PromptTestRunner({
  defaultModel: 'claude-sonnet-4-20250514',
  verbose: true,
});

const result = await runner.runTestFile('tests/my-tests.yaml');
console.log(formatTestFileResult(result, true));
console.log('All passed:', result.summary.failed === 0);
```

## License

MIT
