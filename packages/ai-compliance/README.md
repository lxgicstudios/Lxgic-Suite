# ai-compliance

Check AI usage against GDPR, CCPA, and HIPAA compliance standards.

## Installation

```bash
npm install -g ai-compliance
# or
npx ai-compliance
```

## Usage

### Scan a directory

```bash
ai-compliance scan
ai-compliance scan --directory ./prompts
ai-compliance scan --standard hipaa
ai-compliance scan --standard gdpr --output report.txt
ai-compliance scan --patterns "**/*.txt,**/*.prompt"
```

### Check a specific file

```bash
ai-compliance check ./prompts/medical-assistant.txt
ai-compliance check ./prompts/data-collection.md --standard ccpa
```

### Generate a report

```bash
ai-compliance report
ai-compliance report --standard all --format json
ai-compliance report --output compliance-report.json
```

### List standards and rules

```bash
ai-compliance standards
ai-compliance standards --standard hipaa
```

## Supported Standards

### GDPR (General Data Protection Regulation)

- Personal data collection detection
- Right to erasure compliance
- Cross-border data transfer checks
- Automated decision-making oversight

### CCPA (California Consumer Privacy Act)

- Sale of personal information detection
- Disclosure requirement checks
- Minor data processing verification
- Service provider agreement validation

### HIPAA (Health Insurance Portability and Accountability Act)

- Protected Health Information (PHI) exposure
- Minimum necessary standard compliance
- Encryption requirement verification
- Audit control checks
- Business Associate Agreement validation

## Options

All commands support:

- `--json` - Output in JSON format
- `--help` - Show help for the command

## Exit Codes

- `0` - No violations found
- `1` - Violations found (critical violations always exit with 1)

## Compliance Score

Reports include a compliance score (0-100) and grade (A-F):

- **A (90-100)**: Excellent compliance
- **B (80-89)**: Good compliance with minor issues
- **C (70-79)**: Acceptable, requires attention
- **D (60-69)**: Poor compliance, significant issues
- **F (0-59)**: Critical compliance failures

## Severity Levels

- **Critical**: Immediate action required, may result in regulatory penalties
- **High**: Should be addressed before production deployment
- **Medium**: Review and remediate as part of normal development
- **Low**: Best practice recommendations

## License

MIT
