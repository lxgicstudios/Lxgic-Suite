import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  encrypt,
  decrypt,
  encryptFile,
  decryptFile,
  rotateKey,
  resolveKey,
  generateKey,
  generateAndSaveKey,
  verifyIntegrity,
  EncryptedData,
  KeyInfo,
} from './crypto';

export interface EncryptionResult {
  inputFile: string;
  outputFile: string;
  success: boolean;
  error?: string;
}

export interface DirectoryEncryptionResult {
  totalFiles: number;
  successful: number;
  failed: number;
  results: EncryptionResult[];
}

/**
 * Lock (encrypt) a single file
 */
export function lockFile(filePath: string, keyOption?: string): EncryptionResult {
  try {
    const keyInfo = resolveKey(keyOption);
    const outputPath = encryptFile(filePath, keyInfo.key);

    return {
      inputFile: path.resolve(filePath),
      outputFile: outputPath,
      success: true,
    };
  } catch (error) {
    return {
      inputFile: path.resolve(filePath),
      outputFile: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Unlock (decrypt) a single file
 */
export function unlockFile(filePath: string, keyOption?: string): EncryptionResult {
  try {
    const keyInfo = resolveKey(keyOption);
    const outputPath = decryptFile(filePath, keyInfo.key);

    return {
      inputFile: path.resolve(filePath),
      outputFile: outputPath,
      success: true,
    };
  } catch (error) {
    return {
      inputFile: path.resolve(filePath),
      outputFile: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Lock (encrypt) all files in a directory
 */
export async function lockDirectory(
  dirPath: string,
  keyOption?: string,
  patterns: string[] = ['**/*.txt', '**/*.md', '**/*.json', '**/*.prompt']
): Promise<DirectoryEncryptionResult> {
  const absolutePath = path.resolve(dirPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Directory not found: ${absolutePath}`);
  }

  const keyInfo = resolveKey(keyOption);
  const results: EncryptionResult[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: absolutePath,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.encrypted'],
    });

    for (const file of files) {
      try {
        const outputPath = encryptFile(file, keyInfo.key);
        results.push({
          inputFile: file,
          outputFile: outputPath,
          success: true,
        });
      } catch (error) {
        results.push({
          inputFile: file,
          outputFile: '',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    totalFiles: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };
}

/**
 * Unlock (decrypt) all encrypted files in a directory
 */
export async function unlockDirectory(
  dirPath: string,
  keyOption?: string
): Promise<DirectoryEncryptionResult> {
  const absolutePath = path.resolve(dirPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Directory not found: ${absolutePath}`);
  }

  const keyInfo = resolveKey(keyOption);
  const results: EncryptionResult[] = [];

  const files = await glob('**/*.encrypted', {
    cwd: absolutePath,
    absolute: true,
    nodir: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  for (const file of files) {
    try {
      const outputPath = decryptFile(file, keyInfo.key);
      results.push({
        inputFile: file,
        outputFile: outputPath,
        success: true,
      });
    } catch (error) {
      results.push({
        inputFile: file,
        outputFile: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    totalFiles: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };
}

/**
 * Rotate encryption key for files
 */
export async function rotateKeys(
  dirPath: string,
  oldKeyOption: string,
  newKeyOption?: string
): Promise<{ rotated: string[]; failed: { file: string; error: string }[]; newKeyFile?: string }> {
  const absolutePath = path.resolve(dirPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Directory not found: ${absolutePath}`);
  }

  const oldKeyInfo = resolveKey(oldKeyOption);

  // Generate new key if not provided
  let newKey: Buffer;
  let newKeyFile: string | undefined;

  if (newKeyOption) {
    const newKeyInfo = resolveKey(newKeyOption);
    newKey = newKeyInfo.key;
  } else {
    newKey = generateKey();
    newKeyFile = path.join(absolutePath, `.new-key-${Date.now()}.key`);
    fs.writeFileSync(newKeyFile, newKey.toString('hex'));
  }

  const rotated: string[] = [];
  const failed: { file: string; error: string }[] = [];

  const files = await glob('**/*.encrypted', {
    cwd: absolutePath,
    absolute: true,
    nodir: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  for (const file of files) {
    try {
      rotateKey(file, oldKeyInfo.key, newKey);
      rotated.push(file);
    } catch (error) {
      failed.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { rotated, failed, newKeyFile };
}

/**
 * Verify encrypted file integrity
 */
export function verifyFile(filePath: string): { valid: boolean; issues: string[]; metadata?: Record<string, unknown> } {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const encryptedData: EncryptedData = JSON.parse(content);
    const { valid, issues } = verifyIntegrity(encryptedData);

    return {
      valid,
      issues,
      metadata: encryptedData.metadata,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`Failed to parse encrypted file: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Generate a new encryption key
 */
export function createNewKey(outputPath?: string): { key: string; file?: string } {
  const key = generateKey();
  const hexKey = key.toString('hex');

  if (outputPath) {
    const absolutePath = path.resolve(outputPath);
    fs.writeFileSync(absolutePath, hexKey);
    return { key: hexKey, file: absolutePath };
  }

  return { key: hexKey };
}

/**
 * Encrypt content directly (not from file)
 */
export function encryptContent(content: string, keyOption?: string): EncryptedData {
  const keyInfo = resolveKey(keyOption);
  return encrypt(content, keyInfo.key, {
    encryptedAt: new Date().toISOString(),
    contentLength: content.length,
  });
}

/**
 * Decrypt content directly
 */
export function decryptContent(encryptedData: EncryptedData, keyOption?: string): string {
  const keyInfo = resolveKey(keyOption);
  return decrypt(encryptedData, keyInfo.key);
}
