# @lxgic/ai-redact

Redact sensitive data from AI outputs to protect privacy and ensure compliance.

## Installation

```bash
npm install -g @lxgic/ai-redact
# or
npx @lxgic/ai-redact
```

## Usage

### Redact a File

```bash
ai-redact redact document.txt
ai-redact redact document.txt --output redacted.txt
ai-redact redact document.txt --patterns ssn,email,phone
```

### Redact from Stdin

```bash
echo "Call me at 555-123-4567" | ai-redact redact --stdin
cat ai-output.txt | ai-redact redact --stdin
```

### Preview Redactions

```bash
ai-redact redact document.txt --preview
```

### Batch Redact Directory

```bash
ai-redact batch ./outputs
ai-redact batch ./outputs --extension .json --output-dir ./redacted
```

### List Available Patterns

```bash
ai-redact patterns
ai-redact patterns --category pii
```

## Redaction Patterns

### PII (Personally Identifiable Information)
- `ssn` - Social Security Numbers (XXX-XX-XXXX)
- `ssn_compact` - SSN without dashes
- `email` - Email addresses
- `phone` - US phone numbers
- `phone_intl` - International phone numbers
- `address` - Street addresses
- `zip` - US ZIP codes
- `passport` - Passport numbers
- `drivers_license` - Driver's license numbers
- `name` - Names with titles (Mr., Mrs., Dr.)

### PHI (Protected Health Information)
- `dob` - Dates of birth (MM/DD/YYYY)
- `dob_iso` - Dates of birth (YYYY-MM-DD)
- `mrn` - Medical Record Numbers

### Financial
- `credit_card` - Credit card numbers
- `credit_card_spaced` - Credit cards with spaces/dashes
- `bank_account` - Bank account numbers
- `routing` - Bank routing numbers

### Technical
- `ip` - IPv4 addresses
- `api_key` - API keys and tokens
- `aws_key` - AWS access keys

## Options

### Global Options
- `--json` - Output in JSON format for programmatic use
- `--help` - Show help information
- `--version` - Show version number

### Redact Command Options
- `--stdin` - Read input from stdin
- `-p, --patterns <patterns>` - Comma-separated list of patterns to apply
- `-o, --output <file>` - Output file path
- `--show-length` - Show original length of redacted content
- `--preview` - Preview redactions without applying

### Batch Command Options
- `-p, --patterns <patterns>` - Patterns to apply
- `-e, --extension <ext>` - File extension to process (default: .txt)
- `-o, --output-dir <dir>` - Output directory for redacted files

## Example Output

```json
{
  "redacted": "Contact: [EMAIL] or call [PHONE]",
  "summary": {
    "totalRedactions": 2,
    "byPattern": {
      "email": 1,
      "phone": 1
    },
    "byCategory": {
      "pii": 2
    },
    "charactersRedacted": 35
  }
}
```

## CI/CD Integration

Use in pipelines to sanitize AI outputs:

```bash
# Redact and save
ai-redact redact ai-response.txt --output sanitized.txt --json

# Batch process with specific patterns
ai-redact batch ./ai-outputs --patterns ssn,credit_card --output-dir ./safe-outputs
```

## Programmatic Usage

```typescript
import { AIRedactor } from '@lxgic/ai-redact';

const redactor = new AIRedactor();

// Redact text
const result = redactor.redact('Email: john@example.com, SSN: 123-45-6789');
console.log(result.redacted);
// "Email: [EMAIL], SSN: [SSN]"

// Preview before redacting
const preview = redactor.previewRedactions(text);
console.log(preview);

// Use specific patterns
const result = redactor.redact(text, { patterns: ['ssn', 'email'] });
```

## Categories

| Category | Description | Risk Level |
|----------|-------------|------------|
| pii | Personal identifiers | High |
| phi | Health information | High |
| financial | Financial data | High |
| technical | Technical secrets | Medium |

## Environment Variables

- `ANTHROPIC_API_KEY` - API key for Anthropic services (if needed)

## License

MIT
