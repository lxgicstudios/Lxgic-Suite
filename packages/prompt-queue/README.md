# prompt-queue

Redis-backed queue for AI tasks with worker processes, priority queuing, and dead letter support.

## Installation

```bash
npm install -g prompt-queue
# or use directly with npx
npx prompt-queue --help
```

## Prerequisites

- Redis server running (local or remote)

## Usage

### Start Queue Server

```bash
prompt-queue start --redis redis://localhost:6379
```

### Add Jobs to Queue

```bash
# Simple prompt
prompt-queue add "Summarize this article about AI"

# With priority (higher = more important)
prompt-queue add "Urgent task" --priority 10

# With delay
prompt-queue add "Process later" --delay 5000

# With metadata
prompt-queue add "Process data" --metadata '{"source": "api", "userId": "123"}'
```

### Check Queue Status

```bash
# Overall stats
prompt-queue status

# List specific jobs
prompt-queue status --list waiting
prompt-queue status --list active
prompt-queue status --list completed
prompt-queue status --list failed
prompt-queue status --list delayed

# Limit results
prompt-queue status --list waiting --limit 20
```

### Start Worker Process

```bash
# Default worker (5 concurrent jobs)
prompt-queue worker

# Custom concurrency
prompt-queue worker --concurrency 10

# With timeout and retries
prompt-queue worker --timeout 60000 --retries 5

# Full options
prompt-queue worker --redis redis://localhost:6379 --concurrency 5 --timeout 30000 --retries 3
```

### Queue Management

```bash
# Pause queue
prompt-queue pause

# Resume queue
prompt-queue resume

# Retry all failed jobs
prompt-queue retry

# Clean completed jobs
prompt-queue clean --status completed

# Clean failed jobs older than 1 hour
prompt-queue clean --status failed --grace 3600000
```

## Features

### Priority Queuing

Jobs with higher priority values are processed first:

```bash
prompt-queue add "Low priority" --priority 0
prompt-queue add "Normal" --priority 5
prompt-queue add "High priority" --priority 10
prompt-queue add "Urgent" --priority 100
```

### Worker Processes

Workers process jobs concurrently with configurable limits:

```bash
# Start multiple workers for horizontal scaling
prompt-queue worker --concurrency 5 &
prompt-queue worker --concurrency 5 &
prompt-queue worker --concurrency 5 &
```

### Job Status Tracking

Track job progress through states:
- `waiting` - In queue, not yet picked up
- `active` - Currently being processed
- `completed` - Successfully finished
- `failed` - Failed (may retry)
- `delayed` - Scheduled for future processing

### Retry Logic

Failed jobs are automatically retried with exponential backoff:

```bash
# Configure max retries per job
prompt-queue add "Important task" --metadata '{"maxAttempts": 5}'

# Configure worker retries
prompt-queue worker --retries 3
```

### Dead Letter Queue

Jobs that exceed max retries are moved to the dead letter queue:

```bash
# View dead letter queue
prompt-queue status --list failed

# Stats include dead letter count
prompt-queue status
```

## Options

### Global Options

- `--json` - Output in JSON format
- `--help` - Show help

### Command Options

#### start
- `-r, --redis <url>` - Redis URL (default: redis://localhost:6379)

#### add
- `-r, --redis <url>` - Redis URL
- `-p, --priority <number>` - Job priority (default: 0)
- `-d, --delay <ms>` - Delay before processing
- `-m, --metadata <json>` - Job metadata as JSON

#### status
- `-r, --redis <url>` - Redis URL
- `-l, --list <status>` - List jobs by status
- `-n, --limit <number>` - Number of jobs to show (default: 10)

#### worker
- `-r, --redis <url>` - Redis URL
- `-c, --concurrency <number>` - Concurrent jobs (default: 5)
- `-t, --timeout <ms>` - Job timeout (default: 30000)
- `--retries <number>` - Max retries (default: 3)

#### clean
- `-r, --redis <url>` - Redis URL
- `-s, --status <status>` - Status to clean (default: completed)
- `-g, --grace <ms>` - Grace period (default: 0)

## JSON Output

Use `--json` flag for machine-readable output:

```bash
prompt-queue status --json
```

Output:
```json
{
  "success": true,
  "stats": {
    "waiting": 10,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "delayed": 0,
    "paused": 0
  },
  "deadLetter": {
    "count": 1
  }
}
```

## Programmatic Usage

```typescript
import { createQueue, createWorker } from 'prompt-queue';

// Create queue
const queue = await createQueue({
  redis: 'redis://localhost:6379'
});

// Add job
const job = await queue.add('Process this prompt', {
  priority: 5,
  metadata: { source: 'api' }
});

// Get stats
const stats = await queue.getStats();

// Create worker
const worker = await createWorker({
  redis: 'redis://localhost:6379',
  concurrency: 5,
  timeout: 30000,
  retries: 3
});

// Custom processor
worker.setProcessor(async (job) => {
  const result = await myAIProvider.process(job.data.prompt);
  return result;
});

// Start worker
await worker.start();
```

## Architecture

```
+----------------+     +-------+     +----------------+
|  CLI / API     | --> | Redis | <-- |    Workers     |
+----------------+     +-------+     +----------------+
                           |
                           v
                   +---------------+
                   | Dead Letter Q |
                   +---------------+
```

## License

MIT
