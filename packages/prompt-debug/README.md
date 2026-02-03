# @lxgic/prompt-debug

Step-through debugger for prompt execution. Debug and analyze your prompts interactively before sending them to the API.

## Installation

```bash
npm install -g @lxgic/prompt-debug
# or
npx @lxgic/prompt-debug <command>
```

## Features

- Parse prompts into segments (system, user, assistant, examples, context)
- Step through execution showing each segment
- View token counts at each step
- Edit prompt segments interactively
- Set breakpoints by segment index or type
- View intermediate API responses
- Export results as JSON

## Usage

### Step Through a Prompt

```bash
# Interactive step-through debugging
prompt-debug step my-prompt.md

# Specify model
prompt-debug step my-prompt.md --model claude-3-opus-20240229
```

### Run with Breakpoints

```bash
# Break at specific segment indices
prompt-debug run my-prompt.md --breakpoints 0,2,4

# Break at segment types
prompt-debug run my-prompt.md --breakpoints system,user

# Mixed breakpoints
prompt-debug run my-prompt.md --breakpoints 0,user,3
```

### Parse Without Execution

```bash
# View parsed segments without API calls
prompt-debug parse my-prompt.md
```

### JSON Output

```bash
# Get structured JSON output
prompt-debug step my-prompt.md --json
prompt-debug run my-prompt.md --breakpoints 0,2 --json
prompt-debug parse my-prompt.md --json
```

## Prompt Format

The debugger recognizes several segment markers:

```markdown
# System
You are a helpful assistant.

# User
What is the capital of France?

# Assistant
The capital of France is Paris.

# Example
Input: What is 2+2?
Output: 4

# Context
Additional context information here.
```

Also supports:
- `## section` headers
- `[section]` brackets
- `<section>` XML-style tags

## Interactive Commands

When in step-through mode:

| Command | Description |
|---------|-------------|
| `step`, `s`, `n` | Move to next segment |
| `back`, `b` | Move to previous segment |
| `goto <n>` | Jump to segment n |
| `run`, `r` | Run to end and execute |
| `execute`, `e` | Execute up to current segment |
| `edit` | Edit current segment |
| `view` | View all segments |
| `view <n>` | View segment n |
| `tokens` | Show token analysis |
| `history` | Show execution history |
| `help`, `?` | Show help |
| `quit`, `q` | Exit debugger |

## API Configuration

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Examples

### Basic Debugging Session

```bash
$ prompt-debug step examples/chat.md
=== Prompt Debugger ===
File: examples/chat.md
Model: claude-3-5-sonnet-20241022
Segments: 3
Total tokens: ~150

[0] SYSTEM
Lines 1-3 | ~45 tokens
----------------------------------------
You are a helpful assistant specialized in coding.

[0/2] > step

[1] USER
Lines 5-7 | ~30 tokens
----------------------------------------
How do I reverse a string in Python?

[1/2] > execute
Executing prompt...
=== Response ===
Here's how to reverse a string in Python...
```

### JSON Output

```bash
$ prompt-debug parse examples/chat.md --json
{
  "file": "examples/chat.md",
  "segments": [
    {
      "type": "system",
      "content": "You are a helpful assistant.",
      "tokenCount": 8,
      "lineStart": 1,
      "lineEnd": 3
    },
    {
      "type": "user",
      "content": "Hello!",
      "tokenCount": 2,
      "lineStart": 5,
      "lineEnd": 5
    }
  ],
  "totalTokens": 10
}
```

## License

MIT
