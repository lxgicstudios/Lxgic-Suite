# ai-consistency

Check output consistency across runs. Run the same prompt multiple times, compare output similarity, and analyze temperature impact on consistency.

## Installation

```bash
npm install -g ai-consistency
# or
npx ai-consistency
```

## Prerequisites

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

## Usage

### Check Consistency

```bash
# Check consistency of a prompt file
npx ai-consistency check prompt.txt --runs 5

# With custom temperature
npx ai-consistency check prompt.txt --runs 10 --temperature 0.5

# With specific model
npx ai-consistency check prompt.txt --model claude-sonnet-4-20250514

# Output as JSON
npx ai-consistency check prompt.txt --json
```

### View Last Report

```bash
# Show the last consistency check report
npx ai-consistency report

# Output as JSON
npx ai-consistency report --json
```

### Check Threshold

```bash
# Check if consistency meets minimum threshold
npx ai-consistency threshold --min 0.8

# Check with a specific file
npx ai-consistency threshold --min 0.7 --file prompt.txt --runs 5

# Output as JSON
npx ai-consistency threshold --min 0.8 --json
```

### Configuration

```bash
# View all configuration
npx ai-consistency config

# Get a specific value
npx ai-consistency config --get defaultRuns

# Set a value
npx ai-consistency config --set defaultTemperature=0.5
```

## Features

- **Multiple Runs**: Execute the same prompt multiple times with configurable count
- **Similarity Analysis**: Calculate lexical, structural, and semantic similarity
- **Variable Sections**: Identify parts of outputs that vary between runs
- **Temperature Analysis**: Recommendations for optimal temperature settings
- **Threshold Checking**: CI/CD integration with pass/fail thresholds

## Analysis Metrics

The tool calculates several similarity metrics:

| Metric | Description |
|--------|-------------|
| Semantic Similarity | How similar the meaning is across outputs |
| Lexical Similarity | Word-level overlap (Jaccard similarity) |
| Structural Similarity | Similarity in formatting and structure |
| Length Variance | Coefficient of variation in output length |

The overall consistency score is a weighted average:
- 40% Semantic Similarity
- 30% Lexical Similarity
- 20% Structural Similarity
- 10% Length Consistency

## Output Example

### Text Report

```
============================================================
  AI CONSISTENCY REPORT
============================================================

  Prompt: "Write a greeting for a user named John..."
  Runs: 5
  Generated: 2024-01-15T10:30:00.000Z

------------------------------------------------------------
  CONSISTENCY SCORE
------------------------------------------------------------
  Overall Score: 85.2%

  Analysis Breakdown:
    Semantic Similarity:   92.0%
    Lexical Similarity:    78.5%
    Structural Similarity: 88.0%
    Length Variance:       15.2%

------------------------------------------------------------
  VARIABLE SECTIONS
------------------------------------------------------------
  Position 2: 60% variability
    - "Welcome aboard, John!"
    - "Hello and welcome, John!"

------------------------------------------------------------
  TEMPERATURE ANALYSIS
------------------------------------------------------------
  Current Temperature: 1.0
  Recommendation: Consider lowering temperature for more consistent outputs.
```

### JSON Output

```json
{
  "prompt": "Write a greeting...",
  "runs": 5,
  "outputs": ["Output 1...", "Output 2..."],
  "consistencyScore": 0.85,
  "variableSections": [...],
  "analysis": {
    "semanticSimilarity": 0.92,
    "structuralSimilarity": 0.88,
    "lexicalSimilarity": 0.785,
    "lengthVariance": 0.152
  },
  "temperatureImpact": {
    "temperature": 1.0,
    "recommendation": "Consider lowering temperature..."
  }
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `defaultRuns` | 5 | Default number of runs per check |
| `defaultTemperature` | 1 | Default temperature for API calls |
| `defaultModel` | claude-sonnet-4-20250514 | Default model to use |
| `consistencyThreshold` | 0.8 | Default minimum consistency threshold |
| `maxTokens` | 1024 | Maximum tokens per response |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check AI Consistency
  run: npx ai-consistency threshold --min 0.8 --file prompts/main.txt --json
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### GitLab CI

```yaml
consistency:
  script:
    - npx ai-consistency threshold --min 0.8 --file prompts/main.txt
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

## License

MIT
