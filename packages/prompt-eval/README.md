# prompt-eval

Evaluate outputs with custom metrics. A CLI tool for scoring AI outputs against configurable evaluation criteria.

## Installation

```bash
npm install -g prompt-eval
# or use directly with npx
npx prompt-eval --help
```

## Usage

### Run Evaluation

Execute evaluation against a YAML configuration file:

```bash
# Basic evaluation
prompt-eval run eval-config.yaml

# With custom output file
prompt-eval run eval-config.yaml --output results.json

# With custom pass threshold
prompt-eval run eval-config.yaml --threshold 75

# JSON output
prompt-eval run eval-config.yaml --json
```

### Score Outputs

Score outputs from a file against metrics:

```bash
# Score with default metrics (relevance, coherence, accuracy)
prompt-eval score outputs.json

# Score with specific metrics
prompt-eval score outputs.json --metrics relevance,accuracy

# Save results to file
prompt-eval score outputs.json --output scores.json

# JSON output
prompt-eval score outputs.json --json
```

### Define Metrics

Define custom evaluation metrics:

```bash
# Define a new metric
prompt-eval define helpfulness --description "How helpful is the response" --type custom

# Define with custom range and weight
prompt-eval define clarity --type custom --weight 1.5 --min 0 --max 100

# Initialize a sample evaluation config
prompt-eval define init --init --output my-eval.yaml
```

### List Metrics

List all available metrics:

```bash
prompt-eval list
prompt-eval list --json
```

## Configuration Format

Evaluation configurations are written in YAML:

```yaml
name: My Evaluation
description: Testing AI outputs for quality
metrics:
  - relevance
  - coherence
  - accuracy
testCases:
  - id: test-1
    input: "What is the capital of France?"
    output: "The capital of France is Paris."
    expectedScore: 90
  - id: test-2
    input: "Explain gravity briefly."
    output: "Gravity is a force that attracts objects with mass toward each other."
    expectedScore: 85
options:
  passThreshold: 60
  aggregationMethod: weighted
```

## Built-in Metrics

### Relevance
Measures how relevant the output is to the input prompt.

Criteria:
- Directly addresses the question or prompt
- Contains information pertinent to the topic
- Avoids off-topic or irrelevant content
- Maintains focus throughout the response

### Coherence
Measures the logical flow and consistency of the output.

Criteria:
- Ideas flow logically from one to the next
- Consistent tone and style throughout
- Proper use of transitions
- Clear structure and organization

### Accuracy
Measures factual correctness of the output.

Criteria:
- Statements are factually correct
- No contradictions within the response
- Proper use of technical terms
- Correct attribution of sources

## Output Format

### Evaluation Summary

```json
{
  "name": "My Evaluation",
  "totalTests": 2,
  "passedTests": 2,
  "failedTests": 0,
  "averageScore": 82.5,
  "minScore": 78.0,
  "maxScore": 87.0,
  "metricAverages": {
    "relevance": 85.0,
    "coherence": 80.0,
    "accuracy": 82.5
  },
  "results": [...],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed or an error occurred

## Flags

- `--json`: Output results in JSON format
- `--help`: Show help information
- `-V, --version`: Show version number

## Examples

### CI/CD Integration

```bash
# Run evaluation and fail pipeline if tests don't pass
npx prompt-eval run eval-config.yaml --threshold 80 --output results.json
```

### Batch Scoring

```bash
# Score multiple outputs
npx prompt-eval score batch-outputs.json --metrics relevance,accuracy --output batch-scores.json
```

## License

MIT
