# @lxgic/prompt-optimize

Analyze and suggest prompt improvements for better LLM performance.

## Installation

```bash
npm install -g @lxgic/prompt-optimize
# or
npx @lxgic/prompt-optimize
```

## Usage

### Analyze a Prompt

```bash
# Basic analysis
prompt-optimize analyze my-prompt.txt

# Detailed analysis with AI insights
prompt-optimize analyze my-prompt.txt --detailed

# Output as JSON
prompt-optimize analyze my-prompt.txt --json
```

### Get Suggestions

```bash
# General suggestions
prompt-optimize suggest my-prompt.txt

# Focus on specific goal
prompt-optimize suggest my-prompt.txt --goal clarity
prompt-optimize suggest my-prompt.txt --goal tokens
prompt-optimize suggest my-prompt.txt --goal performance

# Get more suggestions
prompt-optimize suggest my-prompt.txt --num 10

# Output as JSON
prompt-optimize suggest my-prompt.txt --json
```

### Rewrite a Prompt

```bash
# Auto-rewrite for better performance
prompt-optimize rewrite my-prompt.txt

# Rewrite with specific goal
prompt-optimize rewrite my-prompt.txt --goal tokens

# Save to file
prompt-optimize rewrite my-prompt.txt --output improved-prompt.txt

# Aggressive optimization
prompt-optimize rewrite my-prompt.txt --aggressive

# Preserve variable placeholders
prompt-optimize rewrite my-prompt.txt --preserve-variables

# Output as JSON
prompt-optimize rewrite my-prompt.txt --json
```

### Compare Original vs Optimized

```bash
# Compare prompts
prompt-optimize compare my-prompt.txt

# Compare with sample input to test outputs
prompt-optimize compare my-prompt.txt --input "Test input here"

# Output as JSON
prompt-optimize compare my-prompt.txt --json
```

## Commands

### `analyze <file>`

Analyze a prompt file for optimization opportunities.

**Options:**
- `-m, --model <model>` - Claude model to use (default: claude-sonnet-4-20250514)
- `-d, --detailed` - Include AI-powered detailed analysis
- `-j, --json` - Output results as JSON

**Output includes:**
- Statistics (characters, words, lines, estimated tokens)
- Structure analysis (role definition, examples, constraints, output format)
- Issues and suggestions
- Overall optimization score (0-100)

### `suggest <file>`

Get AI-powered suggestions to improve a prompt.

**Options:**
- `-m, --model <model>` - Claude model to use
- `-g, --goal <goal>` - Optimization goal: `clarity`, `tokens`, or `performance`
- `-n, --num <count>` - Number of suggestions (default: 5)
- `-j, --json` - Output results as JSON

### `rewrite <file>`

Auto-rewrite a prompt for better performance.

**Options:**
- `-m, --model <model>` - Claude model to use
- `-g, --goal <goal>` - Optimization goal (default: performance)
- `-o, --output <file>` - Save rewritten prompt to file
- `--preserve-variables` - Keep variable placeholders intact
- `--aggressive` - Apply more aggressive optimizations
- `-j, --json` - Output results as JSON

### `compare <file>`

Compare original and optimized prompt performance.

**Options:**
- `-m, --model <model>` - Claude model to use
- `-i, --input <input>` - Sample input to test with
- `-j, --json` - Output results as JSON

## Optimization Goals

### `clarity`
Focus on making instructions clearer and more unambiguous:
- Remove vague language
- Add specificity
- Improve structure
- Clarify expectations

### `tokens`
Focus on reducing token count while maintaining effectiveness:
- Remove redundant phrases
- Simplify language
- Compress instructions
- Eliminate filler words

### `performance`
Focus on improving overall prompt effectiveness:
- Better structure
- Clearer examples
- Improved constraints
- Enhanced output specifications

## Analysis Score

The analysis score (0-100) is based on:
- **Structure bonuses:**
  - System context/role defined: +15
  - Examples provided: +15
  - Constraints defined: +10
  - Output format specified: +10

- **Issue penalties:**
  - Errors: -15 each
  - Warnings: -10 each
  - Suggestions: -5 each

## Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required for AI-powered features)

## Examples

### Quick Analysis

```bash
prompt-optimize analyze prompts/summarizer.txt
```

Output:
```
=== Prompt Analysis ===

File: prompts/summarizer.txt
Score: 75/100

Statistics
  Characters: 450
  Words: 82
  Lines: 15
  Est. Tokens: ~113

Structure Analysis
  ✓ System context/role defined
  ✓ Examples provided
  ✗ Constraints/limitations defined
  ✗ Output format specified

Issues Found
  [SUGGESTION] [context]
    Consider adding constraints to limit response length.
```

### Full Optimization Workflow

```bash
# 1. Analyze current state
prompt-optimize analyze my-prompt.txt --detailed

# 2. Get suggestions
prompt-optimize suggest my-prompt.txt --goal performance

# 3. Auto-rewrite
prompt-optimize rewrite my-prompt.txt --output my-prompt-v2.txt

# 4. Compare results
prompt-optimize compare my-prompt.txt --input "Sample test input"
```

## License

MIT
