# prompt-api

Generate REST API from prompt definitions. Automatically create OpenAPI specs, serve APIs, and generate documentation from your prompt files.

## Installation

```bash
npm install -g prompt-api
# or
npx prompt-api
```

## Quick Start

```bash
# Initialize sample prompts
npx prompt-api init --dir prompts/

# Generate API from prompts
npx prompt-api generate prompts/ --output api/

# Start the API server
npx prompt-api serve --port 3000

# Generate documentation
npx prompt-api docs --prompts prompts/
```

## Commands

### generate

Generate API from prompt files.

```bash
prompt-api generate <prompts-dir> [options]

Options:
  -o, --output <dir>       Output directory (default: "api")
  -t, --title <title>      API title (default: "Prompt API")
  -v, --version <version>  API version (default: "1.0.0")
  --description <desc>     API description
```

**Examples:**

```bash
# Basic generation
prompt-api generate ./prompts --output ./api

# With custom title
prompt-api generate ./prompts --title "My AI API" --version "2.0.0"
```

### serve

Start the API server.

```bash
prompt-api serve [options]

Options:
  -p, --port <port>    Port to listen on (default: "3000")
  -d, --prompts <dir>  Prompts directory
  -o, --output <dir>   Output directory (from generate)
  -v, --verbose        Enable verbose logging
  -t, --title <title>  API title
```

**Examples:**

```bash
# Serve from generated output
prompt-api serve --port 3000

# Serve directly from prompts
prompt-api serve --prompts ./prompts --port 8080

# With verbose logging
prompt-api serve --verbose
```

### docs

Generate API documentation.

```bash
prompt-api docs [options]

Options:
  -d, --prompts <dir>   Prompts directory
  -o, --output <file>   Output file
  -f, --format <format> Output format (markdown, html) (default: "markdown")
```

**Examples:**

```bash
# Generate markdown docs
prompt-api docs --prompts ./prompts --output API.md

# Generate HTML docs
prompt-api docs --prompts ./prompts --output docs.html --format html
```

### init

Initialize sample prompt files.

```bash
prompt-api init [options]

Options:
  -d, --dir <directory>  Output directory (default: "prompts")
```

## Prompt File Formats

### YAML with Frontmatter (.prompt)

```yaml
---
name: summarize
description: Summarize the given text
method: POST
input:
  type: object
  properties:
    text:
      type: string
      description: The text to summarize
    length:
      type: string
      enum: [short, medium, long]
      default: medium
  required:
    - text
output:
  type: object
  properties:
    summary:
      type: string
model: gpt-4
parameters:
  temperature: 0.7
---
Please summarize the following text in a {{length}} format:

{{text}}
```

### Pure YAML (.prompt.yaml)

```yaml
name: translate
description: Translate text between languages
endpoint: /translate
method: POST
input:
  type: object
  properties:
    text:
      type: string
    target:
      type: string
  required:
    - text
    - target
template: |
  Translate the following to {{target}}:
  {{text}}
```

### JSON (.prompt.json)

```json
{
  "name": "analyze",
  "description": "Analyze sentiment",
  "method": "POST",
  "input": {
    "type": "object",
    "properties": {
      "text": { "type": "string" }
    },
    "required": ["text"]
  },
  "template": "Analyze the sentiment of: {{text}}"
}
```

## Prompt Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique prompt identifier |
| description | string | No | Human-readable description |
| version | string | No | Prompt version |
| endpoint | string | No | Custom API endpoint path |
| method | string | No | HTTP method (default: POST) |
| input | object | No | Input validation schema |
| output | object | No | Output schema for docs |
| template | string | Yes | Prompt template with {{variables}} |
| model | string | No | AI model to use |
| parameters | object | No | Model parameters |

## Generated API Structure

```
api/
  openapi.json     # OpenAPI 3.0 specification
  server.js        # Express server
  endpoints.json   # Endpoint list
  prompts/         # Prompt definitions
    summarize.json
    translate.json
```

## API Endpoints

When the server is running:

- `GET /health` - Health check
- `GET /docs` - Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification
- `GET /prompts` - List all prompts
- `GET /prompts/:name` - Get specific prompt
- `[METHOD] /:endpoint` - Generated prompt endpoints

## Template Variables

Use `{{variable}}` syntax in templates:

```yaml
template: |
  Please {{action}} the following {{type}}:
  {{content}}
```

Variables are replaced with values from the request body or query parameters.

## JSON Output

All commands support `--json` flag:

```bash
prompt-api generate ./prompts --json
prompt-api serve --json
prompt-api docs --json
```

## Example Workflow

```bash
# 1. Create prompt directory
mkdir prompts

# 2. Create a prompt file
cat > prompts/greet.prompt << 'EOF'
---
name: greet
description: Generate a greeting
method: POST
input:
  type: object
  properties:
    name:
      type: string
    style:
      type: string
      enum: [formal, casual, friendly]
      default: friendly
  required:
    - name
---
Generate a {{style}} greeting for {{name}}.
EOF

# 3. Generate API
prompt-api generate prompts/ --output api/

# 4. Start server
prompt-api serve --port 3000

# 5. Test endpoint
curl -X POST http://localhost:3000/greet \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "style": "formal"}'
```

## License

MIT
