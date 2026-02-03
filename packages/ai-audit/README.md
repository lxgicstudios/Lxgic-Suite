# @lxgic/ai-audit

Audit trail for all AI interactions with SOC2/HIPAA compliance support.

## Installation

```bash
npm install -g @lxgic/ai-audit
# or
npx @lxgic/ai-audit
```

## Usage

### Start Audit Logging

```bash
ai-audit start
```

### Stop Audit Logging

```bash
ai-audit stop
```

### Log an Entry

```bash
ai-audit log "api_call" --user john --prompt "Hello" --model gpt-4 --status success
```

Options:
- `-u, --user <user>` - User performing the action
- `-p, --prompt <prompt>` - Prompt text (will be hashed for privacy)
- `-r, --response <response>` - Response text (will be hashed)
- `-m, --model <model>` - AI model used
- `-t, --tokens <tokens>` - Token count
- `-d, --duration <duration>` - Duration in milliseconds
- `-s, --status <status>` - Status (success/failure/pending)

### Generate Compliance Report

```bash
ai-audit report --period week
ai-audit report --period month --user john
```

Options:
- `-p, --period <period>` - Report period: day, week, month, year (default: week)
- `-u, --user <user>` - Filter by specific user

### Export Audit Data

```bash
ai-audit export --format json
ai-audit export --format csv --output audit.csv
```

Options:
- `-f, --format <format>` - Export format: json, csv (default: json)
- `-o, --output <path>` - Output file path

### Check Status

```bash
ai-audit status
```

## Global Options

- `--json` - Output in JSON format for programmatic use
- `--help` - Show help information
- `--version` - Show version number

## Compliance Features

### SOC2 Compliance
- Access controls logging
- Data integrity verification (content hashing)
- Complete audit trail
- Security event recording

### HIPAA Compliance
- Access logs availability
- PHI access tracking
- User identification
- Timestamp recording

## Data Storage

Audit data is stored in `.ai-audit.json` in the current working directory. The file contains:

- Version information
- Audit state (enabled/disabled)
- All audit entries with:
  - Unique ID
  - Timestamp
  - User identification
  - Action performed
  - Prompt hash (SHA-256)
  - Response hash (SHA-256)
  - Model information
  - Token counts
  - Duration metrics

## Example Output

```json
{
  "success": true,
  "entry": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "user": "john",
    "action": "api_call",
    "promptHash": "a1b2c3d4...",
    "status": "success"
  }
}
```

## Environment Variables

- `ANTHROPIC_API_KEY` - API key for Anthropic services (if needed)
- `USER` / `USERNAME` - Default user identification

## License

MIT
