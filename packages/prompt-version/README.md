# @lxgic/prompt-version

Git-like version control for prompts. Track changes, compare versions, and manage prompt history with familiar commands.

## Installation

```bash
npm install -g @lxgic/prompt-version
# or
npx @lxgic/prompt-version <command>
```

## Features

- Git-like versioning commands (init, commit, log, diff, checkout)
- Content-based deduplication using SHA-256 hashing
- Tagging for release management
- Branching for A/B testing
- Version comparison with diff output
- JSON output for automation

## Quick Start

```bash
# Initialize version control
prompt-version init

# Commit a prompt
prompt-version commit my-prompt.md -m "Initial version"

# Make changes and commit again
prompt-version commit my-prompt.md -m "Improved instructions"

# View history
prompt-version log my-prompt.md

# Compare versions
prompt-version diff my-prompt.md --v1 abc123 --v2 def456

# Restore a previous version
prompt-version checkout my-prompt.md abc123
```

## Commands

### Initialize

```bash
prompt-version init
```

Creates a `.prompt-versions/` directory to store version data.

### Commit

```bash
prompt-version commit <file> -m "message" [-a "author"]
```

Save a new version of a prompt file.

Options:
- `-m, --message <message>` - Commit message (default: "Update prompt")
- `-a, --author <author>` - Author name (default: "anonymous")

### Log

```bash
prompt-version log <file> [-n count]
```

Show version history for a file.

Options:
- `-n, --number <count>` - Number of entries to show (default: 10)

### Diff

```bash
prompt-version diff <file> --v1 <hash> --v2 <hash>
```

Compare two versions of a prompt.

### Checkout

```bash
prompt-version checkout <file> <version>
```

Restore a specific version. Accepts version hash or tag name.

### Tag

```bash
prompt-version tag <file> <tag-name> [-v hash]
```

Tag a version for easy reference.

Options:
- `-v, --version <hash>` - Version to tag (defaults to latest)

### Untag

```bash
prompt-version untag <file> <tag-name>
```

Remove a tag.

### Branch (A/B Testing)

```bash
# Create a branch
prompt-version branch <file> <branch-name> [-f hash]

# Switch branches
prompt-version switch <file> <branch-name>

# List branches
prompt-version branches <file>
```

### Status

```bash
prompt-version status <file>
```

Show status of a prompt file (tracked, modified, version count).

### Show

```bash
prompt-version show <file> <version>
```

Display the content of a specific version.

### List

```bash
prompt-version list
```

List all tracked prompt files.

## JSON Output

All commands support `--json` flag for automation:

```bash
prompt-version log my-prompt.md --json
```

Output:
```json
{
  "file": "my-prompt.md",
  "entries": [
    {
      "id": "abc12345",
      "message": "Improved instructions",
      "author": "john",
      "timestamp": 1699900000000,
      "date": "2024-11-13T12:00:00.000Z",
      "branch": "main",
      "tags": ["v1.0"],
      "isHead": true
    }
  ],
  "total": 5,
  "showing": 5
}
```

## Storage Format

Versions are stored in `.prompt-versions/`:

```
.prompt-versions/
  store.json        # Metadata for all tracked files
  objects/          # Content objects (deduped by hash)
    abc123...       # Content file
    def456...       # Content file
```

## Use Cases

### Release Management

```bash
# Tag stable versions
prompt-version commit prompt.md -m "Ready for production"
prompt-version tag prompt.md v1.0

# Rollback if needed
prompt-version checkout prompt.md v1.0
```

### A/B Testing

```bash
# Create variants
prompt-version branch prompt.md variant-a
prompt-version switch prompt.md variant-a
# Edit prompt...
prompt-version commit prompt.md -m "Variant A: Formal tone"

prompt-version branch prompt.md variant-b
prompt-version switch prompt.md variant-b
# Edit prompt...
prompt-version commit prompt.md -m "Variant B: Casual tone"
```

### Collaboration

```bash
# Include author for tracking
prompt-version commit prompt.md -m "Fixed edge case" -a "Alice"
prompt-version commit prompt.md -m "Added examples" -a "Bob"

# Review changes
prompt-version log prompt.md
```

## License

MIT
