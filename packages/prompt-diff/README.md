# @lxgic/prompt-diff

Compare prompt versions and their outputs side-by-side.

## Installation

```bash
npm install -g @lxgic/prompt-diff
# or
npx @lxgic/prompt-diff
```

## Usage

### Compare Two Prompts

```bash
# Basic diff
prompt-diff diff prompt-v1.txt prompt-v2.txt

# With sample input to test
prompt-diff diff prompt-v1.txt prompt-v2.txt --sample-input "Hello world"

# Run both through Claude and compare outputs
prompt-diff diff prompt-v1.txt prompt-v2.txt --run --sample-input "Hello world"

# Use a specific model
prompt-diff diff prompt-v1.txt prompt-v2.txt --model claude-opus-4-20250514 --run

# Output as JSON
prompt-diff diff prompt-v1.txt prompt-v2.txt --json
```

### Get Prompt Statistics

```bash
# Show stats for a prompt file
prompt-diff stats my-prompt.txt

# Output as JSON
prompt-diff stats my-prompt.txt --json
```

## Commands

### `diff <file1> <file2>`

Compare two prompt files and show the differences.

**Options:**
- `-m, --model <model>` - Claude model to use (default: claude-sonnet-4-20250514)
- `-i, --sample-input <input>` - Sample input to test prompts with
- `-r, --run` - Run both prompts through Claude and compare outputs
- `-c, --context <lines>` - Number of context lines in diff (default: 3)
- `-j, --json` - Output results as JSON

### `stats <file>`

Show statistics for a prompt file including character count, word count, estimated tokens, and detected variables.

**Options:**
- `-j, --json` - Output results as JSON

## Output

### Text Diff

Shows additions in green and deletions in red:

```
- This line was removed
+ This line was added
  This line is unchanged
```

### Token Analysis

Shows token count for each prompt and the difference:

```
Token Analysis:
  File 1: ~250 tokens
  File 2: ~180 tokens
  Change: -70 tokens (-28%)
```

### Output Comparison (with --run)

When using the `--run` flag, the tool will:
1. Run both prompts through Claude with the same input
2. Show the output from each prompt
3. Display a diff of the outputs
4. Show timing and token usage statistics

## Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required for --run)

## Examples

### Compare prompt versions

```bash
# Simple comparison
prompt-diff diff prompts/v1.txt prompts/v2.txt

# Full comparison with output
prompt-diff diff prompts/v1.txt prompts/v2.txt \
  --run \
  --sample-input "Summarize the following article: ..." \
  --model claude-sonnet-4-20250514
```

### JSON output for automation

```bash
# Get JSON output for CI/CD pipelines
prompt-diff diff prompts/v1.txt prompts/v2.txt --json > diff-report.json
```

## License

MIT
