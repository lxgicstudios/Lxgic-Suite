# prompt-stress

Load test prompts at scale with configurable RPS, duration, and comprehensive reporting.

## Installation

```bash
npm install -g prompt-stress
# or
npx prompt-stress
```

## Prerequisites

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

## Quick Start

1. Create a prompts file:

```bash
prompt-stress init
```

2. Run a load test:

```bash
prompt-stress run prompts.json --rps 5 --duration 30
```

3. Analyze results:

```bash
prompt-stress analyze stress-results.json
```

## Usage

### Run Load Test

```bash
prompt-stress run <file> [options]
```

Options:
- `--rps <number>`: Requests per second (default: 1)
- `--duration <seconds>`: Test duration in seconds (default: 10)
- `--output <path>`: Save results to JSON file
- `--json`: Output results as JSON
- `--verbose`: Show detailed progress

Examples:

```bash
# Basic test
prompt-stress run prompts.json --rps 5 --duration 60

# Save results for later analysis
prompt-stress run prompts.json --rps 10 --duration 120 --output results.json

# JSON output for scripting
prompt-stress run prompts.json --rps 5 --duration 30 --json
```

### Generate Report

```bash
prompt-stress report [options]
```

Options:
- `--input <path>`: Path to results JSON (default: stress-results.json)
- `--format <type>`: Report format - text, json, or html (default: text)
- `--output <path>`: Save report to file
- `--json`: Output as JSON

Examples:

```bash
# Text report to console
prompt-stress report --input results.json

# HTML report with charts
prompt-stress report --input results.json --format html --output report.html

# JSON export
prompt-stress report --input results.json --format json --output report.json
```

### Analyze Results

```bash
prompt-stress analyze <results> [options]
```

Options:
- `--json`: Output analysis as JSON

The analyze command provides:
- Performance score (0-100)
- Analysis of key metrics
- Actionable recommendations

Example:

```bash
prompt-stress analyze results.json
```

Output:
```
Load Test Analysis
==================================================

Performance Score: 85/100

Analysis:
  • Excellent error rate: minimal failures
  • Successfully achieved target RPS

Recommendations:
  • (none - performance is good)

Key Metrics:
  Total Requests:  300
  Success Rate:    99.7%
  Actual RPS:      4.98
  p50 Latency:     1250ms
  p95 Latency:     2100ms
  p99 Latency:     3500ms
```

## Prompts File Format

### JSON Format

```json
{
  "prompts": [
    {
      "prompt": "What is the capital of France?",
      "maxTokens": 100
    },
    {
      "prompt": "Explain quantum computing in simple terms.",
      "maxTokens": 500,
      "temperature": 0.7
    },
    {
      "prompt": "Write a haiku about {{topic}}.",
      "variables": {
        "topic": "programming"
      }
    }
  ],
  "defaults": {
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 256,
    "temperature": 0.7
  }
}
```

### Simple Array Format

```json
[
  "What is 2 + 2?",
  "Name three programming languages.",
  "What is the speed of light?"
]
```

### Text File Format

```text
What is the capital of France?
Explain quantum computing in simple terms.
Write a haiku about programming.
```

## Prompt Configuration

Each prompt can have:

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | string | The prompt text (required) |
| `model` | string | Model to use |
| `maxTokens` | number | Max output tokens |
| `temperature` | number | Sampling temperature (0-2) |
| `systemPrompt` | string | System prompt |
| `variables` | object | Template variables ({{key}}) |

## Results Format

```json
{
  "config": {
    "rps": 5,
    "duration": 60,
    "promptCount": 3
  },
  "summary": {
    "totalRequests": 300,
    "successCount": 298,
    "errorCount": 2,
    "errorRate": 0.67,
    "actualDuration": 60.12,
    "actualRps": 4.99
  },
  "latency": {
    "min": 450,
    "max": 5200,
    "mean": 1350,
    "median": 1200,
    "p50": 1200,
    "p90": 2100,
    "p95": 2800,
    "p99": 4500,
    "stdDev": 650
  },
  "tokens": {
    "totalInput": 15000,
    "totalOutput": 45000,
    "avgInputPerRequest": 50,
    "avgOutputPerRequest": 151
  },
  "errors": {
    "rate_limit": 1,
    "timeout": 1
  },
  "timeline": [...],
  "startTime": "2024-01-15T10:00:00.000Z",
  "endTime": "2024-01-15T10:01:00.000Z"
}
```

## Latency Percentiles

The tool tracks these percentiles:

- **p50 (median)**: 50% of requests completed faster
- **p90**: 90% of requests completed faster
- **p95**: 95% of requests completed faster
- **p99**: 99% of requests completed faster

Lower percentile values indicate better performance.

## Error Categories

Errors are automatically categorized:

| Category | Description |
|----------|-------------|
| `rate_limit` | API rate limit exceeded (429) |
| `timeout` | Request timeout |
| `authentication` | Auth failure (401) |
| `server_error` | Server errors (5xx) |
| `network_error` | Connection issues |
| `other` | Uncategorized errors |

## Best Practices

1. **Start low**: Begin with 1-2 RPS and gradually increase
2. **Monitor errors**: Stop if error rate exceeds 5%
3. **Check rate limits**: Anthropic API has rate limits per minute/day
4. **Use short prompts first**: Test with simple prompts before complex ones
5. **Save results**: Always use `--output` for later analysis

## API Usage

```typescript
import { LoadTester } from 'prompt-stress';

const tester = new LoadTester(process.env.ANTHROPIC_API_KEY);

const results = await tester.runTest({
  rps: 5,
  duration: 60,
  prompts: [
    { prompt: "Hello, world!", maxTokens: 100 }
  ],
  onProgress: (progress) => {
    console.log(`${progress.completedRequests} completed`);
  },
  onResult: (result) => {
    console.log(`Request ${result.promptIndex}: ${result.latency}ms`);
  }
});

console.log(`Total: ${results.summary.totalRequests}`);
console.log(`p95 Latency: ${results.latency.p95}ms`);
```

## License

MIT
