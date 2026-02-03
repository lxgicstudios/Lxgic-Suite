# @lxgic/prompt-lint

Lint prompts for best practices and anti-patterns. Helps you write better prompts by detecting common issues like vague language, missing context, and ambiguous instructions.

## Installation

```bash
npm install -g @lxgic/prompt-lint
# or
npx @lxgic/prompt-lint lint prompt.txt
```

## Usage

### Lint a file

```bash
prompt-lint lint prompt.txt
```

### Lint multiple files with glob patterns

```bash
prompt-lint lint "prompts/**/*.txt"
prompt-lint lint prompt1.txt prompt2.txt prompt3.txt
```

### Lint from stdin

```bash
echo "Do some stuff" | prompt-lint lint --stdin
cat prompt.txt | prompt-lint lint --stdin
```

### Output as JSON

```bash
prompt-lint lint prompt.txt --json
```

### Filter by severity

```bash
# Only show warnings and errors
prompt-lint lint prompt.txt --severity warning

# Only show errors
prompt-lint lint prompt.txt --severity error
```

### Enable/disable specific rules

```bash
# Only run specific rules
prompt-lint lint prompt.txt --enable prompt-length-min,clarity-vague-words

# Disable specific rules
prompt-lint lint prompt.txt --disable role-definition,examples-present
```

### Quick check (errors only)

```bash
prompt-lint check prompt.txt
```

### List available rules

```bash
prompt-lint rules
prompt-lint rules --json
```

## Available Rules

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `empty-prompt` | error | Detects empty or whitespace-only prompts |
| `prompt-length-min` | warning | Prompts should be at least 50 characters |
| `prompt-length-max` | warning | Prompts over 10000 characters may be hard to process |
| `clarity-vague-words` | warning | Detects vague words like "stuff", "things", "etc" |
| `instruction-ambiguity` | warning | Detects vague instructions like "do it well" |
| `repeated-instructions` | warning | Detects potentially repeated instructions |
| `specificity-context` | info | Suggests adding context markers |
| `role-definition` | info | Suggests adding a role definition |
| `output-format` | info | Suggests specifying output format |
| `examples-present` | info | Suggests adding examples for complex prompts |

## Exit Codes

- `0` - No errors found (warnings and info are OK)
- `1` - One or more errors found, or invalid input

## Examples

### Example prompt with issues

```text
Do some stuff and make it good. Handle everything appropriately.
```

Running `prompt-lint lint example.txt` would output:

```
Linting: example.txt
--------------------------------------------------
  [WARN] [clarity-vague-words] Vague word detected: "stuff":1:8
       Suggestion: Replace "stuff" with a more specific term
  [WARN] [clarity-vague-words] Vague word detected: "everything":1:36
       Suggestion: Replace "everything" with a more specific term
  [WARN] [instruction-ambiguity] Subjective quality instruction: "make it good":1:18
       Suggestion: Be specific about what you want. Define concrete criteria or examples.
  [WARN] [instruction-ambiguity] Vague handling instruction: "Handle everything appropriately":1:32
       Suggestion: Be specific about what you want. Define concrete criteria or examples.
  [WARN] [prompt-length-min] Prompt is too short (60 characters). Consider adding more context or details.
       Suggestion: Add more context about your task, expected output format, or constraints.
--------------------------------------------------
Summary: 0 error(s), 5 warning(s), 0 info(s)
```

### Example well-structured prompt

```text
You are an expert technical writer specializing in API documentation.

Context:
I have a REST API for a task management application that needs documentation.

Task:
Write clear, concise documentation for the following endpoint:
- POST /api/tasks - Creates a new task

Output format:
Provide the documentation in Markdown format with:
1. Endpoint description
2. Request parameters (as a table)
3. Example request
4. Example response
5. Error codes

Example:
## GET /api/users
Retrieves a list of all users...
```

This prompt would pass with no issues.

## Programmatic Usage

```typescript
import { PromptLinter, formatReport } from '@lxgic/prompt-lint';

const linter = new PromptLinter({
  minSeverity: 'warning',
  disabledRules: ['role-definition'],
});

const report = linter.lint('Your prompt here');

console.log(formatReport(report));
console.log('Passed:', report.passed);
```

## License

MIT
