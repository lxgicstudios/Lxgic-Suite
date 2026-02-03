# @lxgic/ai-budget

Set and track AI spending limits with alerts and usage history.

## Installation

```bash
npm install -g @lxgic/ai-budget
# or
npx @lxgic/ai-budget
```

## Usage

### Set budget limits

```bash
# Set monthly limit
ai-budget set --monthly 1000

# Set multiple limits
ai-budget set --daily 50 --weekly 200 --monthly 1000

# Set limits with alert thresholds
ai-budget set --monthly 1000 --alert 50% 80% 100%

# Set currency
ai-budget set --currency EUR
```

### Check status

```bash
ai-budget status
```

### Record usage

```bash
# Record spending
ai-budget add 5.50

# With details
ai-budget add 5.50 --model claude-3-opus --project my-app --description "API calls"
```

### View remaining budget

```bash
ai-budget remaining
```

### View history

```bash
# Default: last 6 months
ai-budget history

# Last 30 days
ai-budget history --periods 30 --type daily

# Weekly history
ai-budget history --type weekly
```

### Reset usage

```bash
# Reset all usage
ai-budget reset

# Reset specific period
ai-budget reset --period monthly
ai-budget reset --period weekly
ai-budget reset --period daily
```

## Options

- `--json` - Output in JSON format (available on all commands)
- `--help` - Show help

## Output Example

```
 AI Budget Status
──────────────────────────────────────────────────

Budget Limits:
  Daily:   $50.00
  Weekly:  $200.00
  Monthly: $1,000.00

Current Usage:
  Daily:
    $12.50 / $50.00
    [=====               ] 25.0%
  Weekly:
    $85.00 / $200.00
    [========            ] 42.5%
  Monthly:
    $450.00 / $1,000.00
    [=========           ] 45.0%

Alert Thresholds:
  - 50% - pending
  - 80% - pending
  - 100% - pending
```

## Configuration

Configuration is stored in `~/.lxgic/ai-budget/`:

- `config.json` - Budget limits and alert settings
- `usage.json` - Usage history

## API Usage

```typescript
import {
  setBudget,
  recordUsage,
  getBudgetStatus,
  getBudgetHistory,
  isBudgetExceeded,
  getRemainingBudget,
} from '@lxgic/ai-budget';

// Set budget
setBudget({
  monthly: 1000,
  alert: [50, 80, 100],
});

// Record usage
recordUsage({
  amount: 5.50,
  model: 'claude-3-opus',
  project: 'my-app',
});

// Check status
const status = getBudgetStatus();
console.log(status.currentUsage.monthly);

// Check if exceeded
const exceeded = isBudgetExceeded();
if (exceeded.exceeded) {
  console.log('Budget exceeded!', exceeded.details);
}
```

## License

MIT
