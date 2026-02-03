import { createHash } from 'crypto';

/**
 * Generate a SHA-256 hash of content
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generate a short hash (first 8 characters)
 */
export function shortHash(content: string): string {
  return hashContent(content).substring(0, 8);
}

/**
 * Generate a unique version ID based on content and timestamp
 */
export function generateVersionId(content: string, timestamp: number): string {
  const combined = `${content}:${timestamp}`;
  return hashContent(combined).substring(0, 12);
}

/**
 * Validate a hash format
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]+$/.test(hash) && (hash.length === 8 || hash.length === 12 || hash.length === 64);
}

/**
 * Check if two contents are identical by comparing hashes
 */
export function contentsMatch(content1: string, content2: string): boolean {
  return hashContent(content1) === hashContent(content2);
}
