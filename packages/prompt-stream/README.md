# prompt-stream

Stream AI responses to stdout with real-time output.

## Installation

```bash
npm install -g prompt-stream
# or
npx prompt-stream
```

## Features

- Real-time streaming output
- Pipe-friendly (stdout)
- Support for different output formats
- Token counting during stream
- Interrupt handling (Ctrl+C)
- Read prompts from files or stdin

## Usage

### Basic Streaming

```bash
# Stream a simple query
prompt-stream "Explain quantum computing"

# Using the alias
stream "Explain quantum computing"

# Pipe output to a file
prompt-stream "Write a poem about coding" | tee output.txt
```

### Reading from File

```bash
# Read prompt from a file
prompt-stream --file prompt.txt

# Or short form
stream -f prompt.txt
```

### Reading from Stdin

```bash
# Pipe content to the command
echo "Summarize this text" | prompt-stream --stdin

# Or from a file via stdin
cat document.txt | prompt-stream --stdin
```

### Output Formats

```bash
# Plain text (default)
stream "Hello" --format text

# JSON output with metadata
stream "Hello" --json

# Raw output (no formatting)
stream "Hello" --format raw

# Markdown format
stream "Hello" --format markdown
```

### Options

```bash
# Custom model
stream "Query" --model claude-sonnet-4-20250514

# Set max tokens
stream "Query" --max-tokens 2048

# Set temperature
stream "Query" --temperature 0.5

# Add system prompt
stream "Query" --system "You are a helpful coding assistant"

# Show token statistics
stream "Query" --tokens

# Full JSON output with metadata
stream "Query" --json
```

### Combining with Other Tools

```bash
# Save output and display
prompt-stream "Explain REST APIs" | tee api-explanation.txt

# Process output with other tools
prompt-stream "List 10 programming languages" | grep -i python

# Chain multiple operations
cat question.txt | prompt-stream --stdin | tee answer.txt
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required. Your Anthropic API key.

## CLI Reference

```
Usage: prompt-stream [options] [query]

Stream AI responses to stdout with real-time output

Arguments:
  query                      The prompt to send to the AI

Options:
  -V, --version              output the version number
  -f, --file <path>          Read prompt from file
  -s, --stdin                Read prompt from stdin
  -m, --model <model>        Model to use (default: "claude-sonnet-4-20250514")
  --max-tokens <number>      Maximum tokens in response (default: "4096")
  -t, --temperature <number> Temperature (0-1) (default: "0.7")
  --system <prompt>          System prompt
  --format <format>          Output format: text, json, markdown, raw (default: "text")
  --tokens                   Show token count and statistics
  --json                     Output result as JSON (includes metadata)
  -h, --help                 display help for command
```

## JSON Output Format

When using `--json` flag:

```json
{
  "success": true,
  "prompt": "Explain quantum computing...",
  "result": {
    "content": "Quantum computing is...",
    "inputTokens": 10,
    "outputTokens": 150,
    "totalTokens": 160,
    "finishReason": "end_turn",
    "durationMs": 2500
  }
}
```

## Interrupt Handling

Press `Ctrl+C` to interrupt streaming. When using `--tokens` flag, statistics up to the point of interruption will be displayed.

## License

MIT
