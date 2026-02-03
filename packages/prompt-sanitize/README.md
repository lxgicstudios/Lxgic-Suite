# @lxgic/prompt-sanitize

Strip PII/PHI from prompts before sending to AI services.

## Installation

```bash
npm install -g @lxgic/prompt-sanitize
# or
npx @lxgic/prompt-sanitize
```

## Usage

### Clean/Sanitize a File

```bash
prompt-sanitize clean document.txt
prompt-sanitize clean document.txt --output sanitized.txt
```

### Clean from Stdin

```bash
echo "Call me at 555-123-4567" | prompt-sanitize clean --stdin
cat sensitive.txt | prompt-sanitize clean --stdin
```

### Scan a File (Detection Only)

```bash
prompt-sanitize scan document.txt
prompt-sanitize scan document.txt --context
```

### List Available Patterns

```bash
prompt-sanitize patterns
prompt-sanitize patterns --category pii
```

## Detected Patterns

### PII (Personally Identifiable Information)
- Social Security Numbers (with/without dashes)
- Email addresses
- Phone numbers (US and international)
- IP addresses
- Driver's license numbers
- Passport numbers
- Street addresses
- ZIP codes
- API keys and tokens

### PHI (Protected Health Information)
- Dates of birth
- Medical Record Numbers (MRN)

### Financial
- Credit card numbers (Visa, MasterCard, Amex, Discover, Diners)
- Bank account numbers
- Routing numbers

## Options

### Global Options
- `--json` - Output in JSON format
- `--help` - Show help information
- `--version` - Show version number

### Clean Command Options
- `--stdin` - Read input from stdin
- `-p, --patterns <patterns>` - Comma-separated list of patterns to use
- `-e, --exclude <patterns>` - Comma-separated list of patterns to exclude
- `-o, --output <file>` - Write sanitized output to file

### Scan Command Options
- `-p, --patterns <patterns>` - Comma-separated list of patterns to use
- `-e, --exclude <patterns>` - Comma-separated list of patterns to exclude
- `-c, --context` - Show surrounding context for detections

## Example Output

```json
{
  "sanitized": "Please contact [EMAIL REDACTED] or call [PHONE REDACTED]",
  "summary": {
    "totalRedactions": 2,
    "byType": {
      "email": 1,
      "phone_us": 1
    },
    "byCategory": {
      "pii": 2
    },
    "riskLevel": "medium"
  }
}
```

## Risk Levels

- **critical** - 3+ high sensitivity items detected
- **high** - 1-2 high sensitivity items or 3+ medium
- **medium** - 1-2 medium sensitivity items
- **low** - Only low sensitivity items
- **none** - No sensitive data detected

## CI/CD Integration

Use in CI/CD pipelines to prevent sensitive data from being committed:

```bash
# Scan and fail if high-risk data found
prompt-sanitize scan ./prompts/*.txt --json

# Exit code 1 if high/critical risk detected
```

## Programmatic Usage

```typescript
import { PromptSanitizer } from '@lxgic/prompt-sanitize';

const sanitizer = new PromptSanitizer();

// Sanitize text
const result = sanitizer.sanitize('Email: john@example.com');
console.log(result.sanitized); // "Email: [EMAIL REDACTED]"

// Scan without modifying
const scan = sanitizer.scan('SSN: 123-45-6789');
console.log(scan.summary.riskLevel); // "high"
```

## Environment Variables

- `ANTHROPIC_API_KEY` - API key for Anthropic services (if needed)

## License

MIT
