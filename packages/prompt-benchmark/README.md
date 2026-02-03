# @lxgic/prompt-benchmark

Benchmark prompt latency and quality across Claude models. Measure performance, compare prompts, and analyze costs.

## Installation

```bash
npm install -g @lxgic/prompt-benchmark
# or
npx @lxgic/prompt-benchmark
```

## Usage

### Run Benchmark

Benchmark a prompt file across one or more models:

```bash
# Basic benchmark
prompt-benchmark run prompt.txt

# Multiple iterations
prompt-benchmark run prompt.txt --iterations 20

# Multiple models
prompt-benchmark run prompt.txt --models claude-3-5-sonnet-20241022,claude-3-haiku-20240307

# Custom settings
prompt-benchmark run prompt.txt \
  --iterations 10 \
  --models claude-3-5-sonnet-20241022 \
  --temperature 0.5 \
  --max-tokens 2048

# Save results
prompt-benchmark run prompt.txt --output results.json

# JSON output
prompt-benchmark run prompt.txt --json
```

### Compare Prompts

Compare two different prompts to see which performs better:

```bash
# Basic comparison
prompt-benchmark compare prompt-v1.txt prompt-v2.txt

# With more iterations
prompt-benchmark compare prompt-v1.txt prompt-v2.txt --iterations 10

# Specific model
prompt-benchmark compare prompt-v1.txt prompt-v2.txt --model claude-3-haiku-20240307

# Save comparison results
prompt-benchmark compare prompt-v1.txt prompt-v2.txt --output comparison.json
```

### Prompt File Format

Prompts can be plain text or include YAML frontmatter for system prompts:

**Plain text:**
```
Write a haiku about programming.
```

**With frontmatter:**
```yaml
---
system: "You are a creative poet who writes concise, beautiful poetry."
---
Write a haiku about programming.
```

## Output

### Benchmark Report

The benchmark produces a detailed report including:

- **Summary**: Total runs, success rate, total time and cost
- **Latency**: Average, median (p50), p95, p99, min, max, standard deviation
- **Token Throughput**: Average input/output tokens, tokens per second
- **Cost Per Run**: Average, min, max cost estimates
- **Latency Distribution**: ASCII histogram of latency values

### Model Comparison

When benchmarking multiple models, a comparison table shows:

| Metric | Value |
|--------|-------|
| p50 Latency | Median response time |
| TPS | Tokens per second |
| Cost | Average cost per run |

Best values are highlighted in green.

### Prompt Comparison

When comparing two prompts, the report shows:

- Side-by-side metrics for both prompts
- Percentage difference for each metric
- Summary of which prompt is faster/cheaper

## Example Output

```
  Benchmark Results
  ============================================================

  Model: claude-3-5-sonnet-20241022

  Summary
  ----------------------------------------
  Successful Runs:    10/10
  Total Time:         12.45s
  Total Cost:         $0.0234

  Latency
  ----------------------------------------
  Average:            1.24s
  Median (p50):       1.18s
  p95:                1.89s
  p99:                2.01s
  Min:                0.98s
  Max:                2.01s
  Std Dev:            0.31s

  Token Throughput
  ----------------------------------------
  Avg Input Tokens:   125
  Avg Output Tokens:  487
  Avg Tokens/sec:     392.4

  Cost Per Run
  ----------------------------------------
  Average:            $0.0023
  Min:                $0.0019
  Max:                $0.0028

  Latency Distribution
  ----------------------------------------
  980-1108ms       ████████████░░░░░░░░░░░░░ 3
  1108-1236ms      ████████████████████░░░░░ 4
  1236-1364ms      ████████░░░░░░░░░░░░░░░░░ 2
  1364-1492ms      ░░░░░░░░░░░░░░░░░░░░░░░░░ 0
  1492-1620ms      ░░░░░░░░░░░░░░░░░░░░░░░░░ 0
  1620-1748ms      ░░░░░░░░░░░░░░░░░░░░░░░░░ 0
  1748-1876ms      ░░░░░░░░░░░░░░░░░░░░░░░░░ 0
  1876-2004ms      ████░░░░░░░░░░░░░░░░░░░░░ 1
```

## Options

### `run` Command

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --iterations` | Number of benchmark iterations | 10 |
| `-m, --models` | Comma-separated list of models | claude-3-5-sonnet-20241022 |
| `-t, --temperature` | Temperature for generation | 0.7 |
| `--max-tokens` | Maximum tokens in response | 1024 |
| `--warmup` | Number of warmup iterations | 1 |
| `-o, --output` | Save results to file | - |
| `--json` | Output in JSON format | false |

### `compare` Command

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --iterations` | Number of iterations per prompt | 5 |
| `-m, --model` | Model to use for comparison | claude-3-5-sonnet-20241022 |
| `-t, --temperature` | Temperature for generation | 0.7 |
| `--max-tokens` | Maximum tokens in response | 1024 |
| `-o, --output` | Save results to file | - |
| `--json` | Output in JSON format | false |

## Supported Models

- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

## License

MIT
