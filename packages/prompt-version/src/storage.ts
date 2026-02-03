import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname, basename, resolve } from 'path';
import { hashContent, shortHash } from './hash.js';

export interface VersionMetadata {
  id: string;
  contentHash: string;
  message: string;
  author: string;
  timestamp: number;
  parentId: string | null;
  tags: string[];
  branch: string;
}

export interface VersionEntry {
  metadata: VersionMetadata;
  content: string;
}

export interface BranchInfo {
  name: string;
  headId: string;
  createdAt: number;
  description?: string;
}

export interface PromptVersionStore {
  promptFile: string;
  versions: VersionMetadata[];
  branches: BranchInfo[];
  currentBranch: string;
  tags: Record<string, string>; // tag name -> version id
}

const VERSION_DIR = '.prompt-versions';
const STORE_FILE = 'store.json';
const OBJECTS_DIR = 'objects';

export class VersionStorage {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Get the version directory path
   */
  getVersionDir(): string {
    return join(this.basePath, VERSION_DIR);
  }

  /**
   * Check if versioning is initialized
   */
  isInitialized(): boolean {
    return existsSync(this.getVersionDir());
  }

  /**
   * Initialize version control in directory
   */
  async initialize(): Promise<void> {
    const versionDir = this.getVersionDir();
    const objectsDir = join(versionDir, OBJECTS_DIR);

    if (!existsSync(versionDir)) {
      await mkdir(versionDir, { recursive: true });
    }
    if (!existsSync(objectsDir)) {
      await mkdir(objectsDir, { recursive: true });
    }

    // Create initial store if not exists
    const storePath = join(versionDir, STORE_FILE);
    if (!existsSync(storePath)) {
      const initialStore: Record<string, PromptVersionStore> = {};
      await writeFile(storePath, JSON.stringify(initialStore, null, 2), 'utf-8');
    }
  }

  /**
   * Get store for a specific prompt file
   */
  async getStore(promptFile: string): Promise<PromptVersionStore | null> {
    const storePath = join(this.getVersionDir(), STORE_FILE);
    if (!existsSync(storePath)) {
      return null;
    }

    const storeData = await readFile(storePath, 'utf-8');
    const stores: Record<string, PromptVersionStore> = JSON.parse(storeData);

    const normalizedPath = this.normalizeFilePath(promptFile);
    return stores[normalizedPath] || null;
  }

  /**
   * Save store for a specific prompt file
   */
  async saveStore(promptFile: string, store: PromptVersionStore): Promise<void> {
    const storePath = join(this.getVersionDir(), STORE_FILE);

    let stores: Record<string, PromptVersionStore> = {};
    if (existsSync(storePath)) {
      const storeData = await readFile(storePath, 'utf-8');
      stores = JSON.parse(storeData);
    }

    const normalizedPath = this.normalizeFilePath(promptFile);
    stores[normalizedPath] = store;
    await writeFile(storePath, JSON.stringify(stores, null, 2), 'utf-8');
  }

  /**
   * Create a new store for a prompt file
   */
  createNewStore(promptFile: string): PromptVersionStore {
    return {
      promptFile: this.normalizeFilePath(promptFile),
      versions: [],
      branches: [{
        name: 'main',
        headId: '',
        createdAt: Date.now()
      }],
      currentBranch: 'main',
      tags: {}
    };
  }

  /**
   * Save version content to objects directory
   */
  async saveContent(content: string): Promise<string> {
    const hash = hashContent(content);
    const objectPath = join(this.getVersionDir(), OBJECTS_DIR, hash);

    if (!existsSync(objectPath)) {
      await writeFile(objectPath, content, 'utf-8');
    }

    return hash;
  }

  /**
   * Load version content from objects directory
   */
  async loadContent(contentHash: string): Promise<string | null> {
    const objectPath = join(this.getVersionDir(), OBJECTS_DIR, contentHash);

    if (!existsSync(objectPath)) {
      return null;
    }

    return await readFile(objectPath, 'utf-8');
  }

  /**
   * Get a version entry with metadata and content
   */
  async getVersion(promptFile: string, versionId: string): Promise<VersionEntry | null> {
    const store = await this.getStore(promptFile);
    if (!store) return null;

    // Support partial hash matching
    const version = store.versions.find(v =>
      v.id === versionId || v.id.startsWith(versionId)
    );

    if (!version) return null;

    const content = await this.loadContent(version.contentHash);
    if (!content) return null;

    return { metadata: version, content };
  }

  /**
   * Add a new version
   */
  async addVersion(
    promptFile: string,
    content: string,
    message: string,
    author: string
  ): Promise<VersionMetadata> {
    let store = await this.getStore(promptFile);
    if (!store) {
      store = this.createNewStore(promptFile);
    }

    // Save content and get hash
    const contentHash = await this.saveContent(content);

    // Check for duplicate content
    const existingWithSameContent = store.versions.find(v => v.contentHash === contentHash);
    if (existingWithSameContent) {
      // Return existing version metadata but don't create duplicate
      return existingWithSameContent;
    }

    // Get current branch head
    const currentBranch = store.branches.find(b => b.name === store!.currentBranch);
    const parentId = currentBranch?.headId || null;

    // Create version metadata
    const timestamp = Date.now();
    const id = shortHash(`${contentHash}:${timestamp}`);

    const metadata: VersionMetadata = {
      id,
      contentHash,
      message,
      author,
      timestamp,
      parentId: parentId || null,
      tags: [],
      branch: store.currentBranch
    };

    // Add to versions
    store.versions.push(metadata);

    // Update branch head
    if (currentBranch) {
      currentBranch.headId = id;
    }

    await this.saveStore(promptFile, store);
    return metadata;
  }

  /**
   * Get version history for a file
   */
  async getHistory(promptFile: string): Promise<VersionMetadata[]> {
    const store = await this.getStore(promptFile);
    if (!store) return [];

    // Return versions sorted by timestamp descending
    return [...store.versions].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Add a tag to a version
   */
  async addTag(promptFile: string, versionId: string, tagName: string): Promise<boolean> {
    const store = await this.getStore(promptFile);
    if (!store) return false;

    const version = store.versions.find(v =>
      v.id === versionId || v.id.startsWith(versionId)
    );
    if (!version) return false;

    // Check if tag already exists
    if (store.tags[tagName]) {
      return false;
    }

    store.tags[tagName] = version.id;
    version.tags.push(tagName);
    await this.saveStore(promptFile, store);
    return true;
  }

  /**
   * Remove a tag
   */
  async removeTag(promptFile: string, tagName: string): Promise<boolean> {
    const store = await this.getStore(promptFile);
    if (!store) return false;

    const versionId = store.tags[tagName];
    if (!versionId) return false;

    delete store.tags[tagName];

    const version = store.versions.find(v => v.id === versionId);
    if (version) {
      version.tags = version.tags.filter(t => t !== tagName);
    }

    await this.saveStore(promptFile, store);
    return true;
  }

  /**
   * Get version by tag
   */
  async getVersionByTag(promptFile: string, tagName: string): Promise<VersionEntry | null> {
    const store = await this.getStore(promptFile);
    if (!store) return null;

    const versionId = store.tags[tagName];
    if (!versionId) return null;

    return this.getVersion(promptFile, versionId);
  }

  /**
   * Create a new branch
   */
  async createBranch(promptFile: string, branchName: string, fromVersionId?: string): Promise<boolean> {
    const store = await this.getStore(promptFile);
    if (!store) return false;

    // Check if branch already exists
    if (store.branches.some(b => b.name === branchName)) {
      return false;
    }

    // Get starting point
    let headId = '';
    if (fromVersionId) {
      const version = store.versions.find(v =>
        v.id === fromVersionId || v.id.startsWith(fromVersionId)
      );
      if (version) {
        headId = version.id;
      }
    } else {
      const currentBranch = store.branches.find(b => b.name === store!.currentBranch);
      headId = currentBranch?.headId || '';
    }

    store.branches.push({
      name: branchName,
      headId,
      createdAt: Date.now()
    });

    await this.saveStore(promptFile, store);
    return true;
  }

  /**
   * Switch to a branch
   */
  async switchBranch(promptFile: string, branchName: string): Promise<boolean> {
    const store = await this.getStore(promptFile);
    if (!store) return false;

    const branch = store.branches.find(b => b.name === branchName);
    if (!branch) return false;

    store.currentBranch = branchName;
    await this.saveStore(promptFile, store);
    return true;
  }

  /**
   * List all branches
   */
  async listBranches(promptFile: string): Promise<BranchInfo[]> {
    const store = await this.getStore(promptFile);
    if (!store) return [];
    return store.branches;
  }

  /**
   * Get all tracked files
   */
  async getTrackedFiles(): Promise<string[]> {
    const storePath = join(this.getVersionDir(), STORE_FILE);
    if (!existsSync(storePath)) return [];

    const storeData = await readFile(storePath, 'utf-8');
    const stores: Record<string, PromptVersionStore> = JSON.parse(storeData);
    return Object.keys(stores);
  }

  /**
   * Normalize file path for consistent storage
   */
  private normalizeFilePath(filePath: string): string {
    const resolved = resolve(this.basePath, filePath);
    // Store relative to base path
    if (resolved.startsWith(this.basePath)) {
      return resolved.substring(this.basePath.length + 1).replace(/\\/g, '/');
    }
    return basename(filePath);
  }
}
