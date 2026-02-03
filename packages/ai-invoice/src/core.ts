import * as fs from 'fs';
import * as path from 'path';
import {
  InvoiceData,
  InvoiceLineItem,
  generateInvoiceNumber,
  calculateDueDate,
  generateJSON,
  generateCSV,
  generatePDFReady,
  generateText
} from './generator';

export interface UsageRecord {
  timestamp: string;
  project?: string;
  team?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  description?: string;
}

export interface UsageData {
  records: UsageRecord[];
}

export interface InvoiceConfig {
  vendor: {
    name: string;
    email?: string;
    address?: string;
  };
  client?: {
    name: string;
    email?: string;
    address?: string;
  };
  taxRate?: number;
  currency?: string;
  notes?: string;
}

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.ai-invoice');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const USAGE_FILE = path.join(CONFIG_DIR, 'usage.json');

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load or create default config
 */
export function loadConfig(): InvoiceConfig {
  ensureConfigDir();

  if (fs.existsSync(CONFIG_FILE)) {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  }

  const defaultConfig: InvoiceConfig = {
    vendor: {
      name: 'AI Services Provider',
      email: 'billing@example.com'
    },
    currency: '$',
    taxRate: 0
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  return defaultConfig;
}

/**
 * Save config
 */
export function saveConfig(config: InvoiceConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Load usage data
 */
export function loadUsageData(): UsageData {
  ensureConfigDir();

  if (fs.existsSync(USAGE_FILE)) {
    const data = fs.readFileSync(USAGE_FILE, 'utf-8');
    return JSON.parse(data);
  }

  return { records: [] };
}

/**
 * Save usage data
 */
export function saveUsageData(data: UsageData): void {
  ensureConfigDir();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Add usage record
 */
export function addUsageRecord(record: Omit<UsageRecord, 'timestamp'>): void {
  const data = loadUsageData();
  data.records.push({
    ...record,
    timestamp: new Date().toISOString()
  });
  saveUsageData(data);
}

/**
 * Generate sample usage data for demonstration
 */
export function generateSampleData(month: string): void {
  const [year, monthNum] = month.split('-');
  const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

  const models = ['claude-3.5-sonnet', 'gpt-4o', 'claude-3-haiku', 'gpt-4o-mini'];
  const projects = ['Project Alpha', 'Project Beta', 'Internal Tools', 'Customer Support'];
  const teams = ['Engineering', 'Product', 'Support', 'Research'];

  const data = loadUsageData();

  for (let day = 1; day <= daysInMonth; day++) {
    const numRecords = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < numRecords; i++) {
      const model = models[Math.floor(Math.random() * models.length)];
      const project = projects[Math.floor(Math.random() * projects.length)];
      const team = teams[Math.floor(Math.random() * teams.length)];

      const inputTokens = Math.floor(Math.random() * 5000) + 500;
      const outputTokens = Math.floor(Math.random() * 3000) + 200;

      // Calculate cost based on model
      let cost = 0;
      if (model === 'claude-3.5-sonnet') {
        cost = (inputTokens / 1000000) * 3 + (outputTokens / 1000000) * 15;
      } else if (model === 'gpt-4o') {
        cost = (inputTokens / 1000000) * 5 + (outputTokens / 1000000) * 15;
      } else if (model === 'claude-3-haiku') {
        cost = (inputTokens / 1000000) * 0.25 + (outputTokens / 1000000) * 1.25;
      } else {
        cost = (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.6;
      }

      data.records.push({
        timestamp: `${year}-${monthNum}-${String(day).padStart(2, '0')}T${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
        project,
        team,
        model,
        inputTokens,
        outputTokens,
        cost,
        description: `API call for ${project}`
      });
    }
  }

  saveUsageData(data);
}

/**
 * Get usage records for a specific month
 */
export function getMonthlyUsage(month: string): UsageRecord[] {
  const data = loadUsageData();
  return data.records.filter(r => r.timestamp.startsWith(month));
}

/**
 * Aggregate usage by model
 */
export function aggregateByModel(records: UsageRecord[]): Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }> {
  const aggregated = new Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }>();

  for (const record of records) {
    const existing = aggregated.get(record.model) || { inputTokens: 0, outputTokens: 0, cost: 0, count: 0 };
    aggregated.set(record.model, {
      inputTokens: existing.inputTokens + record.inputTokens,
      outputTokens: existing.outputTokens + record.outputTokens,
      cost: existing.cost + record.cost,
      count: existing.count + 1
    });
  }

  return aggregated;
}

/**
 * Aggregate usage by project
 */
export function aggregateByProject(records: UsageRecord[]): Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }> {
  const aggregated = new Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }>();

  for (const record of records) {
    const key = record.project || 'Unassigned';
    const existing = aggregated.get(key) || { inputTokens: 0, outputTokens: 0, cost: 0, count: 0 };
    aggregated.set(key, {
      inputTokens: existing.inputTokens + record.inputTokens,
      outputTokens: existing.outputTokens + record.outputTokens,
      cost: existing.cost + record.cost,
      count: existing.count + 1
    });
  }

  return aggregated;
}

/**
 * Aggregate usage by team
 */
export function aggregateByTeam(records: UsageRecord[]): Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }> {
  const aggregated = new Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }>();

  for (const record of records) {
    const key = record.team || 'Unassigned';
    const existing = aggregated.get(key) || { inputTokens: 0, outputTokens: 0, cost: 0, count: 0 };
    aggregated.set(key, {
      inputTokens: existing.inputTokens + record.inputTokens,
      outputTokens: existing.outputTokens + record.outputTokens,
      cost: existing.cost + record.cost,
      count: existing.count + 1
    });
  }

  return aggregated;
}

/**
 * Generate invoice for a month
 */
export function generateInvoice(month: string, groupBy: 'model' | 'project' | 'team' = 'model'): InvoiceData {
  const config = loadConfig();
  const records = getMonthlyUsage(month);

  if (records.length === 0) {
    // Generate sample data if no records exist
    generateSampleData(month);
    return generateInvoice(month, groupBy);
  }

  let aggregated: Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }>;

  switch (groupBy) {
    case 'project':
      aggregated = aggregateByProject(records);
      break;
    case 'team':
      aggregated = aggregateByTeam(records);
      break;
    default:
      aggregated = aggregateByModel(records);
  }

  const lineItems: InvoiceLineItem[] = [];
  let subtotal = 0;

  for (const [key, data] of aggregated) {
    lineItems.push({
      description: groupBy === 'model' ? `${key} API Usage` : key,
      model: groupBy === 'model' ? key : 'Various',
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      requests: data.count,
      unitPrice: data.cost / data.count,
      totalPrice: data.cost
    });
    subtotal += data.cost;
  }

  // Sort by total price descending
  lineItems.sort((a, b) => b.totalPrice - a.totalPrice);

  const [year, monthNum] = month.split('-');
  const startDate = `${month}-01`;
  const endDate = `${month}-${new Date(parseInt(year), parseInt(monthNum), 0).getDate()}`;

  const invoiceDate = new Date();
  const tax = config.taxRate ? subtotal * config.taxRate : undefined;
  const total = subtotal + (tax || 0);

  return {
    invoiceNumber: generateInvoiceNumber(month),
    invoiceDate: invoiceDate.toISOString().split('T')[0],
    dueDate: calculateDueDate(invoiceDate),
    billingPeriod: {
      start: startDate,
      end: endDate
    },
    vendor: config.vendor,
    client: config.client,
    lineItems,
    subtotal,
    tax,
    taxRate: config.taxRate,
    total,
    notes: config.notes,
    currency: config.currency || '$'
  };
}

/**
 * Export invoice in specified format
 */
export function exportInvoice(invoice: InvoiceData, format: 'json' | 'csv' | 'pdf' | 'text'): string {
  switch (format) {
    case 'json':
      return generateJSON(invoice);
    case 'csv':
      return generateCSV(invoice);
    case 'pdf':
      return generatePDFReady(invoice);
    case 'text':
    default:
      return generateText(invoice);
  }
}

/**
 * Preview invoice in terminal
 */
export function previewInvoice(month: string, groupBy: 'model' | 'project' | 'team' = 'model'): string {
  const invoice = generateInvoice(month, groupBy);
  return generateText(invoice);
}

/**
 * Get usage summary
 */
export function getUsageSummary(month: string): {
  totalRecords: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Map<string, number>;
  byProject: Map<string, number>;
  byTeam: Map<string, number>;
} {
  const records = getMonthlyUsage(month);

  const byModel = new Map<string, number>();
  const byProject = new Map<string, number>();
  const byTeam = new Map<string, number>();

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const record of records) {
    totalCost += record.cost;
    totalInputTokens += record.inputTokens;
    totalOutputTokens += record.outputTokens;

    byModel.set(record.model, (byModel.get(record.model) || 0) + record.cost);
    byProject.set(record.project || 'Unassigned', (byProject.get(record.project || 'Unassigned') || 0) + record.cost);
    byTeam.set(record.team || 'Unassigned', (byTeam.get(record.team || 'Unassigned') || 0) + record.cost);
  }

  return {
    totalRecords: records.length,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    byModel,
    byProject,
    byTeam
  };
}

export { CONFIG_DIR, CONFIG_FILE, USAGE_FILE };
