# prompt-cache

Cache repeated prompts to save money - reduce API costs with intelligent caching.

## Installation

```bash
npm install -g prompt-cache
# or
npx prompt-cache
```

## Features

- **Cache Prompt/Response Pairs**: Store API responses for repeated prompts
- **Configurable TTL**: Set custom expiration times for cached entries
- **Hash-based Key Generation**: Efficient SHA-256 hashing for cache keys
- **Cache Hit Statistics**: Track hits, misses, and hit rate
- **Estimated Savings**: Calculate how much you've saved through caching

## CLI Commands

### Enable Caching

Enable the cache with optional TTL:

```bash
# Enable with default TTL (1 hour)
prompt-cache enable

# Enable with custom TTL (30 minutes)
prompt-cache enable --ttl 1800

# JSON output
prompt-cache enable --json
```

### Disable Caching

Disable the cache (entries are preserved):

```bash
prompt-cache disable
prompt-cache disable --json
```

### Check Status

View current cache status:

```bash
prompt-cache status
prompt-cache status --json
```

### Clear Cache

Remove all cached entries:

```bash
prompt-cache clear
prompt-cache clear --force  # Skip confirmation
prompt-cache clear --json
```

### View Statistics

Show detailed cache statistics:

```bash
prompt-cache stats
prompt-cache stats --json
```

### View Savings

See estimated cost savings:

```bash
prompt-cache savings
prompt-cache savings --json
```

### Set TTL

Update the cache TTL:

```bash
# Set TTL to 2 hours
prompt-cache ttl 7200
```

### List Entries

View cached entries:

```bash
# List recent entries (default 20)
prompt-cache list

# Limit results
prompt-cache list --limit 10

# JSON output
prompt-cache list --json
```

### Check Cache

Check if a prompt is cached:

```bash
prompt-cache check --prompt "What is the capital of France?" --model gpt-4o
```

### Add Entry

Manually add a cache entry:

```bash
prompt-cache add \
  --prompt "What is 2+2?" \
  --response "2+2 equals 4." \
  --model claude-3.5-sonnet \
  --input-tokens 10 \
  --output-tokens 15 \
  --cost 0.0001
```

### Reset Statistics

Clear statistics while keeping cache entries:

```bash
prompt-cache reset-stats
```

## Output Examples

### Status Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           Cache Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status:     Enabled
TTL:        1h
Max Size:   10,000 entries
Used:       156 entries
Hit Rate:   67.3%
Savings:    $12.45
```

### Statistics Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         Cache Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Entries:    156
Cache Size:       2.4 MB

Total Hits:       523
Total Misses:     254
Hit Rate:         67.3%

Estimated Savings: $12.4523

Oldest Entry:     1/15/2024, 10:23:45 AM
Newest Entry:     1/20/2024, 3:45:12 PM
```

### Savings Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         Savings Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Cache Hits: 523
Total Savings:    $12.4523

Savings by Model:
─────────────────────────────────────────
  claude-3.5-sonnet       312 hits  $8.2345
  gpt-4o                  156 hits  $3.1234
  claude-3-haiku           55 hits  $1.0944

Top Cached Prompts:
─────────────────────────────────────────
  Summarize the following doc...   45 hits  $2.3456
  Translate this text to Span...   32 hits  $1.8765
```

## Programmatic Usage

```typescript
import {
  enableCache,
  disableCache,
  checkCache,
  addToCache,
  getStatus,
  getCacheStats,
  getSavingsReport
} from 'prompt-cache';

// Enable cache with 2-hour TTL
enableCache(7200);

// Check if prompt is cached
const result = checkCache('What is AI?', 'claude-3.5-sonnet');
if (result.hit) {
  console.log('Cache hit!', result.entry?.response);
} else {
  // Call API and cache result
  const response = await callAI('What is AI?');
  addToCache('What is AI?', response, 'claude-3.5-sonnet', 10, 100, 0.01);
}

// Get statistics
const stats = getCacheStats();
console.log(`Hit rate: ${stats.formattedHitRate}`);
console.log(`Savings: ${stats.formattedSavings}`);

// Get savings report
const report = getSavingsReport();
console.log(`Total saved: ${report.formattedSavings}`);
```

## How It Works

1. **Key Generation**: When a prompt is submitted, a SHA-256 hash is generated from the prompt text and model name to create a unique cache key.

2. **Cache Lookup**: Before making an API call, check the cache for an existing entry with the same key.

3. **Cache Hit**: If found and not expired, return the cached response immediately (zero API cost).

4. **Cache Miss**: If not found, proceed with the API call and optionally store the result for future use.

5. **Expiration**: Entries automatically expire after the configured TTL, ensuring responses don't become stale.

## Data Storage

Cache data is stored in `~/.prompt-cache/`:

- `config.json` - Cache configuration (TTL, enabled status)
- `cache.json` - Cached prompt/response pairs
- `stats.json` - Hit/miss statistics

## Best Practices

1. **Set Appropriate TTL**: Use shorter TTLs for time-sensitive data, longer for static content
2. **Monitor Hit Rate**: A low hit rate may indicate prompts are too unique
3. **Clear Periodically**: Remove old entries if cache size becomes large
4. **Use for Repetitive Tasks**: Caching works best for standardized, repeated prompts

## License

MIT
