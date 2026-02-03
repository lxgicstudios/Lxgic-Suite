# ai-retry

Smart retry with exponential backoff for commands and scripts.

## Installation

```bash
npm install -g ai-retry
# or
npx ai-retry
```

## Features

- Exponential, linear, constant, and decorrelated-jitter backoff strategies
- Configurable maximum attempts and delays
- Jitter support to prevent thundering herd
- Timeout handling for long-running commands
- Wrap any command or script with retry logic
- Detailed attempt history and statistics

## Usage

### Execute Command with Retry

```bash
# Basic retry with defaults (3 attempts, exponential backoff)
ai-retry exec curl https://api.example.com/data

# Specify maximum attempts
ai-retry exec --max-attempts 5 npm publish

# Custom backoff strategy
ai-retry exec --backoff linear node my-script.js

# With verbose output
ai-retry exec -v --max-attempts 3 python process.py
```

### Wrap Scripts

```bash
# Wrap a JavaScript file
ai-retry wrap ./my-script.js

# Wrap a Python script
ai-retry wrap ./data-processor.py --max-attempts 5

# Wrap a shell script with custom backoff
ai-retry wrap ./deploy.sh --backoff decorrelated-jitter
```

### Backoff Strategies

```bash
# Exponential (default): delay doubles each attempt
ai-retry exec --backoff exponential curl https://api.example.com

# Linear: delay increases by base amount each attempt
ai-retry exec --backoff linear curl https://api.example.com

# Constant: same delay between all attempts
ai-retry exec --backoff constant curl https://api.example.com

# Decorrelated jitter: AWS-style randomized backoff
ai-retry exec --backoff decorrelated-jitter curl https://api.example.com
```

### Configuration

```bash
# List all available strategies
ai-retry config --list

# Show details for a specific strategy
ai-retry config --backoff exponential

# Get config as JSON
ai-retry config --list --json
```

### Advanced Options

```bash
# Custom base delay (1 second default)
ai-retry exec --base-delay 2000 curl https://api.example.com

# Custom maximum delay cap (30 seconds default)
ai-retry exec --max-delay 60000 curl https://api.example.com

# Command timeout (60 seconds default)
ai-retry exec --timeout 120000 npm run build

# Disable jitter
ai-retry exec --no-jitter curl https://api.example.com

# Only retry on specific exit codes
ai-retry exec --retry-on "1,2,124" curl https://api.example.com

# JSON output
ai-retry exec --json curl https://api.example.com
```

## Retry Strategies Explained

### Exponential Backoff

```
Attempt 1: delay = baseDelay (1s)
Attempt 2: delay = baseDelay * 2 (2s)
Attempt 3: delay = baseDelay * 4 (4s)
Attempt 4: delay = baseDelay * 8 (8s)
```

Best for: Rate limiting, API calls, network requests

### Linear Backoff

```
Attempt 1: delay = baseDelay (1s)
Attempt 2: delay = baseDelay * 2 (2s)
Attempt 3: delay = baseDelay * 3 (3s)
Attempt 4: delay = baseDelay * 4 (4s)
```

Best for: Moderate load scenarios, gradual recovery

### Constant Backoff

```
Attempt 1: delay = baseDelay (1s)
Attempt 2: delay = baseDelay (1s)
Attempt 3: delay = baseDelay (1s)
```

Best for: Simple retry scenarios, known recovery times

### Decorrelated Jitter

```
Attempt 1: delay = baseDelay (1s)
Attempt 2: delay = random(baseDelay, previousDelay * 3)
Attempt 3: delay = random(baseDelay, previousDelay * 3)
```

Best for: Distributed systems, preventing thundering herd

## CLI Reference

```
Usage: ai-retry [command] [options]

Commands:
  exec <command> [args...]  Execute a command with retry logic
  wrap <script>             Wrap a script file with retry logic
  config                    Show or set retry configuration
  help [command]            Display help for command

Options:
  -V, --version             Output the version number
  -h, --help                Display help for command
```

### exec Options

```
-n, --max-attempts <number>  Maximum retry attempts (default: "3")
-b, --backoff <strategy>     Backoff strategy (default: "exponential")
--base-delay <ms>            Base delay in milliseconds (default: "1000")
--max-delay <ms>             Maximum delay in milliseconds (default: "30000")
-t, --timeout <ms>           Command timeout in milliseconds (default: "60000")
--jitter                     Enable jitter (default: true)
--jitter-factor <factor>     Jitter factor 0-1 (default: "0.1")
--retry-on <codes>           Comma-separated exit codes to retry on
-v, --verbose                Show detailed retry information
--json                       Output result as JSON
```

## JSON Output Format

When using `--json` flag:

```json
{
  "success": false,
  "command": "curl",
  "args": ["https://api.example.com"],
  "result": {
    "attempts": 3,
    "totalDuration": "6.5s",
    "totalDurationMs": 6500,
    "lastExitCode": 7,
    "attemptHistory": [
      {
        "attempt": 1,
        "exitCode": 7,
        "duration": "1.2s",
        "durationMs": 1200,
        "delayBefore": "0ms",
        "delayBeforeMs": 0
      },
      {
        "attempt": 2,
        "exitCode": 7,
        "duration": "1.1s",
        "durationMs": 1100,
        "delayBefore": "1.0s",
        "delayBeforeMs": 1000
      },
      {
        "attempt": 3,
        "exitCode": 7,
        "duration": "1.0s",
        "durationMs": 1000,
        "delayBefore": "2.0s",
        "delayBeforeMs": 2000
      }
    ]
  }
}
```

## Exit Codes

- `0` - Command succeeded
- `1-125` - Command failed with that exit code
- `124` - Command timed out
- `127` - Command not found
- `130` - Interrupted (Ctrl+C)

## License

MIT
