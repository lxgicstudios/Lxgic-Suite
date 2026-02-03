# ai-regression

Regression test suite for AI outputs. Detect changes and regressions in AI model outputs over time.

## Installation

```bash
npm install -g ai-regression
# or use directly with npx
npx ai-regression --help
```

## Usage

### Create Baselines

Save baseline outputs for future comparison:

```bash
# Initialize with sample baselines
ai-regression baseline ./baselines --init

# Create baselines from outputs file
ai-regression baseline ./baselines --input outputs.json

# Overwrite existing baselines
ai-regression baseline ./baselines --input outputs.json --force
```

### Run Regression Tests

Compare current outputs against baselines:

```bash
# Basic test
ai-regression test ./baselines --current ./current-outputs.json

# With custom threshold
ai-regression test ./baselines --current ./current --threshold 0.90

# Save results to file
ai-regression test ./baselines --current ./current -o results.json

# CI/CD friendly mode
ai-regression test ./baselines --current ./current --ci
```

### Compare Directories

Compare two sets of outputs directly:

```bash
ai-regression compare --baseline ./v1-outputs --current ./v2-outputs

# With custom threshold
ai-regression compare -b ./v1 -c ./v2 --threshold 0.80

# Save results
ai-regression compare -b ./v1 -c ./v2 -o comparison.json
```

### Generate Reports

Create human-readable reports from test results:

```bash
# Print report to console
ai-regression report --input results.json

# Save report to file
ai-regression report --input results.json --output report.txt
```

## Input File Format

### Outputs File

```json
[
  {
    "id": "test-1",
    "input": "What is AI?",
    "output": "AI is artificial intelligence..."
  },
  {
    "id": "test-2",
    "input": "Explain ML",
    "output": "Machine learning is..."
  }
]
```

### Baseline Structure

When you run `baseline`, the tool creates:

```
baselines/
  manifest.json      # Configuration and metadata
  baselines.json     # All baseline entries
  entries/           # Individual entry files
    test-1.json
    test-2.json
```

## Similarity Methods

The tool uses multiple similarity algorithms:

### Jaccard Similarity
Measures overlap between word sets. Good for semantic similarity.

### Levenshtein Similarity
Character-level edit distance. Good for detecting small changes.

### Cosine Similarity
N-gram based similarity using character bigrams.

## Configuration

Default configuration:

```json
{
  "similarityThreshold": 0.85,
  "methods": ["jaccard", "levenshtein"],
  "caseSensitive": false,
  "ignoreWhitespace": true
}
```

## Output Format

### Test Summary

```json
{
  "total": 10,
  "passed": 8,
  "failed": 2,
  "regressions": 2,
  "passRate": 80.0,
  "results": [...],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "config": {...}
}
```

### Comparison Result

```json
{
  "id": "test-1",
  "baseline": "Original output...",
  "current": "New output...",
  "similarity": {
    "score": 0.92,
    "method": "jaccard+levenshtein",
    "details": {
      "exactMatch": false,
      "lengthRatio": 0.95,
      "wordOverlap": 0.88,
      "characterSimilarity": 0.96
    }
  },
  "isRegression": false,
  "threshold": 0.85
}
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed (regressions detected)

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run AI Regression Tests
  run: |
    npx ai-regression test ./baselines --current ./outputs --threshold 0.90 --ci
```

```bash
# Jenkins/Shell
npx ai-regression test ./baselines -c ./current -o results.json --json
if [ $? -ne 0 ]; then
  echo "Regressions detected!"
  exit 1
fi
```

## Flags

- `--json`: Output results in JSON format
- `--help`: Show help information
- `-V, --version`: Show version number
- `--ci`: CI/CD friendly output

## Examples

### Track Model Updates

```bash
# Save v1 outputs as baseline
npx ai-regression baseline ./baseline-v1 --input v1-outputs.json

# Test v2 against v1
npx ai-regression test ./baseline-v1 --current v2-outputs.json --threshold 0.85
```

### Monitor Production

```bash
# Daily regression check
npx ai-regression test ./golden-outputs \
  --current ./today-outputs.json \
  --threshold 0.90 \
  --output daily-report.json
```

## License

MIT
