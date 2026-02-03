# prompt-approve

Approval workflow for production prompts. Track, review, and approve prompts before they go into production.

## Installation

```bash
npm install -g prompt-approve
# or
npx prompt-approve
```

## Usage

### Submit a prompt for review

```bash
prompt-approve submit ./prompts/my-prompt.txt
prompt-approve submit ./prompts/my-prompt.txt --user "john.doe"
prompt-approve submit ./prompts/my-prompt.txt --validate
```

### Review pending prompts

```bash
prompt-approve review
prompt-approve review --all  # Include already reviewed
```

### Approve a submission

```bash
prompt-approve approve <submission-id>
prompt-approve approve <submission-id> --user "reviewer@company.com"
```

### Reject a submission

```bash
prompt-approve reject <submission-id> --reason "Contains unsafe patterns"
prompt-approve reject <submission-id> -r "Needs revision" --user "security@company.com"
```

### List all submissions

```bash
prompt-approve list
prompt-approve list --status pending
prompt-approve list --status approved
prompt-approve list --export json
prompt-approve list --export csv
```

### Show submission details

```bash
prompt-approve show <submission-id>
```

## Options

All commands support:

- `--json` - Output in JSON format
- `--help` - Show help for the command

## Environment Variables

- `PROMPT_APPROVE_STORE` - Path to the approval store file (default: `.prompt-approve.json` in current directory)
- `USER` - Default username for submissions and reviews

## Features

- Submit prompts for review with automatic validation
- Track pending, approved, and rejected submissions
- Store approval metadata and history
- Export approval history as JSON or CSV
- Validation checks for dangerous patterns, placeholders, and TODO markers
- Full approval chain tracking

## Storage

Approval data is stored in a JSON file (`.prompt-approve.json` by default). This file contains:

- All submissions with their content and metadata
- Approval status and timestamps
- Reviewer information
- Rejection reasons

## License

MIT
