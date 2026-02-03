# @lxgic/prompt-policy

Enforce organizational prompt policies for AI interactions.

## Installation

```bash
npm install -g @lxgic/prompt-policy
# or
npx @lxgic/prompt-policy
```

## Usage

### Validate a Prompt File

```bash
prompt-policy validate prompt.txt
prompt-policy validate prompt.txt --policy strict
prompt-policy validate prompt.txt --config ./my-policy.json
```

### Initialize Policy Configuration

```bash
prompt-policy init
prompt-policy init --directory ./config
```

### List Available Policies

```bash
prompt-policy list-policies
```

### Show Policy Details

```bash
prompt-policy show-policy strict
prompt-policy show-policy moderate
```

### Validate Text Directly

```bash
prompt-policy check-text "Your prompt text here"
```

## Built-in Policies

### Strict
For production environments with maximum security:
- Max 2000 tokens
- Min 10 tokens
- Required context and instruction sections
- No PII patterns (SSN, email)
- No jailbreak keywords
- No harmful content keywords

### Moderate
Balanced for general development:
- Max 4000 tokens
- Min 5 tokens (warning)
- No SSN patterns
- No jailbreak keywords

### Permissive
For testing and development:
- Max 8000 tokens (warning)
- Basic jailbreak protection

## Policy Rules

| Type | Description |
|------|-------------|
| maxTokens | Maximum allowed token count |
| minTokens | Minimum required token count |
| maxLineLength | Maximum characters per line |
| requiredSection | Required text sections |
| forbiddenWord | Blocked words/phrases |
| pattern | Regex patterns to block |

## Custom Policy Configuration

Create a `.prompt-policy.json` file:

```json
{
  "name": "custom",
  "description": "My custom policy",
  "extends": "moderate",
  "rules": [
    {
      "id": "max-tokens",
      "value": 3000,
      "enabled": true
    }
  ],
  "customRules": [
    {
      "id": "no-competitor-names",
      "name": "No Competitor Names",
      "description": "Block competitor product mentions",
      "type": "forbiddenWord",
      "value": ["CompetitorA", "CompetitorB"],
      "severity": "warning",
      "enabled": true
    }
  ]
}
```

## CI/CD Integration

Use in CI pipelines to enforce prompt quality:

```bash
# Validate all prompt files
for file in ./prompts/*.txt; do
  prompt-policy validate "$file" --policy strict --ci
done

# With JSON output for parsing
prompt-policy validate prompt.txt --policy strict --json
```

Exit codes:
- `0` - Valid (no errors)
- `1` - Invalid (has errors)

## Options

### Global Options
- `--json` - Output in JSON format for programmatic use
- `--help` - Show help information
- `--version` - Show version number

### Validate Options
- `-p, --policy <name>` - Policy to use (default: moderate)
- `-c, --config <path>` - Custom policy config file
- `--ci` - CI mode (exit with error code on violations)

## Example Output

```json
{
  "valid": false,
  "policy": "strict",
  "violations": [
    {
      "ruleId": "max-tokens",
      "ruleName": "Maximum Token Limit",
      "severity": "error",
      "message": "Token count (2500) exceeds maximum (2000)"
    }
  ],
  "summary": {
    "totalViolations": 1,
    "errors": 1,
    "warnings": 0,
    "info": 0
  },
  "metrics": {
    "tokenCount": 2500,
    "lineCount": 45,
    "charCount": 10000,
    "avgLineLength": 222
  }
}
```

## Severity Levels

- **error** - Validation fails, prompt should not be used
- **warning** - Potential issue, review recommended
- **info** - Informational, no action required

## Environment Variables

- `CI` - When set, enables CI mode automatically
- `ANTHROPIC_API_KEY` - API key for Anthropic services (if needed)

## License

MIT
