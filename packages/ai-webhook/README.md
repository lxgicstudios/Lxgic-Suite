# ai-webhook

Webhook server for AI event triggers. Create HTTP endpoints that route incoming requests to custom prompt handlers with authentication, logging, and request processing.

## Installation

```bash
npm install -g ai-webhook
# or
npx ai-webhook
```

## Quick Start

```bash
# Start server with default handler
npx ai-webhook serve --port 3000

# Start server with custom handler
npx ai-webhook serve --port 3000 --handler handler.ts

# Test a webhook endpoint
npx ai-webhook test http://localhost:3000/webhook

# View request logs
npx ai-webhook logs
```

## Commands

### serve

Start the webhook server.

```bash
ai-webhook serve [options]

Options:
  -p, --port <port>      Port to listen on (default: "3000")
  -h, --handler <path>   Path to handler file
  -a, --auth <token>     Authentication token
  -v, --verbose          Enable verbose logging
  --no-builtin           Disable built-in routes
```

**Examples:**

```bash
# Basic server
ai-webhook serve --port 8080

# With custom handler
ai-webhook serve --handler ./my-handler.ts

# With authentication
ai-webhook serve --auth my-secret-token

# Production setup
ai-webhook serve --port 3000 --handler handlers/webhook.ts --auth $WEBHOOK_SECRET
```

### test

Test a webhook endpoint.

```bash
ai-webhook test <url> [options]

Options:
  -m, --method <method>  HTTP method (default: "POST")
  -d, --data <json>      Request body as JSON
  -H, --header <header>  Add header (format: "Key: Value")
  -a, --auth <token>     Bearer authentication token
```

**Examples:**

```bash
# Simple POST test
ai-webhook test http://localhost:3000/webhook

# With data
ai-webhook test http://localhost:3000/api -d '{"event":"test"}'

# With auth and headers
ai-webhook test http://localhost:3000/api --auth token123 -H "X-Custom: value"

# GET request
ai-webhook test http://localhost:3000/health --method GET
```

### logs

View webhook request logs.

```bash
ai-webhook logs [options]

Options:
  -n, --limit <count>   Number of logs to show (default: "20")
  -f, --filter <status> Filter by status code
  -p, --path <path>     Filter by path
  --clear               Clear all logs
```

**Examples:**

```bash
# View recent logs
ai-webhook logs

# View more logs
ai-webhook logs -n 50

# Filter by errors
ai-webhook logs --filter 500

# Filter by path
ai-webhook logs --path /api

# Clear logs
ai-webhook logs --clear
```

### init

Initialize a sample handler file.

```bash
ai-webhook init [options]

Options:
  -o, --output <path>   Output file path (default: "webhook-handler.ts")
```

## Creating Handlers

### Basic Handler

```typescript
import { WebhookRequest, WebhookResponse } from 'ai-webhook';

export default async function handler(request: WebhookRequest): Promise<WebhookResponse> {
  console.log(`Received ${request.method} request to ${request.path}`);

  return {
    status: 200,
    body: {
      success: true,
      data: request.body
    }
  };
}
```

### Named Route Handlers

Use the format `METHOD_path` to create route-specific handlers:

```typescript
// Handles POST /api/events
export async function POST_api_events(request: WebhookRequest): Promise<WebhookResponse> {
  return {
    status: 200,
    body: { event: 'processed' }
  };
}

// Handles GET /api/status
export async function GET_api_status(request: WebhookRequest): Promise<WebhookResponse> {
  return {
    status: 200,
    body: { status: 'ok' }
  };
}
```

### Request Object

```typescript
interface WebhookRequest {
  id: string;              // Unique request ID
  timestamp: Date;         // Request timestamp
  method: string;          // HTTP method
  path: string;            // Request path
  headers: Record<string, string>;
  body: any;               // Parsed body
  query: Record<string, string>;
}
```

### Response Object

```typescript
interface WebhookResponse {
  status: number;          // HTTP status code
  body: any;               // Response body
  headers?: Record<string, string>;
}
```

## Built-in Endpoints

When `--no-builtin` is not specified, these endpoints are available:

- `GET /health` - Health check
- `GET /ping` - Ping/pong test
- `ALL /echo` - Echo request details

## Authentication

When authentication is enabled with `--auth`, requests must include:

```
Authorization: Bearer <token>
```

Unauthenticated requests will receive a 401 response.

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
ai-webhook serve --port 3000 --json
ai-webhook test http://localhost:3000/webhook --json
ai-webhook logs --json
```

## Use Cases

### AI Event Processing

```typescript
export default async function handler(request: WebhookRequest): Promise<WebhookResponse> {
  const { event, data } = request.body;

  switch (event) {
    case 'completion':
      await processCompletion(data);
      break;
    case 'error':
      await handleError(data);
      break;
  }

  return { status: 200, body: { processed: true } };
}
```

### Integration with External Services

```typescript
export async function POST_github_webhook(request: WebhookRequest): Promise<WebhookResponse> {
  const event = request.headers['x-github-event'];
  const payload = request.body;

  // Process GitHub webhook
  await processGitHubEvent(event, payload);

  return { status: 200, body: { ok: true } };
}
```

## License

MIT
