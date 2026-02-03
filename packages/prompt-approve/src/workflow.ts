import {
  PromptSubmission,
  ApprovalStatus,
  loadStore,
  saveStore,
  getSubmission,
} from './core';

export interface WorkflowStep {
  name: string;
  requiredRole?: string;
  autoApprove?: boolean;
  notifyOnComplete?: boolean;
}

export interface WorkflowConfig {
  steps: WorkflowStep[];
  requireAllApprovers: boolean;
  expirationHours?: number;
}

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  steps: [
    { name: 'initial-review', requiredRole: 'reviewer' },
    { name: 'security-check', requiredRole: 'security' },
    { name: 'final-approval', requiredRole: 'admin' },
  ],
  requireAllApprovers: false,
  expirationHours: 72,
};

export interface WorkflowState {
  submissionId: string;
  currentStep: number;
  completedSteps: string[];
  startedAt: string;
  expiresAt?: string;
}

export function initializeWorkflow(submission: PromptSubmission, config: WorkflowConfig = DEFAULT_WORKFLOW): WorkflowState {
  const expiresAt = config.expirationHours
    ? new Date(Date.now() + config.expirationHours * 60 * 60 * 1000).toISOString()
    : undefined;

  return {
    submissionId: submission.id,
    currentStep: 0,
    completedSteps: [],
    startedAt: new Date().toISOString(),
    expiresAt,
  };
}

export function advanceWorkflow(state: WorkflowState, config: WorkflowConfig = DEFAULT_WORKFLOW): WorkflowState {
  if (state.currentStep >= config.steps.length - 1) {
    return state;
  }

  const currentStepName = config.steps[state.currentStep].name;
  state.completedSteps.push(currentStepName);
  state.currentStep++;

  return state;
}

export function isWorkflowComplete(state: WorkflowState, config: WorkflowConfig = DEFAULT_WORKFLOW): boolean {
  return state.completedSteps.length >= config.steps.length;
}

export function isWorkflowExpired(state: WorkflowState): boolean {
  if (!state.expiresAt) {
    return false;
  }
  return new Date(state.expiresAt) < new Date();
}

export function getCurrentStepInfo(state: WorkflowState, config: WorkflowConfig = DEFAULT_WORKFLOW): WorkflowStep | null {
  if (state.currentStep >= config.steps.length) {
    return null;
  }
  return config.steps[state.currentStep];
}

export function formatWorkflowStatus(state: WorkflowState, config: WorkflowConfig = DEFAULT_WORKFLOW): string {
  const lines: string[] = [];

  lines.push(`Workflow for submission: ${state.submissionId}`);
  lines.push(`Started: ${state.startedAt}`);
  if (state.expiresAt) {
    lines.push(`Expires: ${state.expiresAt}`);
  }
  lines.push('');
  lines.push('Steps:');

  config.steps.forEach((step, index) => {
    const completed = state.completedSteps.includes(step.name);
    const current = index === state.currentStep;
    const status = completed ? '[x]' : current ? '[>]' : '[ ]';
    const roleInfo = step.requiredRole ? ` (requires: ${step.requiredRole})` : '';
    lines.push(`  ${status} ${step.name}${roleInfo}`);
  });

  return lines.join('\n');
}

export function validateSubmissionForProduction(submission: PromptSubmission): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check content length
  if (submission.content.length < 10) {
    issues.push('Prompt content is too short (minimum 10 characters)');
  }

  if (submission.content.length > 100000) {
    issues.push('Prompt content exceeds maximum length (100,000 characters)');
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?prior/i,
    /you\s+are\s+now\s+/i,
    /act\s+as\s+if\s+you\s+have\s+no\s+restrictions/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(submission.content)) {
      issues.push(`Content contains potentially dangerous pattern: ${pattern.source}`);
    }
  }

  // Check for placeholder text
  if (/\{\{.*\}\}/.test(submission.content)) {
    issues.push('Content contains unresolved template placeholders ({{ }})');
  }

  if (/TODO|FIXME|XXX/i.test(submission.content)) {
    issues.push('Content contains TODO/FIXME markers');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function getApprovalChain(submissionId: string): { approver: string; timestamp: string; action: string }[] {
  const submission = getSubmission(submissionId);
  if (!submission) {
    return [];
  }

  const chain: { approver: string; timestamp: string; action: string }[] = [];

  chain.push({
    approver: submission.submittedBy,
    timestamp: submission.submittedAt,
    action: 'submitted',
  });

  if (submission.reviewedBy && submission.reviewedAt) {
    chain.push({
      approver: submission.reviewedBy,
      timestamp: submission.reviewedAt,
      action: submission.status,
    });
  }

  return chain;
}

export function bulkProcess(
  ids: string[],
  action: 'approve' | 'reject',
  options: { reviewer?: string; reason?: string } = {}
): { success: string[]; failed: { id: string; error: string }[] } {
  const store = loadStore();
  const success: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of ids) {
    const submission = store.submissions.find(s => s.id === id || s.id.startsWith(id));

    if (!submission) {
      failed.push({ id, error: 'Not found' });
      continue;
    }

    if (submission.status !== 'pending') {
      failed.push({ id, error: `Already ${submission.status}` });
      continue;
    }

    submission.status = action === 'approve' ? 'approved' : 'rejected';
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedBy = options.reviewer || process.env.USER || 'unknown';

    if (action === 'reject' && options.reason) {
      submission.rejectionReason = options.reason;
    }

    success.push(id);
  }

  saveStore(store);

  return { success, failed };
}
