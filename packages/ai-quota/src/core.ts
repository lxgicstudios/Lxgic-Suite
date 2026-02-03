import Conf from 'conf';
import { z } from 'zod';

interface QuotaData {
  user: string;
  dailyTokens?: number;
  monthlyTokens?: number;
  requestLimit?: number;
  costLimit?: number;
  dailyUsed: number;
  monthlyUsed: number;
  requestsUsed: number;
  costUsed: number;
  lastReset: string;
  exceeded: boolean;
}

const config = new Conf<{ quotas: Record<string, QuotaData> }>({
  projectName: 'ai-quota',
  defaults: {
    quotas: {},
  },
});

export interface QuotaConfig {
  user: string;
  dailyTokens?: number;
  monthlyTokens?: number;
  requestLimit?: number;
  costLimit?: number;
}

const QuotaSchema = z.object({
  user: z.string().min(1),
  dailyTokens: z.number().positive().optional(),
  monthlyTokens: z.number().positive().optional(),
  requestLimit: z.number().positive().optional(),
  costLimit: z.number().positive().optional(),
});

export async function setQuota(quotaConfig: QuotaConfig): Promise<QuotaData> {
  const validated = QuotaSchema.parse(quotaConfig);
  const quotas = config.get('quotas');

  const existing = quotas[validated.user];

  const quota: QuotaData = {
    user: validated.user,
    dailyTokens: validated.dailyTokens,
    monthlyTokens: validated.monthlyTokens,
    requestLimit: validated.requestLimit,
    costLimit: validated.costLimit,
    dailyUsed: existing?.dailyUsed || 0,
    monthlyUsed: existing?.monthlyUsed || 0,
    requestsUsed: existing?.requestsUsed || 0,
    costUsed: existing?.costUsed || 0,
    lastReset: existing?.lastReset || new Date().toISOString(),
    exceeded: false,
  };

  quotas[validated.user] = quota;
  config.set('quotas', quotas);

  return quota;
}

export async function getQuota(user: string): Promise<QuotaData | null> {
  const quotas = config.get('quotas');
  return quotas[user] || null;
}

export async function checkQuota(
  user: string,
  tokensNeeded: number
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
  const quota = await getQuota(user);

  if (!quota) {
    return { allowed: true, remaining: Infinity, limit: Infinity, used: 0 };
  }

  // Check daily limit
  if (quota.dailyTokens) {
    const remaining = quota.dailyTokens - quota.dailyUsed;
    if (remaining < tokensNeeded) {
      return {
        allowed: false,
        remaining,
        limit: quota.dailyTokens,
        used: quota.dailyUsed,
      };
    }
  }

  // Check monthly limit
  if (quota.monthlyTokens) {
    const remaining = quota.monthlyTokens - quota.monthlyUsed;
    if (remaining < tokensNeeded) {
      return {
        allowed: false,
        remaining,
        limit: quota.monthlyTokens,
        used: quota.monthlyUsed,
      };
    }
  }

  const effectiveLimit = quota.dailyTokens || quota.monthlyTokens || Infinity;
  const effectiveUsed = quota.dailyTokens ? quota.dailyUsed : quota.monthlyUsed;

  return {
    allowed: true,
    remaining: effectiveLimit - effectiveUsed,
    limit: effectiveLimit,
    used: effectiveUsed,
  };
}

export async function listQuotas(exceededOnly: boolean = false): Promise<QuotaData[]> {
  const quotas = config.get('quotas');
  let list = Object.values(quotas);

  // Update exceeded status
  for (const q of list) {
    q.exceeded = false;
    if (q.dailyTokens && q.dailyUsed >= q.dailyTokens) q.exceeded = true;
    if (q.monthlyTokens && q.monthlyUsed >= q.monthlyTokens) q.exceeded = true;
    if (q.costLimit && q.costUsed >= q.costLimit) q.exceeded = true;
  }

  if (exceededOnly) {
    list = list.filter(q => q.exceeded);
  }

  return list;
}

export async function resetQuota(user: string, type: 'daily' | 'monthly' | 'all'): Promise<void> {
  const quotas = config.get('quotas');
  const quota = quotas[user];

  if (!quota) {
    throw new Error(`No quota found for user: ${user}`);
  }

  if (type === 'daily' || type === 'all') {
    quota.dailyUsed = 0;
  }

  if (type === 'monthly' || type === 'all') {
    quota.monthlyUsed = 0;
  }

  if (type === 'all') {
    quota.requestsUsed = 0;
    quota.costUsed = 0;
  }

  quota.lastReset = new Date().toISOString();
  quota.exceeded = false;

  quotas[user] = quota;
  config.set('quotas', quotas);
}

export async function recordUsage(
  user: string,
  tokens: number,
  cost: number = 0
): Promise<{ allowed: boolean; quota: QuotaData }> {
  const quotas = config.get('quotas');
  let quota = quotas[user];

  if (!quota) {
    // No quota set, create default unlimited
    quota = {
      user,
      dailyUsed: 0,
      monthlyUsed: 0,
      requestsUsed: 0,
      costUsed: 0,
      lastReset: new Date().toISOString(),
      exceeded: false,
    };
  }

  quota.dailyUsed += tokens;
  quota.monthlyUsed += tokens;
  quota.requestsUsed += 1;
  quota.costUsed += cost;

  // Check if exceeded
  quota.exceeded = false;
  if (quota.dailyTokens && quota.dailyUsed >= quota.dailyTokens) quota.exceeded = true;
  if (quota.monthlyTokens && quota.monthlyUsed >= quota.monthlyTokens) quota.exceeded = true;
  if (quota.costLimit && quota.costUsed >= quota.costLimit) quota.exceeded = true;

  quotas[user] = quota;
  config.set('quotas', quotas);

  return { allowed: !quota.exceeded, quota };
}
