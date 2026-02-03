# @lxgic/ai-usage

Generate usage reports by team/project with trend analysis and export capabilities.

## Installation

```bash
npm install -g @lxgic/ai-usage
# or
npx @lxgic/ai-usage
```

## Usage

### Generate report

```bash
# Monthly report (default)
ai-usage report

# Weekly report
ai-usage report --period week

# Export to CSV
ai-usage report --period month --format csv --output report.csv

# Group by project
ai-usage report --group-by project
```

### View summary

```bash
# Monthly summary (default)
ai-usage summary

# Daily summary
ai-usage summary --period day

# Quarterly summary
ai-usage summary --period quarter
```

### View breakdown

```bash
# By project (default)
ai-usage breakdown

# By user
ai-usage breakdown --by user

# By team
ai-usage breakdown --by team

# By model
ai-usage breakdown --by model
```

### View trends

```bash
# Monthly trends (default)
ai-usage trends

# Weekly trends
ai-usage trends --type week

# Daily trends for last 30 days
ai-usage trends --type day --periods 30
```

### Record usage

```bash
ai-usage record --model claude-3-opus --input-tokens 1000 --output-tokens 500 --cost 0.05

# With details
ai-usage record \
  --model claude-3-opus \
  --input-tokens 1000 \
  --output-tokens 500 \
  --cost 0.05 \
  --user john \
  --team engineering \
  --project my-app
```

### Import/Export data

```bash
# Import from CSV
ai-usage import data.csv

# Import from JSON
ai-usage import data.json

# Export to CSV
ai-usage export report.csv --period month

# Export to JSON
ai-usage export report.json --period quarter
```

## Options

- `--json` - Output in JSON format (available on all commands)
- `--help` - Show help

## Output Example

```
 Usage Summary
──────────────────────────────────────────────────
Period: 1/1/2024 - 1/31/2024

Totals:
  Requests: 1,234
  Tokens:   456,789
  Cost:     $123.45

By Model:
  claude-3-opus           456 reqs       123,456 tokens      $67.89
  claude-3-sonnet         789 reqs       333,333 tokens      $55.56

By Project:
  my-app                  500 reqs       200,000 tokens      $50.00
  api-backend             400 reqs       150,000 tokens      $40.00
  chatbot                 334 reqs       106,789 tokens      $33.45

 Usage Breakdown by project
──────────────────────────────────────────────────────────────────────
my-app                        $50.00 (40.5%)
  [================                        ]
  500 requests, 200,000 tokens, avg 400 tokens/req

api-backend                   $40.00 (32.4%)
  [=============                           ]
  400 requests, 150,000 tokens, avg 375 tokens/req
```

## CSV Import Format

The CSV file should have the following columns:

```csv
user,team,project,model,inputTokens,outputTokens,totalTokens,cost
john,engineering,my-app,claude-3-opus,1000,500,1500,0.05
jane,design,chatbot,claude-3-sonnet,800,400,1200,0.02
```

## Configuration

Data is stored in `~/.lxgic/ai-usage/`:

- `usage.json` - Usage records

## API Usage

```typescript
import {
  generateReport,
  getSummary,
  getBreakdown,
  getTrends,
  recordUsage,
  exportReport,
  importData,
} from '@lxgic/ai-usage';

// Record usage
recordUsage('claude-3-opus', 1000, 500, 0.05, {
  user: 'john',
  team: 'engineering',
  project: 'my-app',
});

// Get summary
const summary = getSummary('month');
console.log(summary.totals);

// Get breakdown
const breakdown = getBreakdown('project', 'month');

// Get trends
const trends = getTrends('month', 6);

// Export report
exportReport('report.csv', 'csv', { period: 'month' });
```

## License

MIT
