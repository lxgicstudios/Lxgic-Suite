import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import * as diff from 'diff';
import chalk from 'chalk';
import { VersionStorage, VersionMetadata, VersionEntry, BranchInfo } from './storage.js';
import { hashContent, isValidHash } from './hash.js';

export interface CommitResult {
  success: boolean;
  versionId?: string;
  message?: string;
  error?: string;
  isDuplicate?: boolean;
}

export interface DiffResult {
  v1: VersionMetadata;
  v2: VersionMetadata;
  changes: diff.Change[];
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface LogEntry {
  version: VersionMetadata;
  isHead: boolean;
  tags: string[];
}

export class VersionCore {
  private storage: VersionStorage;

  constructor(basePath: string = process.cwd()) {
    this.storage = new VersionStorage(basePath);
  }

  /**
   * Initialize version control
   */
  async init(): Promise<{ success: boolean; message: string }> {
    if (this.storage.isInitialized()) {
      return { success: false, message: 'Version control already initialized in this directory' };
    }

    await this.storage.initialize();
    return { success: true, message: 'Initialized prompt version control in .prompt-versions/' };
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.storage.isInitialized();
  }

  /**
   * Commit a new version of a prompt file
   */
  async commit(
    filePath: string,
    message: string,
    author: string = 'anonymous'
  ): Promise<CommitResult> {
    if (!this.storage.isInitialized()) {
      return { success: false, error: 'Not initialized. Run "prompt-version init" first.' };
    }

    const resolvedPath = resolve(process.cwd(), filePath);
    if (!existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const content = await readFile(resolvedPath, 'utf-8');
    const contentHash = hashContent(content);

    // Check for duplicate
    const history = await this.storage.getHistory(filePath);
    const existingVersion = history.find(v => v.contentHash === contentHash);
    if (existingVersion) {
      return {
        success: true,
        versionId: existingVersion.id,
        message: 'Content unchanged from existing version',
        isDuplicate: true
      };
    }

    const metadata = await this.storage.addVersion(filePath, content, message, author);

    return {
      success: true,
      versionId: metadata.id,
      message: `Created version ${metadata.id}`
    };
  }

  /**
   * Get version history for a file
   */
  async log(filePath: string): Promise<LogEntry[]> {
    const history = await this.storage.getHistory(filePath);
    const store = await this.storage.getStore(filePath);

    if (!store) return [];

    const currentBranch = store.branches.find(b => b.name === store.currentBranch);
    const headId = currentBranch?.headId || '';

    return history.map(version => ({
      version,
      isHead: version.id === headId,
      tags: version.tags
    }));
  }

  /**
   * Compare two versions
   */
  async diff(filePath: string, versionId1: string, versionId2: string): Promise<DiffResult | null> {
    const v1 = await this.storage.getVersion(filePath, versionId1);
    const v2 = await this.storage.getVersion(filePath, versionId2);

    if (!v1 || !v2) return null;

    const changes = diff.diffLines(v1.content, v2.content);

    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const change of changes) {
      const lines = change.value.split('\n').length - 1;
      if (change.added) {
        additions += lines;
      } else if (change.removed) {
        deletions += lines;
      } else {
        unchanged += lines;
      }
    }

    return {
      v1: v1.metadata,
      v2: v2.metadata,
      changes,
      additions,
      deletions,
      unchanged
    };
  }

  /**
   * Format diff for display
   */
  formatDiff(diffResult: DiffResult): string {
    const lines: string[] = [];

    lines.push(chalk.bold(`Comparing ${diffResult.v1.id} -> ${diffResult.v2.id}`));
    lines.push(chalk.gray('─'.repeat(50)));
    lines.push(`${chalk.green(`+${diffResult.additions}`)} additions, ${chalk.red(`-${diffResult.deletions}`)} deletions`);
    lines.push(chalk.gray('─'.repeat(50)));

    for (const change of diffResult.changes) {
      const changeLines = change.value.split('\n');
      for (const line of changeLines) {
        if (!line && changeLines.indexOf(line) === changeLines.length - 1) continue;
        if (change.added) {
          lines.push(chalk.green(`+ ${line}`));
        } else if (change.removed) {
          lines.push(chalk.red(`- ${line}`));
        } else {
          lines.push(chalk.gray(`  ${line}`));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Checkout a specific version
   */
  async checkout(filePath: string, versionId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const version = await this.storage.getVersion(filePath, versionId);

    if (!version) {
      // Try as tag
      const tagVersion = await this.storage.getVersionByTag(filePath, versionId);
      if (tagVersion) {
        const resolvedPath = resolve(process.cwd(), filePath);
        await writeFile(resolvedPath, tagVersion.content, 'utf-8');
        return {
          success: true,
          message: `Checked out tag "${versionId}" (version ${tagVersion.metadata.id})`
        };
      }
      return { success: false, error: `Version or tag not found: ${versionId}` };
    }

    const resolvedPath = resolve(process.cwd(), filePath);
    await writeFile(resolvedPath, version.content, 'utf-8');

    return {
      success: true,
      message: `Checked out version ${version.metadata.id}`
    };
  }

  /**
   * Tag a version
   */
  async tag(filePath: string, tagName: string, versionId?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!versionId) {
      // Tag the latest version
      const history = await this.storage.getHistory(filePath);
      if (history.length === 0) {
        return { success: false, error: 'No versions found' };
      }
      versionId = history[0].id;
    }

    const result = await this.storage.addTag(filePath, versionId, tagName);
    if (!result) {
      return { success: false, error: `Tag "${tagName}" already exists or version not found` };
    }

    return { success: true, message: `Tagged version ${versionId} as "${tagName}"` };
  }

  /**
   * Remove a tag
   */
  async untag(filePath: string, tagName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const result = await this.storage.removeTag(filePath, tagName);
    if (!result) {
      return { success: false, error: `Tag "${tagName}" not found` };
    }
    return { success: true, message: `Removed tag "${tagName}"` };
  }

  /**
   * Create a branch (for A/B testing)
   */
  async branch(
    filePath: string,
    branchName: string,
    fromVersion?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const result = await this.storage.createBranch(filePath, branchName, fromVersion);
    if (!result) {
      return { success: false, error: `Branch "${branchName}" already exists` };
    }
    return { success: true, message: `Created branch "${branchName}"` };
  }

  /**
   * Switch branch
   */
  async switchBranch(
    filePath: string,
    branchName: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const result = await this.storage.switchBranch(filePath, branchName);
    if (!result) {
      return { success: false, error: `Branch "${branchName}" not found` };
    }
    return { success: true, message: `Switched to branch "${branchName}"` };
  }

  /**
   * List branches
   */
  async listBranches(filePath: string): Promise<BranchInfo[]> {
    return this.storage.listBranches(filePath);
  }

  /**
   * Get a specific version's content
   */
  async getVersion(filePath: string, versionId: string): Promise<VersionEntry | null> {
    return this.storage.getVersion(filePath, versionId);
  }

  /**
   * Get list of all tracked files
   */
  async getTrackedFiles(): Promise<string[]> {
    return this.storage.getTrackedFiles();
  }

  /**
   * Format log entry for display
   */
  formatLogEntry(entry: LogEntry): string {
    const lines: string[] = [];

    const headMarker = entry.isHead ? chalk.green(' (HEAD)') : '';
    const tagMarkers = entry.tags.length > 0
      ? chalk.yellow(` [${entry.tags.join(', ')}]`)
      : '';

    lines.push(chalk.yellow(`commit ${entry.version.id}`) + headMarker + tagMarkers);
    lines.push(chalk.gray(`Branch: ${entry.version.branch}`));
    lines.push(chalk.gray(`Author: ${entry.version.author}`));
    lines.push(chalk.gray(`Date:   ${new Date(entry.version.timestamp).toLocaleString()}`));
    lines.push('');
    lines.push(`    ${entry.version.message}`);

    return lines.join('\n');
  }

  /**
   * Get status of a file (changed since last commit)
   */
  async status(filePath: string): Promise<{
    tracked: boolean;
    modified: boolean;
    versions: number;
    currentBranch: string;
  }> {
    const store = await this.storage.getStore(filePath);

    if (!store) {
      return {
        tracked: false,
        modified: false,
        versions: 0,
        currentBranch: 'main'
      };
    }

    const history = await this.storage.getHistory(filePath);
    const resolvedPath = resolve(process.cwd(), filePath);

    let modified = false;
    if (existsSync(resolvedPath) && history.length > 0) {
      const currentContent = await readFile(resolvedPath, 'utf-8');
      const currentHash = hashContent(currentContent);
      modified = currentHash !== history[0].contentHash;
    }

    return {
      tracked: true,
      modified,
      versions: history.length,
      currentBranch: store.currentBranch
    };
  }
}
