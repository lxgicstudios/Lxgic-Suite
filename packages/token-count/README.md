# @lxgic/token-count

Count tokens for any text/prompt with accurate estimation for Claude and other AI models.

## Installation

```bash
npm install -g @lxgic/token-count
# or
npx @lxgic/token-count
```

## Usage

### Count tokens in text

```bash
# Direct text input
token-count count "Hello, world! This is a test prompt."

# From a file
token-count count ./my-prompt.txt

# From stdin
echo "Hello, world!" | token-count count --stdin
cat prompt.txt | token-count count --stdin
```

### Show section breakdown

```bash
token-count count ./prompt.txt --breakdown
```

### Compare across models

```bash
token-count count "Your text here" --compare
```

### Batch processing

```bash
# Multiple files
token-count batch file1.txt file2.txt file3.txt

# With glob patterns
token-count batch "*.txt" "prompts/*.md"
```

### Quick estimate

```bash
token-count estimate "Quick text to estimate"
```

### Model comparison

```bash
token-count compare ./large-prompt.txt
```

## Options

- `--breakdown, -b` - Show token breakdown by section
- `--compare, -c` - Compare token counts across models
- `--stdin` - Read input from stdin
- `--json` - Output in JSON format
- `--help` - Show help

## Output Example

```
Token Count Results
──────────────────────────────────────────────────
Input:       ./prompt.txt
Tokens:      1.2K (1,234)
Characters:  5,432
Words:       876
Lines:       45
Ratio:       4.4 chars/token

Section Breakdown
──────────────────────────────────────────────────
System prompt                      456 tokens (37%)
  ███████
User context                       389 tokens (32%)
  ██████
Examples                           389 tokens (31%)
  ██████

Model Comparison
──────────────────────────────────────────────────
claude-3-opus              1234 tokens      $0.0185
claude-3-sonnet            1234 tokens      $0.0037
claude-3-haiku             1234 tokens      $0.0003
gpt-4                      1234 tokens      $0.0370
gpt-4-turbo                1234 tokens      $0.0123
gpt-3.5-turbo              1234 tokens      $0.0006
```

## Supported Models

- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku
- Claude 3.5 Sonnet
- GPT-4
- GPT-4 Turbo
- GPT-3.5 Turbo

## API Usage

```typescript
import { countText, countFile, countBatch } from '@lxgic/token-count';

// Count text
const result = countText('Hello, world!', { breakdown: true, compare: true });
console.log(result.stats.total); // Token count

// Count file
const fileResult = countFile('./prompt.txt');

// Batch processing
const batchResult = countBatch(['file1.txt', 'file2.txt']);
console.log(batchResult.totalTokens);
```

## License

MIT
