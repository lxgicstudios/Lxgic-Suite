# ai-pipeline

Build and run multi-step AI pipelines with YAML definitions.

## Installation

```bash
npm install -g ai-pipeline
# or use directly with npx
npx ai-pipeline --help
```

## Usage

### Run a Pipeline

```bash
ai-pipeline run pipeline.yaml
ai-pipeline run pipeline.yaml --input "Your input text"
ai-pipeline run pipeline.yaml --var key1=value1 --var key2=value2
ai-pipeline run pipeline.yaml --dry-run
ai-pipeline run pipeline.yaml --verbose
```

### Validate a Pipeline

```bash
ai-pipeline validate pipeline.yaml
```

### Visualize a Pipeline

```bash
ai-pipeline visualize pipeline.yaml
```

## Pipeline YAML Format

```yaml
name: content-pipeline
description: Process and analyze content
version: "1.0"

variables:
  tone: professional
  language: english

errorHandling:
  strategy: retry  # stop, continue, or retry
  maxRetries: 3

steps:
  - id: extract
    type: prompt
    template: "Extract key points from: {{input}}"
    retries: 2

  - id: analyze
    type: prompt
    input: "{{extract.output}}"
    template: "Analyze sentiment of: {{input}}"

  - id: format
    type: transform
    input: "{{analyze.output}}"
    transform: json

  - id: filter
    type: filter
    input: "{{format.output}}"
    condition: "length > 0"

  - id: branch
    type: branch
    input: "{{filter.output}}"
    branches:
      - condition: "contains 'positive'"
        steps: [celebrate]
      - condition: "contains 'negative'"
        steps: [improve]

  - id: merge
    type: merge
    sources: [extract, analyze]
```

## Step Types

### prompt

Sends a prompt to the AI model.

```yaml
- id: my-prompt
  type: prompt
  template: "Summarize this: {{input}}"
  input: "{{previous_step.output}}"  # optional
  retries: 3
  timeout: 30000
```

### transform

Transforms data between formats.

```yaml
- id: to-json
  type: transform
  input: "{{prev.output}}"
  transform: json  # json, text, uppercase, lowercase, trim, split, join, array, first, last, count, keys, values
```

Available transforms:
- `json` - Parse as JSON
- `text` - Convert to string
- `uppercase` - Convert to uppercase
- `lowercase` - Convert to lowercase
- `trim` - Remove whitespace
- `split` - Split by newlines into array
- `join` - Join array with newlines
- `array` - Wrap in array
- `first` - Get first element
- `last` - Get last element
- `count` - Get length
- `keys` - Get object keys
- `values` - Get object values

### filter

Filters data based on conditions.

```yaml
- id: filter-results
  type: filter
  input: "{{prev.output}}"
  condition: "length > 10"
```

Supported conditions:
- `true` / `false`
- `== value`
- `!= value`
- `contains 'text'`
- `startsWith 'text'`
- `endsWith 'text'`
- `length > N`, `length < N`, `length >= N`, `length <= N`, `length == N`

### branch

Conditionally selects execution branches.

```yaml
- id: decision
  type: branch
  input: "{{prev.output}}"
  branches:
    - condition: "contains 'error'"
      steps: [handle-error]
    - condition: "true"
      steps: [continue-normal]
```

### merge

Combines outputs from multiple steps.

```yaml
- id: combine
  type: merge
  sources: [step1, step2, step3]
```

## Variable References

Reference values using `{{variable}}` syntax:

- `{{input}}` - Pipeline input
- `{{step_id.output}}` - Output from a specific step
- `{{variable_name}}` - Pipeline variable

## Options

### Global Options

- `--json` - Output in JSON format
- `--help` - Show help

### Run Options

- `-i, --input <value>` - Input for the pipeline
- `-v, --var <vars...>` - Variables (key=value format)
- `--dry-run` - Validate without executing
- `--verbose` - Show detailed output

## Error Handling

Configure error handling strategy in YAML:

```yaml
errorHandling:
  strategy: stop     # stop, continue, or retry
  maxRetries: 3
```

- `stop` - Stop pipeline on first error (default)
- `continue` - Continue pipeline even if steps fail
- `retry` - Retry failed steps

## Examples

### Content Processing Pipeline

```yaml
name: content-processor
steps:
  - id: extract
    type: prompt
    template: "Extract main topics from: {{input}}"

  - id: summarize
    type: prompt
    input: "{{extract.output}}"
    template: "Summarize these topics: {{input}}"

  - id: format
    type: transform
    input: "{{summarize.output}}"
    transform: json
```

### Data Transformation Pipeline

```yaml
name: data-transformer
steps:
  - id: parse
    type: transform
    transform: json

  - id: filter
    type: filter
    input: "{{parse.output}}"
    condition: "length > 0"

  - id: process
    type: prompt
    input: "{{filter.output}}"
    template: "Analyze this data: {{input}}"
```

## License

MIT
