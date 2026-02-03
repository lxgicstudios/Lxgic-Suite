# @lxgic/prompt-playground

Interactive CLI prompt testing environment (REPL) for testing and iterating on prompts with Claude models.

## Installation

```bash
npm install -g @lxgic/prompt-playground
# or
npx @lxgic/prompt-playground
```

## Usage

### Start the Playground

```bash
# Start with default settings
prompt-playground

# Start with specific model
prompt-playground --model claude-3-haiku-20240307

# Start with custom temperature
prompt-playground --temperature 0.5

# Start with system prompt
prompt-playground --system "You are a helpful coding assistant"

# Load a saved session
prompt-playground --load session.json

# JSON output mode (for programmatic use)
prompt-playground --json
```

### REPL Commands

Once in the playground, you can use these commands:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model <name>` | Change the model |
| `/temp <value>` | Set temperature (0-1) |
| `/system <prompt>` | Set system prompt |
| `/save [file]` | Save session to file or internal store |
| `/load <source>` | Load session from file or session ID |
| `/history` | Show conversation history |
| `/clear` | Clear conversation history |
| `/config` | Show current configuration |
| `/stats` | Show session statistics |
| `/sessions` | List saved sessions |
| `/exit` | Exit the playground |

### Multiline Mode

For entering multi-line prompts:

1. Type `>>>` and press Enter to start multiline mode
2. Enter your prompt across multiple lines
3. Type `<<<` and press Enter to submit

### Example Session

```
$ prompt-playground --model claude-3-5-sonnet-20241022

  Prompt Playground
  Interactive prompt testing environment

  Type /help for available commands

> [0 tokens] /model
Current model: claude-3-5-sonnet-20241022

Available models:
  - claude-3-5-sonnet-20241022
  - claude-3-5-haiku-20241022
  - claude-3-opus-20240229
  - claude-3-sonnet-20240229
  - claude-3-haiku-20240307

> [0 tokens] /system You are a Python expert who writes clean, well-documented code.
System prompt set (15 tokens estimated)

> [12 tokens] Write a function to calculate fibonacci numbers