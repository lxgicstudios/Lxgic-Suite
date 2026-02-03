# @lxgic/prompt-chain

Chain multiple prompts with data flow. This CLI tool allows you to define multi-step AI workflows using YAML pipeline definitions.

## Installation

```bash
npm install -g @lxgic/prompt-chain
# or use with npx
npx @lxgic/prompt-chain --help
```

## Features

- YAML-based pipeline definitions
- Sequential prompt execution with data flow
- Variable substitution using Mustache syntax
- Conditional branching
- Loop support for batch processing
- Dry-run mode for testing
- Full JSON output support for scripting
- Automatic retry on failures

## Commands

### Run Pipeline

Execute a pipeline from a YAML file:

```bash
# Basic usage
prompt-chain run pipeline.yaml

# With variables
prompt-chain run pipeline.yaml --var input="Hello world" --var language=French

# Dry run (show what would execute)
prompt-chain run pipeline.yaml --dry-run

# Verbose mode with progress
prompt-chain run pipeline.yaml --verbose

# Save output to file
prompt-chain run pipeline.yaml --output results.json
```

### Validate Pipeline

Check a pipeline for errors without running it:

```bash
prompt-chain validate pipeline.yaml
```

### Pipeline Info

Show detailed information about a pipeline:

```bash
prompt-chain info pipeline.yaml
```

### Initialize Pipeline

Create a new pipeline from template:

```bash
# Creates my-workflow.yaml
prompt-chain init my-workflow

# Specify output file
prompt-chain init my-workflow --output path/to/pipeline.yaml

# Overwrite existing
prompt-chain init my-workflow --force
```

## Pipeline YAML Format

### Basic Structure

```yaml
name: my-pipeline
description: A sample pipeline
version: "1.0.0"

# Initial variables (optional)
variables:
  default_language: English

# Pipeline steps
steps:
  - name: analyze
    prompt: "Analyze this text: {{input}}"
    output: analysis

  - name: summarize
    prompt: "Summarize the following analysis: {{analysis}}"
    output: summary

  - name: translate
    prompt: "Translate to {{default_language}}: {{summary}}"
    output: final_result
```

### Step Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Unique identifier for the step |
| `prompt` | Yes | Prompt template with `{{variable}}` placeholders |
| `output` | Yes | Variable name to store the result |
| `input` | No | Input from previous step or variable |
| `model` | No | Model to use (default: claude-sonnet-4-20250514) |
| `maxTokens` | No | Maximum tokens for response (default: 2000) |
| `temperature` | No | Temperature for response (0-1) |
| `continueOnError` | No | Continue pipeline if step fails |
| `condition` | No | Conditional execution |
| `loop` | No | Loop configuration |

### Conditional Execution

```yaml
steps:
  - name: check-sentiment
    prompt: "Is this positive or negative? Answer only 'positive' or 'negative': {{input}}"
    output: sentiment

  - name: positive-response
    prompt: "Write an enthusiastic response to: {{input}}"
    output: response
    condition:
      if: "sentiment.includes('positive')"
      then: positive-response
      else: negative-response

  - name: negative-response
    prompt: "Write a sympathetic response to: {{input}}"
    output: response
```

### Loop Execution

```yaml
steps:
  - name: split-tasks
    prompt: "List 5 tasks, one per line: {{input}}"
    output: tasks

  - name: process-each
    prompt: "Expand on this task: {{task}}"
    output: expanded_tasks
    loop:
      over: tasks
      as: task
      maxIterations: 10
```

### Error Handling

```yaml
name: robust-pipeline
onError: retry  # stop, continue, or retry
maxRetries: 3

steps:
  - name: risky-step
    prompt: "..."
    output: result
    continueOnError: true  # Override for this step
```

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
prompt-chain run pipeline.yaml --json
prompt-chain validate pipeline.yaml --json
prompt-chain info pipeline.yaml --json
```

## Environment Variables

- `ANTHROPIC_API_KEY`: Required for executing prompts with Claude

## Example Pipelines

### Content Transformation

```yaml
name: content-transformer
description: Transform content through multiple stages

steps:
  - name: extract
    prompt: |
      Extract the main points from this text:
      {{input}}
    output: main_points

  - name: enhance
    prompt: |
      Enhance these points with additional context:
      {{main_points}}
    output: enhanced

  - name: format
    prompt: |
      Format this as a professional document:
      {{enhanced}}
    output: final_document
```

### Code Review Pipeline

```yaml
name: code-review
description: Multi-step code review

variables:
  language: auto-detect

steps:
  - name: detect-language
    prompt: "What programming language is this? Just name it: {{code}}"
    output: detected_language

  - name: analyze
    prompt: |
      Analyze this {{detected_language}} code for:
      - Bugs
      - Performance issues
      - Security vulnerabilities

      Code:
      {{code}}
    output: analysis

  - name: suggest
    prompt: |
      Based on this analysis:
      {{analysis}}

      Provide specific improvement suggestions with code examples.
    output: suggestions

  - name: summary
    prompt: |
      Create a brief code review summary:

      Analysis: {{analysis}}
      Suggestions: {{suggestions}}
    output: review_summary
```

## API

The package exports core functions for programmatic use:

```typescript
import {
  runPipelineFile,
  validatePipelineFile,
  getPipelineSummary,
} from '@lxgic/prompt-chain';

// Run a pipeline
const result = await runPipelineFile('pipeline.yaml', {
  variables: { input: 'Hello' },
});

// Validate a pipeline
const validation = await validatePipelineFile('pipeline.yaml');

// Get pipeline info
const summary = await getPipelineSummary('pipeline.yaml');
```

## License

MIT
