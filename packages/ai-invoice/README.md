# ai-invoice

Generate invoices for AI usage - aggregate costs and create professional invoice documents.

## Installation

```bash
npm install -g ai-invoice
# or
npx ai-invoice
```

## Features

- **Aggregate Monthly Usage**: Automatically collect and summarize API usage data
- **Calculate Costs by Project/Team**: Group costs by model, project, or team
- **Generate Invoice Documents**: Create professional invoices with line items
- **Export Formats**: JSON, CSV, and PDF-ready HTML

## CLI Commands

### Generate Invoice

Generate an invoice for a specific month:

```bash
# Generate invoice for January 2024
ai-invoice generate --month 2024-01

# Group by project instead of model
ai-invoice generate --month 2024-01 --group-by project

# Group by team
ai-invoice generate --month 2024-01 --group-by team

# Save to file
ai-invoice generate --month 2024-01 -o invoice.txt

# JSON output
ai-invoice generate --month 2024-01 --json
```

### Preview Invoice

Preview invoice without saving:

```bash
# Preview current month
ai-invoice preview

# Preview specific month
ai-invoice preview --month 2024-01

# JSON format
ai-invoice preview --month 2024-01 --json
```

### Export Invoice

Export invoice in various formats:

```bash
# Export as PDF-ready HTML
ai-invoice export --month 2024-01 --format pdf

# Export as CSV
ai-invoice export --month 2024-01 --format csv -o invoice.csv

# Export as JSON
ai-invoice export --month 2024-01 --format json -o invoice.json
```

### View Summary

View usage summary for a month:

```bash
# Current month summary
ai-invoice summary

# Specific month
ai-invoice summary --month 2024-01

# JSON output
ai-invoice summary --month 2024-01 --json
```

### Add Usage Record

Manually add usage records:

```bash
ai-invoice add --model claude-3.5-sonnet --input 1000 --output 500 --cost 0.012 \
  --project "My Project" --team "Engineering"
```

### Configure Settings

Set invoice configuration:

```bash
# View current config
ai-invoice config --show

# Set vendor info
ai-invoice config --vendor-name "My Company" --vendor-email "billing@company.com"

# Set client info
ai-invoice config --client-name "Client Corp" --client-email "accounts@client.com"

# Set tax rate (10%)
ai-invoice config --tax-rate 0.1

# Set currency
ai-invoice config --currency "EUR"
```

## Output Examples

### Invoice Preview

```
════════════════════════════════════════════════════════════════════════════════
                                    INVOICE
                              AI Usage Statement
════════════════════════════════════════════════════════════════════════════════

Invoice Number: INV-202401-0001
Invoice Date:   2024-01-31
Due Date:       2024-03-01
Billing Period: 2024-01-01 to 2024-01-31

From: AI Services Provider
To:   Client Corp

────────────────────────────────────────────────────────────────────────────────

Description               Model                Input     Output     Reqs    Amount
────────────────────────────────────────────────────────────────────────────────
claude-3.5-sonnet API Us  claude-3.5-sonnet   125.5K    89.2K       156  $45.23
gpt-4o API Usage          gpt-4o               89.1K    62.3K       112  $32.15
claude-3-haiku API Usage  claude-3-haiku      245.8K   156.2K       287   $8.42
────────────────────────────────────────────────────────────────────────────────

                                                           Subtotal:      $85.80
                                                           Tax (10%):      $8.58
────────────────────────────────────────────────────────────────────────────────
                                                             TOTAL:       $94.38

════════════════════════════════════════════════════════════════════════════════
```

### JSON Output

```json
{
  "invoiceNumber": "INV-202401-0001",
  "invoiceDate": "2024-01-31",
  "dueDate": "2024-03-01",
  "billingPeriod": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "lineItems": [
    {
      "description": "claude-3.5-sonnet API Usage",
      "model": "claude-3.5-sonnet",
      "inputTokens": 125500,
      "outputTokens": 89200,
      "requests": 156,
      "totalPrice": 45.23
    }
  ],
  "subtotal": 85.80,
  "tax": 8.58,
  "total": 94.38
}
```

## Data Storage

Usage data and configuration are stored in `~/.ai-invoice/`:

- `config.json` - Invoice configuration
- `usage.json` - Usage records

## PDF Generation

The `--format pdf` option generates an HTML file styled for PDF conversion:

1. Export with PDF format: `ai-invoice export --month 2024-01 --format pdf`
2. Open the generated HTML file in a web browser
3. Use File > Print > Save as PDF

The HTML includes print-optimized CSS for professional output.

## Programmatic Usage

```typescript
import { generateInvoice, exportInvoice, addUsageRecord } from 'ai-invoice';

// Add a usage record
addUsageRecord({
  model: 'claude-3.5-sonnet',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.012,
  project: 'My Project',
  team: 'Engineering'
});

// Generate invoice
const invoice = generateInvoice('2024-01', 'model');

// Export as PDF-ready HTML
const html = exportInvoice(invoice, 'pdf');
```

## License

MIT
