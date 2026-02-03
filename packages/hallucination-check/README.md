# hallucination-check

Detect factual hallucinations in AI-generated content. Compare claims against source documents, verify facts using Claude, and flag unsupported statements.

## Installation

```bash
npm install -g hallucination-check
# or
npx hallucination-check
```

## Prerequisites

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

## Usage

### Verify Against Sources

```bash
# Verify claims against source documents
npx hallucination-check verify output.txt --sources docs/

# With specific model
npx hallucination-check verify output.txt --sources docs/ --model claude-sonnet-4-20250514

# Enable strict mode
npx hallucination-check verify output.txt --sources docs/ --strict

# Output as JSON
npx hallucination-check verify output.txt --sources docs/ --json
```

### Check Without Sources

```bash
# Check for potential hallucinations without source documents
npx hallucination-check check output.txt

# With specific model
npx hallucination-check check output.txt --model claude-sonnet-4-20250514

# Output as JSON
npx hallucination-check check output.txt --json
```

### View Report

```bash
# Show the last verification report
npx hallucination-check report

# Output as JSON
npx hallucination-check report --json
```

### Configuration

```bash
# View all configuration
npx hallucination-check config

# Get a specific value
npx hallucination-check config --get defaultModel

# Set a value
npx hallucination-check config --set strictMode=true
```

## Features

- **Source Verification**: Compare AI output claims against provided documents
- **Claim Extraction**: Automatically identify factual claims in text
- **Confidence Scoring**: Rate verification confidence for each claim
- **Claim Categorization**: Classify claims as factual, statistical, quoted, etc.
- **Source Attribution**: Link verified claims to supporting documents

## Claim Types

The tool categorizes claims into:

| Type | Description |
|------|-------------|
| `factual` | General factual statements |
| `statistical` | Numbers, percentages, statistics |
| `quoted` | Direct quotes or attributions |
| `definitional` | Definitions or explanations |
| `temporal` | Date/time-related claims |
| `relational` | Relationships between entities |

## Output Example

### Text Report

```
============================================================
  HALLUCINATION CHECK REPORT
============================================================

  Generated: 2024-01-15T10:30:00.000Z
  Sources: docs/api.md, docs/guide.md

------------------------------------------------------------
  SUMMARY
------------------------------------------------------------
  Total Claims:      8
  Verified Claims:   6
  Unverified Claims: 2
  Hallucination Risk: 25.0%

------------------------------------------------------------
  CLAIMS ANALYSIS
------------------------------------------------------------

  [VERIFIED] (92% confidence)
  Claim: "The API supports pagination with limit and offset parameters"
  Type: factual
  Found supporting documentation in api.md
  Source: api.md

  [FLAGGED] (45% confidence)
  Claim: "The response time is guaranteed to be under 100ms"
  Type: statistical
  No supporting evidence found in source documents
```

### JSON Output

```json
{
  "output": "...",
  "totalClaims": 8,
  "verifiedClaims": 6,
  "unverifiedClaims": 2,
  "hallucinationScore": 0.25,
  "claims": [
    {
      "text": "The API supports pagination...",
      "type": "factual",
      "confidence": 0.92,
      "verified": true,
      "supportingSource": "api.md",
      "explanation": "Found supporting documentation"
    }
  ],
  "sources": ["docs/api.md", "docs/guide.md"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `defaultModel` | claude-sonnet-4-20250514 | Default model for verification |
| `strictMode` | false | Require exact matches for verification |
| `confidenceThreshold` | 0.7 | Minimum confidence for verified claims |
| `maxClaimsPerBatch` | 50 | Maximum claims to process at once |

## Supported Source Formats

- `.txt` - Plain text
- `.md` - Markdown
- `.json` - JSON
- `.yaml` / `.yml` - YAML
- `.html` - HTML

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check for Hallucinations
  run: |
    npx hallucination-check verify ${{ github.workspace }}/output.txt \
      --sources ${{ github.workspace }}/docs/ \
      --json
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### GitLab CI

```yaml
hallucination-check:
  script:
    - npx hallucination-check verify output.txt --sources docs/
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

## Best Practices

1. **Use Source Documents**: Always provide source documents when possible for more accurate verification
2. **Review Flagged Claims**: Manually review claims marked as unverified
3. **Adjust Confidence Threshold**: Lower threshold for creative content, higher for technical documentation
4. **Enable Strict Mode**: Use strict mode for compliance-critical content

## License

MIT
