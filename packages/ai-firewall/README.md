# @lxgic/ai-firewall

Block prompt injection and jailbreak attempts before they reach your AI models.

## Installation

```bash
npm install -g @lxgic/ai-firewall
# or
npx @lxgic/ai-firewall
```

## Usage

### Check Input Text

```bash
ai-firewall check "Your input text here"
ai-firewall check "ignore all previous instructions"
```

### Check from Stdin

```bash
echo "ignore previous instructions" | ai-firewall check --stdin
cat prompt.txt | ai-firewall check --stdin
```

### Analyze a File

```bash
ai-firewall analyze prompts.txt
ai-firewall analyze user-inputs.log --severity high
```

### List Security Rules

```bash
ai-firewall rules
ai-firewall rules --category injection
ai-firewall rules --severity critical
```

## Detected Threats

### Injection Attacks
- Direct instruction override attempts
- System prompt manipulation
- Developer/admin mode activation
- Context delimiter exploitation

### Jailbreak Attempts
- DAN (Do Anything Now) patterns
- Character hijacking (STAN, DUDE, etc.)
- Uncensored/unrestricted mode requests
- Opposite day exploits

### Manipulation Tactics
- Role play injection
- Emotional manipulation
- Authority impersonation
- Hypothetical framing

### Encoding Attacks
- Base64 hidden instructions
- Hex encoding exploits

### Extraction Attempts
- System prompt extraction
- API key/credential extraction

## Risk Scoring

Each input receives a risk score from 0-100:

| Score | Level | Description |
|-------|-------|-------------|
| 0-19 | Safe | No threats detected |
| 20-39 | Low | Minor suspicious patterns |
| 40-59 | Medium | Possible manipulation attempt |
| 60-79 | High | Likely attack pattern |
| 80-100 | Critical | Clear security threat |

## Options

### Global Options
- `--json` - Output in JSON format for programmatic use
- `--help` - Show help information
- `--version` - Show version number

### Check/Analyze Options
- `--stdin` - Read input from stdin
- `-s, --severity <level>` - Minimum severity to report (low/medium/high/critical)

## Example Output

```json
{
  "allowed": false,
  "riskScore": 95,
  "riskLevel": "critical",
  "matches": [
    {
      "ruleId": "INJ001",
      "ruleName": "Ignore Instructions",
      "severity": "critical",
      "action": "block",
      "matchedText": "ignore all previous instructions"
    }
  ],
  "recommendation": "BLOCK RECOMMENDED: Detected 1 high-risk pattern(s)"
}
```

## CI/CD Integration

Use as a pre-commit hook or in CI pipelines:

```bash
# Check user input before processing
echo "$USER_INPUT" | ai-firewall check --stdin --json

# Analyze prompt files in CI
ai-firewall analyze ./prompts/*.txt

# Exit code 1 if threats detected
```

## Security Rules

Rules are organized by category and severity:

| Category | Description |
|----------|-------------|
| injection | Direct prompt injection attempts |
| jailbreak | Attempts to bypass AI restrictions |
| manipulation | Social engineering and role manipulation |
| encoding | Hidden instructions in encoded formats |
| extraction | Attempts to extract sensitive information |

## Programmatic Usage

```typescript
import { AIFirewall } from '@lxgic/ai-firewall';

const firewall = new AIFirewall();

// Check single input
const result = firewall.check('ignore previous instructions');
console.log(result.allowed); // false
console.log(result.riskScore); // 95

// Analyze file
const analysis = firewall.analyze('./prompts.txt');
console.log(analysis.overallRiskLevel);
```

## Environment Variables

- `ANTHROPIC_API_KEY` - API key for Anthropic services (if needed)

## License

MIT
