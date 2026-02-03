import Conf from 'conf';
import { z } from 'zod';

const config = new Conf<{ allocations: Allocation[] }>({
  projectName: 'ai-allocate',
  defaults: {
    allocations: [],
  },
});

export interface AllocateConfig {
  project: string;
  costCenter?: string;
  team?: string;
  environment?: string;
}

export interface Allocation {
  id: string;
  project: string;
  costCenter: string;
  team?: string;
  environment?: string;
  amount: number;
  description?: string;
  timestamp: string;
}

const AllocationSchema = z.object({
  project: z.string().min(1),
  costCenter: z.string().optional(),
  team: z.string().optional(),
  environment: z.enum(['dev', 'staging', 'prod']).optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
});

function generateId(): string {
  return `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function tagUsage(cfg: AllocateConfig): Promise<{ project: string; costCenter: string; team?: string }> {
  const validated = AllocationSchema.parse(cfg);

  const allocation: Allocation = {
    id: generateId(),
    project: validated.project,
    costCenter: validated.costCenter || 'default',
    team: validated.team,
    environment: validated.environment,
    amount: 0,
    timestamp: new Date().toISOString(),
  };

  const allocations = config.get('allocations');
  allocations.push(allocation);
  config.set('allocations', allocations);

  return {
    project: allocation.project,
    costCenter: allocation.costCenter,
    team: allocation.team,
  };
}

export async function allocateCost(
  amount: number,
  options: { project?: string; costCenter?: string; description?: string }
): Promise<Allocation> {
  const allocation: Allocation = {
    id: generateId(),
    project: options.project || 'unassigned',
    costCenter: options.costCenter || 'default',
    amount,
    description: options.description,
    timestamp: new Date().toISOString(),
  };

  const allocations = config.get('allocations');
  allocations.push(allocation);
  config.set('allocations', allocations);

  return allocation;
}

export async function listAllocations(filters: {
  project?: string;
  costCenter?: string;
  period?: string;
}): Promise<Allocation[]> {
  let allocations = config.get('allocations');

  if (filters.project) {
    allocations = allocations.filter(a => a.project === filters.project);
  }

  if (filters.costCenter) {
    allocations = allocations.filter(a => a.costCenter === filters.costCenter);
  }

  if (filters.period) {
    const now = new Date();
    let cutoff: Date;

    switch (filters.period) {
      case 'day':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    allocations = allocations.filter(a => new Date(a.timestamp) >= cutoff);
  }

  return allocations;
}

export async function generateReport(
  period: string,
  format: string
): Promise<{ content: string; summary: Record<string, number> }> {
  const allocations = await listAllocations({ period });

  const byProject: Record<string, number> = {};
  const byCostCenter: Record<string, number> = {};

  for (const alloc of allocations) {
    byProject[alloc.project] = (byProject[alloc.project] || 0) + alloc.amount;
    byCostCenter[alloc.costCenter] = (byCostCenter[alloc.costCenter] || 0) + alloc.amount;
  }

  let content: string;

  if (format === 'csv') {
    const lines = ['project,cost_center,amount,timestamp'];
    for (const alloc of allocations) {
      lines.push(`${alloc.project},${alloc.costCenter},${alloc.amount},${alloc.timestamp}`);
    }
    content = lines.join('\n');
  } else {
    const lines: string[] = [];
    lines.push(`\nAllocation Report (${period})`);
    lines.push('='.repeat(50));
    lines.push('\nBy Project:');
    for (const [project, amount] of Object.entries(byProject)) {
      lines.push(`  ${project}: $${amount.toFixed(2)}`);
    }
    lines.push('\nBy Cost Center:');
    for (const [center, amount] of Object.entries(byCostCenter)) {
      lines.push(`  ${center}: $${amount.toFixed(2)}`);
    }
    const total = allocations.reduce((sum, a) => sum + a.amount, 0);
    lines.push(`\nTotal: $${total.toFixed(2)}`);
    content = lines.join('\n');
  }

  return {
    content,
    summary: { ...byProject, ...byCostCenter },
  };
}
