# prompt-fallback

Fallback chains across AI providers with automatic failover.

## Installation

```bash
npm install -g prompt-fallback
# or
npx prompt-fallback
```

## Features

- Define provider fallback chains
- Automatic failover on errors
- Provider health checking
- Cost-aware routing
- Response normalization across providers
- Support for Claude (primary), OpenAI, and mock (for testing)

## Usage

### Run Prompt with Fallback

```bash
# Basic usage - tries Claude first, falls back to OpenAI
prompt-fallback run prompt.txt

# Specify provider order
prompt-fallback run prompt.txt --providers claude,openai,mock

# With custom config file
prompt-fallback run prompt.txt --config fallback.yaml

# Cost-aware routing (cheapest provider first)
prompt-fallback run prompt.txt --cost-aware

# Verbose mode with JSON output
prompt-fallback run prompt.txt -v --json
```

### Test Provider Health

```bash
# Test all configured providers
prompt-fallback test-providers

# Test specific providers
prompt-fallback test-providers --providers claude,openai

# Get results as JSON
prompt-fallback test-providers --json
```

### View Configuration

```bash
# Show current config and available providers
prompt-fallback config

# Get config as JSON
prompt-fallback config --json
```

## Configuration

### Environment Variables

Set API keys for each provider:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...  # For Gemini
```

### YAML Configuration File

Create a `fallback.yaml` file:

```yaml
providers:
  - name: claude
    model: claude-sonnet-4-20250514
    priority: 1
  - name: openai
    model: gpt-4
    priority: 2
    env: OPENAI_API_KEY
  - name: mock
    model: mock-model
    priority: 99

timeout: 30000
retryAttempts: 1
costAware: false
```

### Provider Configuration Options

```yaml
providers:
  - name: claude           # Provider name (claude, openai, mock)
    model: claude-sonnet-4-20250514  # Model identifier
    priority: 1            # Lower = tried first
    envKey: ANTHROPIC_API_KEY  # Environment variable for API key
    enabled: true          # Whether provider is active
    maxTokens: 4096        # Maximum response tokens
    temperature: 0.7       # Generation temperature
    costPer1kInput: 0.003  # Cost per 1k input tokens
    costPer1kOutput: 0.015 # Cost per 1k output tokens
```

## Supported Providers

### Claude (Anthropic)
- **Environment Variable**: `ANTHROPIC_API_KEY`
- **Default Model**: `claude-sonnet-4-20250514`
- Primary recommended provider

### OpenAI
- **Environment Variable**: `OPENAI_API_KEY`
- **Default Model**: `gpt-4`
- Requires `openai` package: `npm install openai`

### Mock
- No API key required
- For testing fallback chains
- Returns simulated responses

## CLI Reference

```
Usage: prompt-fallback [command] [options]

Commands:
  run <promptFile>     Run a prompt through the fallback chain
  config               Show current configuration
  test-providers       Test health of configured providers
  help [command]       Display help for command

Options:
  -V, --version        Output the version number
  -h, --help           Display help for command
```

### run Options

```
-p, --providers <list>  Comma-separated provider list
-c, --config <file>     Path to YAML config file
-t, --timeout <ms>      Timeout per provider (default: "30000")
--cost-aware            Route to cheapest provider first
-v, --verbose           Show detailed execution information
--json                  Output result as JSON
```

### test-providers Options

```
-p, --providers <list>  Comma-separated provider list to test
-v, --verbose           Show detailed test information
--json                  Output as JSON
```

## JSON Output Format

### run Command

```json
{
  "success": true,
  "response": {
    "provider": "claude",
    "model": "claude-sonnet-4-20250514",
    "content": "Response content here...",
    "inputTokens": 25,
    "outputTokens": 150,
    "durationMs": 1500,
    "cost": 0.002325
  },
  "attemptedProviders": ["claude"],
  "errors": []
}
```

### test-providers Command

```json
{
  "success": true,
  "results": [
    {
      "provider": "claude",
      "healthy": true,
      "latencyMs": 450
    },
    {
      "provider": "openai",
      "healthy": true,
      "latencyMs": 380
    },
    {
      "provider": "mock",
      "healthy": true,
      "latencyMs": 1
    }
  ]
}
```

## Cost-Aware Routing

When `--cost-aware` flag is used, providers are sorted by cost instead of priority:

```bash
# This will try the cheapest provider first
prompt-fallback run prompt.txt --cost-aware
```

Provider costs can be configured in YAML:

```yaml
providers:
  - name: claude
    costPer1kInput: 0.003
    costPer1kOutput: 0.015
  - name: openai
    costPer1kInput: 0.03
    costPer1kOutput: 0.06
```

## Error Handling

When all providers fail, the tool returns detailed error information:

```
All providers failed:
  claude: Request failed with status 429
  openai: OpenAI package not installed
  mock: Connection timeout
```

In JSON mode:

```json
{
  "success": false,
  "response": null,
  "attemptedProviders": ["claude", "openai", "mock"],
  "errors": [
    { "provider": "claude", "error": "Request failed with status 429" },
    { "provider": "openai", "error": "OpenAI package not installed" },
    { "provider": "mock", "error": "Connection timeout" }
  ]
}
```

## License

MIT
