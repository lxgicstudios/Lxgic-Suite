# prompt-coverage

Test coverage reporting for prompts. Track which prompt variations are tested, calculate coverage percentage, and generate reports and badges for CI/CD integration.

## Installation

```bash
npm install -g prompt-coverage
# or
npx prompt-coverage
```

## Usage

### Generate Coverage Report

```bash
# Generate a coverage report for tests
npx prompt-coverage report ./tests

# Specify prompts directory
npx prompt-coverage report ./tests --prompts-dir ./prompts

# Save report to file
npx prompt-coverage report ./tests --output coverage.txt

# Output as JSON
npx prompt-coverage report ./tests --json
```

### Generate Coverage Badge

```bash
# Generate a coverage badge
npx prompt-coverage badge

# Specify tests directory
npx prompt-coverage badge --tests-dir ./tests

# Save badge SVG to file
npx prompt-coverage badge --output badge.svg

# Output as JSON
npx prompt-coverage badge --json
```

### Check Coverage Threshold

```bash
# Check if coverage meets minimum threshold (default 80%)
npx prompt-coverage threshold --min 80

# Specify tests directory
npx prompt-coverage threshold --min 70 --tests-dir ./tests

# Output as JSON
npx prompt-coverage threshold --min 80 --json
```

### Configuration

```bash
# View all configuration
npx prompt-coverage config

# Get a specific value
npx prompt-coverage config --get defaultThreshold

# Set a value
npx prompt-coverage config --set defaultThreshold=90
```

## Features

- **Track Prompt Variations**: Automatically discovers prompt variations from prompt files and test files
- **Calculate Coverage**: Calculates what percentage of prompt variations have tests
- **Generate Reports**: Detailed reports showing which variations are tested
- **Coverage Badges**: Generate SVG badges for README files
- **CI/CD Integration**: Threshold checking for CI pipelines

## Coverage Detection

The tool looks for:
- Prompt files: `.prompt`, `.txt`, `.md`, `.json`
- Test files: `.test.ts`, `.test.js`, `.spec.ts`, `.spec.js`
- Parameter placeholders: `{{param}}`, `${param}`, `%{param}`
- Test assertions: `expect()`, `assert()`, `.toBe()`, etc.

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `defaultThreshold` | 80 | Default minimum coverage threshold |
| `outputFormat` | 'text' | Output format (text, json, html) |
| `badgeStyle` | 'flat' | Badge style (flat, flat-square, plastic) |
| `excludePatterns` | [] | Glob patterns to exclude |
| `includePatterns` | ['**/*.test.ts'] | Glob patterns to include |

## Output Examples

### Text Report

```
============================================================
  PROMPT COVERAGE REPORT
============================================================

  Tests Directory: ./tests
  Generated: 2024-01-15T10:30:00.000Z

------------------------------------------------------------
  SUMMARY
------------------------------------------------------------
  Total Variations:  10
  Tested Variations: 8
  Coverage:          80%

------------------------------------------------------------
  VARIATIONS
------------------------------------------------------------
  [x] greeting-formal (5 assertions)
      └── ./tests/greeting.test.ts
  [x] greeting-casual (3 assertions)
      └── ./tests/greeting.test.ts
  [ ] greeting-technical
  [x] summary-short (4 assertions)
      └── ./tests/summary.test.ts
```

### JSON Output

```json
{
  "totalVariations": 10,
  "testedVariations": 8,
  "coveragePercentage": 80,
  "variations": [
    {
      "name": "greeting-formal",
      "tested": true,
      "testFile": "./tests/greeting.test.ts",
      "assertions": 5
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "testsDir": "./tests"
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check Prompt Coverage
  run: npx prompt-coverage threshold --min 80 --json
  continue-on-error: false
```

### GitLab CI

```yaml
coverage:
  script:
    - npx prompt-coverage threshold --min 80
  allow_failure: false
```

## License

MIT
