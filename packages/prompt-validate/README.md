# prompt-validate

JSON schema validation for AI outputs. Validate JSON outputs against JSON Schema draft-07, generate schemas from samples, and perform batch validation.

## Installation

```bash
npm install -g prompt-validate
# or
npx prompt-validate
```

## Usage

### Validate Output

```bash
# Validate a JSON file against a schema
npx prompt-validate validate output.json --schema schema.json

# Validate JSON string directly
npx prompt-validate validate '{"name": "test"}' --schema schema.json

# Output as JSON
npx prompt-validate validate output.json --schema schema.json --json
```

### Generate Schema

```bash
# Generate schema from sample JSON file
npx prompt-validate generate-schema sample.json

# Save schema to file
npx prompt-validate generate-schema sample.json --output schema.json

# Generate from JSON string
npx prompt-validate generate-schema '{"name": "John", "age": 30}'
```

### Batch Validation

```bash
# Validate all JSON files in a directory
npx prompt-validate batch ./outputs --schema schema.json

# Output as JSON
npx prompt-validate batch ./outputs --schema schema.json --json
```

### Configuration

```bash
# View all configuration
npx prompt-validate config

# Get a specific value
npx prompt-validate config --get strictMode

# Set a value
npx prompt-validate config --set strictMode=false
```

## Features

- **JSON Schema Validation**: Validate against JSON Schema draft-07
- **Schema Generation**: Automatically generate schemas from sample data
- **Format Detection**: Detect common formats (date, email, URI, UUID)
- **Batch Validation**: Validate multiple files at once
- **Detailed Errors**: Clear error messages with JSON paths
- **Markdown Support**: Extract JSON from markdown code blocks

## Supported Formats

The tool automatically detects these formats in schema generation:

| Format | Example |
|--------|---------|
| `date-time` | `2024-01-15T10:30:00Z` |
| `date` | `2024-01-15` |
| `email` | `user@example.com` |
| `uri` | `https://example.com` |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` |

## Output Examples

### Validation Result

```
============================================================
  VALIDATION RESULT
============================================================

  Output: output.json
  Schema: schema.json
  Generated: 2024-01-15T10:30:00.000Z

------------------------------------------------------------
  Status: INVALID
------------------------------------------------------------

  Errors:
    - Path: /name
      Message: must be string
      Keyword: type
      Params: {"type":"string"}

    - Path: /age
      Message: must be >= 0
      Keyword: minimum
      Params: {"limit":0}
```

### Batch Result

```
============================================================
  BATCH VALIDATION RESULT
============================================================

  Generated: 2024-01-15T10:30:00.000Z

------------------------------------------------------------
  SUMMARY
------------------------------------------------------------
  Total Files:   10
  Valid Files:   8
  Invalid Files: 2

------------------------------------------------------------
  FILES
------------------------------------------------------------
  [VALID] outputs/user1.json
  [VALID] outputs/user2.json
  [INVALID] outputs/user3.json (2 errors)
    - /email: must match format "email"
    - /age: must be integer
```

### Generated Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "sample",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "age": {
      "type": "integer"
    },
    "created": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["name", "email", "age", "created"],
  "additionalProperties": false
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `strictMode` | true | Enable strict validation |
| `allowAdditionalProperties` | false | Allow properties not in schema |
| `defaultSchemaPath` | undefined | Default schema to use |

## JSON Schema Support

The tool supports JSON Schema draft-07 features including:

- Basic types: `string`, `number`, `integer`, `boolean`, `null`, `array`, `object`
- Formats: `date`, `date-time`, `email`, `uri`, `uuid`, etc.
- Validation keywords: `required`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, etc.
- Composition: `allOf`, `anyOf`, `oneOf`, `not`
- References: `$ref`, `$defs`

## CI/CD Integration

### GitHub Actions

```yaml
- name: Validate AI Outputs
  run: npx prompt-validate batch ./outputs --schema schema.json --json

- name: Validate Single Output
  run: npx prompt-validate validate ${{ github.workspace }}/output.json --schema schema.json
```

### GitLab CI

```yaml
validate:
  script:
    - npx prompt-validate batch ./outputs --schema schema.json
  allow_failure: false
```

## Best Practices

1. **Generate Schema First**: Use `generate-schema` to create an initial schema from expected output
2. **Refine Schema**: Add constraints like `minLength`, `pattern`, `enum` for stricter validation
3. **Use Batch for CI**: Validate all outputs in CI pipelines with `batch` command
4. **JSON Flag for Parsing**: Use `--json` when parsing output programmatically

## License

MIT
