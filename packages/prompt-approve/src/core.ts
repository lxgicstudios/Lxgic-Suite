import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PromptSubmission {
  id: string;
  file: string;
  content: string;
  submittedAt: string;
  submittedBy: string;
  status: ApprovalStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  metadata: Record<string, unknown>;
}

export interface ApprovalStore {
  submissions: PromptSubmission[];
  lastUpdated: string;
}

const DEFAULT_STORE_PATH = path.join(process.cwd(), '.prompt-approve.json');

export function getStorePath(): string {
  return process.env.PROMPT_APPROVE_STORE || DEFAULT_STORE_PATH;
}

export function loadStore(): ApprovalStore {
  const storePath = getStorePath();
  if (fs.existsSync(storePath)) {
    const data = fs.readFileSync(storePath, 'utf-8');
    return JSON.parse(data);
  }
  return { submissions: [], lastUpdated: new Date().toISOString() };
}

export function saveStore(store: ApprovalStore): void {
  const storePath = getStorePath();
  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function submitPrompt(filePath: string, submittedBy?: string): PromptSubmission {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const store = loadStore();

  const submission: PromptSubmission = {
    id: uuidv4(),
    file: absolutePath,
    content,
    submittedAt: new Date().toISOString(),
    submittedBy: submittedBy || process.env.USER || 'unknown',
    status: 'pending',
    metadata: {
      fileSize: content.length,
      lineCount: content.split('\n').length,
    },
  };

  store.submissions.push(submission);
  saveStore(store);

  return submission;
}

export function getSubmission(id: string): PromptSubmission | undefined {
  const store = loadStore();
  return store.submissions.find(s => s.id === id || s.id.startsWith(id));
}

export function approveSubmission(id: string, reviewedBy?: string): PromptSubmission {
  const store = loadStore();
  const submission = store.submissions.find(s => s.id === id || s.id.startsWith(id));

  if (!submission) {
    throw new Error(`Submission not found: ${id}`);
  }

  if (submission.status !== 'pending') {
    throw new Error(`Submission is already ${submission.status}`);
  }

  submission.status = 'approved';
  submission.reviewedAt = new Date().toISOString();
  submission.reviewedBy = reviewedBy || process.env.USER || 'unknown';

  saveStore(store);
  return submission;
}

export function rejectSubmission(id: string, reason: string, reviewedBy?: string): PromptSubmission {
  const store = loadStore();
  const submission = store.submissions.find(s => s.id === id || s.id.startsWith(id));

  if (!submission) {
    throw new Error(`Submission not found: ${id}`);
  }

  if (submission.status !== 'pending') {
    throw new Error(`Submission is already ${submission.status}`);
  }

  submission.status = 'rejected';
  submission.reviewedAt = new Date().toISOString();
  submission.reviewedBy = reviewedBy || process.env.USER || 'unknown';
  submission.rejectionReason = reason;

  saveStore(store);
  return submission;
}

export function listSubmissions(filter?: ApprovalStatus): PromptSubmission[] {
  const store = loadStore();
  if (filter) {
    return store.submissions.filter(s => s.status === filter);
  }
  return store.submissions;
}

export function getPendingReviews(): PromptSubmission[] {
  return listSubmissions('pending');
}

export function exportHistory(format: 'json' | 'csv' = 'json'): string {
  const store = loadStore();

  if (format === 'csv') {
    const headers = ['id', 'file', 'status', 'submittedAt', 'submittedBy', 'reviewedAt', 'reviewedBy', 'rejectionReason'];
    const rows = store.submissions.map(s => [
      s.id,
      s.file,
      s.status,
      s.submittedAt,
      s.submittedBy,
      s.reviewedAt || '',
      s.reviewedBy || '',
      s.rejectionReason || '',
    ].map(v => `"${v}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  return JSON.stringify(store, null, 2);
}

export function getStatistics(): Record<string, number> {
  const store = loadStore();
  return {
    total: store.submissions.length,
    pending: store.submissions.filter(s => s.status === 'pending').length,
    approved: store.submissions.filter(s => s.status === 'approved').length,
    rejected: store.submissions.filter(s => s.status === 'rejected').length,
  };
}
