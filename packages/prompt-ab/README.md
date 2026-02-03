# prompt-ab

A/B test prompt variations. Compare two prompt versions to determine which performs better.

## Installation

```bash
npm install -g prompt-ab
# or use directly with npx
npx prompt-ab --help
```

## Usage

### Run A/B Test

Execute an A/B test comparing two prompt variants:

```bash
# Basic test
prompt-ab run prompt-a.txt prompt-b.txt

# With custom sample size
prompt-ab run prompt-a.txt prompt-b.txt --samples 100

# With custom inputs
prompt-ab run prompt-a.txt prompt-b.txt --inputs test-cases.json

# Save results
prompt-ab run prompt-a.txt prompt-b.txt --output results.json

# Specify metrics and confidence
prompt-ab run prompt-a.txt prompt-b.txt \
  --metrics quality,relevance,coherence \
  --confidence 0.95
```

### Analyze Results

Analyze results from a previous experiment:

```bash
# Analyze stored results
prompt-ab analyze results.json

# Save analysis
prompt-ab analyze results.json --output analysis.json

# JSON output
prompt-ab analyze results.json --json
```

### Generate Report

Create a human-readable report:

```bash
# Print report to console
prompt-ab report --input results.json

# Save report to file
prompt-ab report --input results.json --output report.txt
```

### Calculate Sample Size

Determine required sample size for your experiment:

```bash
# Default calculation
prompt-ab sample-size

# With custom parameters
prompt-ab sample-size --effect 0.3 --power 0.9 --alpha 0.01
```

## Input Formats

### Prompt Files

Plain text files containing the prompt:

```text
You are a helpful assistant. Please answer the following question clearly and concisely:

{input}

Provide a detailed explanation.
```

### Test Cases File

JSON array of test inputs:

```json
[
  {
    "id": "test-1",
    "text": "What is machine learning?"
  },
  {
    "id": "test-2",
    "text": "Explain neural networks"
  }
]
```

## Metrics

The tool measures these metrics by default:

- **quality**: Overall response quality (0-100)
- **relevance**: How relevant the response is to the input (0-100)
- **coherence**: Logical flow and consistency (0-100)
- **length**: Response length in characters
- **responseTime**: Time to generate response (ms)

## Statistical Analysis

### Methods Used

- **Welch's t-test**: Compares means between variants (handles unequal variances)
- **Confidence intervals**: 95% CI for the difference between variants
- **Effect size**: Cohen's d for practical significance
- **p-value**: Statistical significance of observed differences

### Interpreting Results

| p-value | Interpretation |
|---------|----------------|
| < 0.01 | Highly significant |
| < 0.05 | Significant |
| < 0.10 | Marginally significant |
| >= 0.10 | Not significant |

| Cohen's d | Effect Size |
|-----------|-------------|
| < 0.2 | Negligible |
| 0.2-0.5 | Small |
| 0.5-0.8 | Medium |
| > 0.8 | Large |

## Output Format

### Results JSON

```json
{
  "config": {
    "name": "A/B Experiment",
    "promptA": "...",
    "promptB": "...",
    "samples": 100,
    "confidenceLevel": 0.95,
    "metrics": ["quality", "relevance", "coherence"]
  },
  "variantAResults": [...],
  "variantBResults": [...],
  "summary": {
    "overallWinner": "A",
    "statisticalResults": [...],
    "recommendation": "..."
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Statistical Result

```json
{
  "metric": "quality",
  "variantAMean": 78.5,
  "variantBMean": 72.3,
  "variantAStdDev": 8.2,
  "variantBStdDev": 9.1,
  "difference": 6.2,
  "percentChange": 8.57,
  "tStatistic": 2.45,
  "pValue": 0.0142,
  "isSignificant": true,
  "confidenceInterval": [1.2, 11.2],
  "winner": "A"
}
```

## Example Workflow

```bash
# 1. Create prompt variants
echo "Answer concisely:" > prompt-a.txt
echo "Provide a detailed answer:" > prompt-b.txt

# 2. Run experiment
npx prompt-ab run prompt-a.txt prompt-b.txt \
  --samples 50 \
  --output experiment.json

# 3. Generate report
npx prompt-ab report --input experiment.json --output report.txt

# 4. View results
cat report.txt
```

## Flags

- `--json`: Output results in JSON format
- `--help`: Show help information
- `-V, --version`: Show version number

## Best Practices

1. **Sample Size**: Use at least 30 samples per variant for reliable statistics
2. **One Variable**: Only change one thing between variants
3. **Consistent Inputs**: Use the same inputs for both variants
4. **Multiple Metrics**: Consider multiple quality metrics
5. **Practical Significance**: Look at effect size, not just p-value

## License

MIT
