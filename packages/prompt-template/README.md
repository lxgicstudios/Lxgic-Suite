# @lxgic/prompt-template

Generate reusable prompt templates from examples. This CLI tool analyzes multiple example prompts to extract common patterns and create templates with variable placeholders.

## Installation

```bash
npm install -g @lxgic/prompt-template
# or use with npx
npx @lxgic/prompt-template --help
```

## Features

- Analyze multiple example prompts to extract patterns
- AI-powered template generation (with Claude API)
- Fallback to pattern matching when API is unavailable
- Mustache-style variable syntax `{{variable}}`
- Persistent template storage
- Import/export templates as JSON
- Full JSON output support for scripting

## Commands

### Create Template

Generate a template from example prompts in a directory:

```bash
# Basic usage
prompt-template create --from ./examples --name "code-review"

# Without AI analysis (pattern matching only)
prompt-template create --from ./examples --name "code-review" --no-ai
```

Example directory should contain `.txt`, `.md`, or `.prompt` files with similar prompts.

### Apply Template

Apply a template with variable substitutions:

```bash
# Apply with variables
prompt-template apply code-review --vars language=python file=main.py

# Output to file
prompt-template apply code-review --vars language=python --output result.txt
```

### List Templates

View all saved templates:

```bash
# Simple list
prompt-template list

# Detailed view
prompt-template list --verbose
```

### Show Template

View details of a specific template:

```bash
prompt-template show code-review
```

### Delete Template

Remove a saved template:

```bash
# With confirmation
prompt-template delete code-review

# Skip confirmation
prompt-template delete code-review --force
```

### Export/Import

Share templates between systems:

```bash
# Export
prompt-template export code-review --output template.json

# Import
prompt-template import template.json
```

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
prompt-template list --json
prompt-template apply my-template --vars key=value --json
```

## Example Workflow

1. Create example prompts in a directory:

```
examples/
  review-python.txt    "Review this Python code for best practices: {code}"
  review-javascript.txt "Review this JavaScript code for best practices: {code}"
  review-rust.txt      "Review this Rust code for best practices: {code}"
```

2. Generate template:

```bash
prompt-template create --from ./examples --name "code-review"
```

3. Use template:

```bash
prompt-template apply code-review --vars language=TypeScript code="function hello() {}"
```

## Environment Variables

- `ANTHROPIC_API_KEY`: Required for AI-powered template analysis. Without this, the tool falls back to pattern matching.

## Template Format

Templates use Mustache syntax:

```
Review this {{language}} code for best practices:

{{code}}

Focus on:
- Performance
- Security
- Maintainability
```

Variables:
- `{{variable}}` - Required variable
- Default values can be set when creating templates

## API

The package also exports core functions for programmatic use:

```typescript
import {
  createTemplate,
  applyTemplate,
  listTemplates,
  getTemplateByIdOrName,
} from '@lxgic/prompt-template';

// Create template programmatically
const result = await createTemplate('./examples', { name: 'my-template' });

// Apply template
const applied = await applyTemplate('my-template', { key: 'value' });
```

## License

MIT
