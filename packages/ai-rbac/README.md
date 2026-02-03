# ai-rbac

Role-based access control for AI resources. Define roles, manage permissions, and control access to AI models and resources.

## Installation

```bash
npm install -g ai-rbac
# or
npx ai-rbac
```

## Usage

### Grant a role to a user

```bash
ai-rbac grant john.doe --role developer
ai-rbac grant jane.doe --role admin --email jane@company.com
```

### Revoke roles from a user

```bash
ai-rbac revoke john.doe --role developer  # Revoke specific role
ai-rbac revoke john.doe                    # Revoke all roles
```

### Check if a user has permission

```bash
ai-rbac check john.doe --action use-opus
ai-rbac check john.doe --action read --resource prompt:*
ai-rbac check john.doe --action create --resource prompt:own
```

### List available roles

```bash
ai-rbac list-roles
ai-rbac list-roles --detailed
```

### List configured users

```bash
ai-rbac list-users
```

### Show user details

```bash
ai-rbac show john.doe
```

### Delete a user

```bash
ai-rbac delete-user john.doe
```

## Built-in Roles

### admin
- Full administrative access
- Unlimited tokens
- Access to all models

### developer
- Use all standard models
- Create, read, update, delete own prompts
- 1M tokens per day

### analyst
- Use basic models
- Read all prompts and analytics
- 500K tokens per day

### viewer
- Read public prompts only
- View own usage
- 100K tokens per day

## Custom Roles

### Create a custom role

```bash
ai-rbac create-role senior-dev \
  --description "Senior developer with extended access" \
  --permissions "use:model:*,create:prompt:*,read:prompt:*" \
  --token-limit 2000000 \
  --models "gpt-4,claude-3-opus,claude-3-sonnet"
```

### Delete a custom role

```bash
ai-rbac delete-role senior-dev
```

### Grant custom permissions

```bash
ai-rbac grant-permission john.doe --action use --resource model:gpt-4-turbo
```

## Action Aliases

For convenience, use these aliases with the `--action` flag:

- `use-opus` - Use Claude 3 Opus
- `use-gpt4` - Use GPT-4 models
- `use-sonnet` - Use Claude 3 Sonnet
- `use-haiku` - Use Claude 3 Haiku
- `use-basic` - Use basic models (GPT-3.5, Haiku)

## Available Actions

- `use` - Use AI models
- `create` - Create resources
- `read` - Read resources
- `update` - Update resources
- `delete` - Delete resources
- `approve` - Approve workflows
- `manage` - Manage settings
- `*` - Wildcard (all actions)

## Available Resources

- `model:gpt-4`, `model:gpt-4-turbo`, `model:gpt-3.5-turbo`
- `model:claude-3-opus`, `model:claude-3-sonnet`, `model:claude-3-haiku`
- `model:*`, `model:basic`
- `prompt:*`, `prompt:own`, `prompt:public`
- `usage:*`, `usage:own`
- `analytics:*`, `settings:*`
- `*` (wildcard)

## Options

All commands support:

- `--json` - Output in JSON format
- `--help` - Show help for the command

## Environment Variables

- `AI_RBAC_STORE` - Path to the RBAC store file (default: `.ai-rbac.json`)

## Storage

RBAC data is stored in `.ai-rbac.json` containing:

- User definitions and role assignments
- Custom role definitions
- Custom permissions

## Integration Example

```javascript
const { checkAccess } = require('ai-rbac');

// Before making an AI API call
const access = checkAccess('user-id', 'use-opus');
if (!access.allowed) {
  throw new Error(`Access denied: ${access.reason}`);
}

// Proceed with API call...
```

## License

MIT
