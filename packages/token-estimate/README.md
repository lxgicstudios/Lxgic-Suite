# token-estimate

Estimate cost before execution - calculate token counts and costs for AI models.

## Installation

```bash
npm install -g token-estimate
# or
npx token-estimate
```

## Features

- **Estimate Input Tokens**: Calculates approximate token count for text and code files
- **Estimate Output Tokens**: Configurable output ratio for predicting response size
- **Calculate Cost Per Model**: Get precise cost estimates for specific AI models
- **Compare Costs Across Models**: Side-by-side comparison of all supported models
- **Current Pricing Data**: Up-to-date pricing for Claude, GPT-4, and Gemini models

## CLI Commands

### Estimate

Estimate tokens and cost for a single file:

```bash
# Basic estimation with default model (Claude 3.5 Sonnet)
token-estimate estimate ./prompt.txt

# Specify a model
token-estimate estimate ./prompt.txt --model claude-3-opus

# Adjust output ratio (default is 1.5x input)
token-estimate estimate ./prompt.txt --model gpt-4o --output-ratio 2.0

# JSON output
token-estimate estimate ./prompt.txt --json
```

### Compare

Compare costs across all available models:

```bash
# Compare all models
token-estimate compare ./prompt.txt

# With custom output ratio
token-estimate compare ./prompt.txt --output-ratio 2.0

# JSON output
token-estimate compare ./prompt.txt --json
```

### Batch

Estimate tokens for all files in a directory:

```bash
# Process current directory
token-estimate batch ./src

# Recursive processing
token-estimate batch ./src --recursive

# JSON output
token-estimate batch ./src -r --json
```

### List Models

Show all available models and their pricing:

```bash
token-estimate models
token-estimate models --json
```

## Supported Models

| Model | Provider | Input ($/1M) | Output ($/1M) |
|-------|----------|--------------|---------------|
| claude-3-opus | Anthropic | $15.00 | $75.00 |
| claude-3-sonnet | Anthropic | $3.00 | $15.00 |
| claude-3-haiku | Anthropic | $0.25 | $1.25 |
| claude-3.5-sonnet | Anthropic | $3.00 | $15.00 |
| gpt-4-turbo | OpenAI | $10.00 | $30.00 |
| gpt-4o | OpenAI | $5.00 | $15.00 |
| gpt-4o-mini | OpenAI | $0.15 | $0.60 |
| gpt-3.5-turbo | OpenAI | $0.50 | $1.50 |
| gemini-1.5-pro | Google | $3.50 | $10.50 |
| gemini-1.5-flash | Google | $0.075 | $0.30 |

## Output Examples

### Estimate Output

```
Token Estimation

File: /path/to/prompt.txt

Model: Claude 3.5 Sonnet
Provider: Anthropic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input Tokens:  1,250
Output Tokens: 1,875 (estimated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input Cost:    $0.0038
Output Cost:   $0.0281
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Cost:    $0.0319
```

### Compare Output

```
┌─────────────────────────┬──────────┬───────────────┬───────────────┬───────────────┐
│ Model                   │ Provider │ Input Cost    │ Output Cost   │ Total Cost    │
├─────────────────────────┼──────────┼───────────────┼───────────────┼───────────────┤
│ gemini-1.5-flash        │ Google   │      $0.0001  │      $0.0006  │      $0.0007  │
│ gpt-4o-mini             │ OpenAI   │      $0.0002  │      $0.0011  │      $0.0013  │
│ claude-3-haiku          │ Anthropic│      $0.0003  │      $0.0023  │      $0.0026  │
└─────────────────────────┴──────────┴───────────────┴───────────────┴───────────────┘

Cheapest: gemini-1.5-flash at $0.0007
Most expensive: claude-3-opus at $0.1594
Potential savings: 99.6% by choosing gemini-1.5-flash
```

## Programmatic Usage

```typescript
import { estimate, compare, batch } from 'token-estimate';

// Estimate for a single file
const result = estimate('./prompt.txt', 'claude-3.5-sonnet', 1.5);
console.log(result.totalCost);

// Compare across models
const comparison = compare('./prompt.txt');
console.log(comparison[0]); // Cheapest option

// Batch processing
const batchResults = batch('./src', true);
console.log(batchResults);
```

## Token Estimation Algorithm

The tool uses a hybrid approach for token estimation:

1. **Word-based estimation**: ~0.75 tokens per word for English text
2. **Character-based estimation**: ~4 characters per token
3. **Code adjustment**: ~3.5 characters per token for code files

The final estimate averages these approaches for accuracy.

## License

MIT
