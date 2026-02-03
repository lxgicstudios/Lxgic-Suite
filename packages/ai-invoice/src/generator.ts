/**
 * Invoice Generator - Creates invoice documents in various formats
 */

export interface InvoiceLineItem {
  description: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  client?: {
    name: string;
    email?: string;
    address?: string;
  };
  vendor: {
    name: string;
    email?: string;
    address?: string;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax?: number;
  taxRate?: number;
  total: number;
  notes?: string;
  currency: string;
}

/**
 * Generate invoice number based on date and sequence
 */
export function generateInvoiceNumber(month: string, sequence: number = 1): string {
  const [year, monthNum] = month.split('-');
  return `INV-${year}${monthNum}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Calculate due date (30 days from invoice date)
 */
export function calculateDueDate(invoiceDate: Date): string {
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString().split('T')[0];
}

/**
 * Generate JSON invoice
 */
export function generateJSON(invoice: InvoiceData): string {
  return JSON.stringify(invoice, null, 2);
}

/**
 * Generate CSV invoice
 */
export function generateCSV(invoice: InvoiceData): string {
  const lines: string[] = [];

  // Header info
  lines.push('Invoice Information');
  lines.push(`Invoice Number,${invoice.invoiceNumber}`);
  lines.push(`Invoice Date,${invoice.invoiceDate}`);
  lines.push(`Due Date,${invoice.dueDate}`);
  lines.push(`Billing Period,${invoice.billingPeriod.start} to ${invoice.billingPeriod.end}`);
  lines.push('');

  // Line items header
  lines.push('Description,Model,Input Tokens,Output Tokens,Requests,Unit Price,Total');

  // Line items
  for (const item of invoice.lineItems) {
    lines.push([
      `"${item.description}"`,
      item.model,
      item.inputTokens,
      item.outputTokens,
      item.requests,
      item.unitPrice.toFixed(4),
      item.totalPrice.toFixed(4)
    ].join(','));
  }

  lines.push('');
  lines.push(`Subtotal,,,,,,${invoice.subtotal.toFixed(2)}`);
  if (invoice.tax !== undefined) {
    lines.push(`Tax (${(invoice.taxRate || 0) * 100}%),,,,,,${invoice.tax.toFixed(2)}`);
  }
  lines.push(`Total,,,,,,${invoice.total.toFixed(2)}`);

  return lines.join('\n');
}

/**
 * Generate PDF-ready HTML invoice
 */
export function generatePDFReady(invoice: InvoiceData): string {
  const lineItemsHTML = invoice.lineItems.map(item => `
    <tr>
      <td>${item.description}</td>
      <td>${item.model}</td>
      <td class="number">${item.inputTokens.toLocaleString()}</td>
      <td class="number">${item.outputTokens.toLocaleString()}</td>
      <td class="number">${item.requests.toLocaleString()}</td>
      <td class="currency">${invoice.currency}${item.totalPrice.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3498db;
    }
    .header h1 {
      font-size: 32px;
      color: #3498db;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-info p {
      margin: 4px 0;
    }
    .invoice-number {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .party {
      width: 45%;
    }
    .party h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
    }
    .party p {
      margin: 4px 0;
    }
    .party .name {
      font-weight: bold;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #3498db;
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 12px 8px;
      border-bottom: 1px solid #eee;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .number, .currency {
      text-align: right;
    }
    .totals {
      width: 300px;
      margin-left: auto;
    }
    .totals table {
      margin-bottom: 0;
    }
    .totals td {
      padding: 8px;
    }
    .totals .total-row {
      font-size: 18px;
      font-weight: bold;
      background: #3498db;
      color: white;
    }
    .totals .total-row td {
      border: none;
    }
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .notes h3 {
      font-size: 14px;
      margin-bottom: 8px;
      color: #666;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
    @media print {
      body {
        padding: 20px;
      }
      .header {
        page-break-after: avoid;
      }
      table {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>INVOICE</h1>
      <p>AI Usage Statement</p>
    </div>
    <div class="invoice-info">
      <p class="invoice-number">${invoice.invoiceNumber}</p>
      <p>Date: ${invoice.invoiceDate}</p>
      <p>Due: ${invoice.dueDate}</p>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>From</h3>
      <p class="name">${invoice.vendor.name}</p>
      ${invoice.vendor.email ? `<p>${invoice.vendor.email}</p>` : ''}
      ${invoice.vendor.address ? `<p>${invoice.vendor.address}</p>` : ''}
    </div>
    ${invoice.client ? `
    <div class="party">
      <h3>Bill To</h3>
      <p class="name">${invoice.client.name}</p>
      ${invoice.client.email ? `<p>${invoice.client.email}</p>` : ''}
      ${invoice.client.address ? `<p>${invoice.client.address}</p>` : ''}
    </div>
    ` : ''}
  </div>

  <p style="margin-bottom: 20px;">
    <strong>Billing Period:</strong> ${invoice.billingPeriod.start} to ${invoice.billingPeriod.end}
  </p>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Model</th>
        <th class="number">Input Tokens</th>
        <th class="number">Output Tokens</th>
        <th class="number">Requests</th>
        <th class="currency">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHTML}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td>Subtotal</td>
        <td class="currency">${invoice.currency}${invoice.subtotal.toFixed(2)}</td>
      </tr>
      ${invoice.tax !== undefined ? `
      <tr>
        <td>Tax (${((invoice.taxRate || 0) * 100).toFixed(0)}%)</td>
        <td class="currency">${invoice.currency}${invoice.tax.toFixed(2)}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>Total</td>
        <td class="currency">${invoice.currency}${invoice.total.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <h3>Notes</h3>
    <p>${invoice.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by ai-invoice | AI Usage Invoice Generator</p>
    <p>Thank you for your business!</p>
  </div>
</body>
</html>
`.trim();
}

/**
 * Generate text invoice for terminal display
 */
export function generateText(invoice: InvoiceData): string {
  const lines: string[] = [];
  const width = 80;
  const divider = '═'.repeat(width);
  const thinDivider = '─'.repeat(width);

  lines.push(divider);
  lines.push(centerText('INVOICE', width));
  lines.push(centerText('AI Usage Statement', width));
  lines.push(divider);
  lines.push('');
  lines.push(`Invoice Number: ${invoice.invoiceNumber}`);
  lines.push(`Invoice Date:   ${invoice.invoiceDate}`);
  lines.push(`Due Date:       ${invoice.dueDate}`);
  lines.push(`Billing Period: ${invoice.billingPeriod.start} to ${invoice.billingPeriod.end}`);
  lines.push('');
  lines.push(`From: ${invoice.vendor.name}`);
  if (invoice.client) {
    lines.push(`To:   ${invoice.client.name}`);
  }
  lines.push('');
  lines.push(thinDivider);
  lines.push('');

  // Table header
  const cols = {
    desc: 25,
    model: 16,
    input: 10,
    output: 10,
    reqs: 8,
    amount: 10
  };

  lines.push([
    'Description'.padEnd(cols.desc),
    'Model'.padEnd(cols.model),
    'Input'.padStart(cols.input),
    'Output'.padStart(cols.output),
    'Reqs'.padStart(cols.reqs),
    'Amount'.padStart(cols.amount)
  ].join(' '));

  lines.push(thinDivider);

  // Line items
  for (const item of invoice.lineItems) {
    const desc = item.description.length > cols.desc - 1
      ? item.description.substring(0, cols.desc - 4) + '...'
      : item.description;

    lines.push([
      desc.padEnd(cols.desc),
      item.model.padEnd(cols.model),
      formatNumber(item.inputTokens).padStart(cols.input),
      formatNumber(item.outputTokens).padStart(cols.output),
      item.requests.toString().padStart(cols.reqs),
      `${invoice.currency}${item.totalPrice.toFixed(2)}`.padStart(cols.amount)
    ].join(' '));
  }

  lines.push(thinDivider);
  lines.push('');

  // Totals
  const labelWidth = width - 15;
  lines.push(`${'Subtotal:'.padStart(labelWidth)} ${invoice.currency}${invoice.subtotal.toFixed(2).padStart(12)}`);
  if (invoice.tax !== undefined) {
    lines.push(`${`Tax (${((invoice.taxRate || 0) * 100).toFixed(0)}%):`.padStart(labelWidth)} ${invoice.currency}${invoice.tax.toFixed(2).padStart(12)}`);
  }
  lines.push(thinDivider);
  lines.push(`${'TOTAL:'.padStart(labelWidth)} ${invoice.currency}${invoice.total.toFixed(2).padStart(12)}`);
  lines.push('');
  lines.push(divider);

  if (invoice.notes) {
    lines.push('');
    lines.push('Notes:');
    lines.push(invoice.notes);
  }

  return lines.join('\n');
}

function centerText(text: string, width: number): string {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
